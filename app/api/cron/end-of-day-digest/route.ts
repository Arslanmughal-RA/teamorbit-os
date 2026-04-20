import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notify } from '@/lib/slack/notify';
import { sendDirectMessage } from '@/lib/slack/client';

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch all active users
  const { data: users } = await (service.from('users') as any)
    .select('id, full_name, slack_user_id, role')
    .eq('is_active', true);

  if (!users?.length) return NextResponse.json({ data: { sent: 0 }, error: null });

  let digestsSent = 0;

  for (const user of users) {
    try {
      // Tasks completed today
      const { data: completedToday } = await (service.from('tasks') as any)
        .select('id, title, task_type')
        .eq('assigned_to', user.id)
        .in('status', ['done', 'approved'])
        .gte('done_at', todayStart.toISOString())
        .lte('done_at', todayEnd.toISOString());

      // Tasks moved to in_progress today (from status history)
      const { data: startedToday } = await (service.from('task_status_history') as any)
        .select('task_id, tasks!inner(title, assigned_to)')
        .eq('tasks.assigned_to', user.id)
        .eq('to_status', 'in_progress')
        .gte('changed_at', todayStart.toISOString())
        .lte('changed_at', todayEnd.toISOString());

      // Revisions received today
      const { data: revisionsToday } = await (service.from('revisions') as any)
        .select('id, tasks!inner(title, assigned_to)')
        .eq('tasks.assigned_to', user.id)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());

      // Still open tasks with approaching deadlines (next 2 days)
      const twoDaysLater = new Date(today);
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);
      const { data: approaching } = await (service.from('tasks') as any)
        .select('id, title, deadline, status')
        .eq('assigned_to', user.id)
        .not('status', 'in', '("done","approved","rejected_by_lead")')
        .lte('deadline', twoDaysLater.toISOString().slice(0, 10))
        .gte('deadline', today.toISOString().slice(0, 10))
        .order('deadline', { ascending: true });

      const completed = completedToday ?? [];
      const approaching_ = approaching ?? [];
      const revisions = revisionsToday ?? [];

      // Build blocks
      const blocks: any[] = [
        {
          type: 'header',
          text: { type: 'plain_text', text: `End of Day — ${today.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}` },
        },
        { type: 'divider' },
      ];

      // What got done today
      if (completed.length) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*✅ Completed Today (${completed.length}):*\n${completed.map((t: any) =>
              `• <${process.env.NEXT_PUBLIC_APP_URL}/tasks/${t.id}|${t.title}>`
            ).join('\n')}`,
          },
        });
      } else {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*Today's completions:* None logged yet.` },
        });
      }

      // Revisions today
      if (revisions.length) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🔄 Revisions Received Today (${revisions.length}):*\n${revisions.map((r: any) =>
              `• ${r.tasks?.title ?? 'Unknown task'}`
            ).join('\n')}`,
          },
        });
      }

      // Approaching deadlines
      if (approaching_.length) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⏰ Deadlines in the Next 2 Days:*\n${approaching_.map((t: any) => {
              const dl = new Date(t.deadline);
              const isToday = t.deadline.slice(0, 10) === today.toISOString().slice(0, 10);
              return `• <${process.env.NEXT_PUBLIC_APP_URL}/tasks/${t.id}|${t.title}> — ${isToday ? '*due today*' : `due ${dl.toLocaleDateString()}`}`;
            }).join('\n')}`,
          },
        });
      }

      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `Great work today, ${user.full_name.split(' ')[0]}! See you tomorrow. 👋`,
        }],
      });

      const summaryText = `EOD digest: ${completed.length} tasks completed today${approaching_.length ? `, ${approaching_.length} deadline${approaching_.length !== 1 ? 's' : ''} approaching` : ''}`;

      if (user.slack_user_id && process.env.SLACK_BOT_TOKEN) {
        await sendDirectMessage(user.slack_user_id, blocks, summaryText);
      }

      await notify({
        userId: user.id,
        type: 'end_of_day_digest',
        title: 'End of Day Digest',
        body: summaryText,
        slackUserId: null,
        channel: 'in_app',
      });

      digestsSent++;
    } catch (err) {
      console.error(`[eod-digest] Failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({
    data: { sent: digestsSent, total_users: users.length },
    error: null,
  });
}
