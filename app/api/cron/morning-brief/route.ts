import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notify } from '@/lib/slack/notify';
import { sendDirectMessage } from '@/lib/slack/client';

// Guard: only Vercel cron or requests with CRON_SECRET can invoke this
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Vercel sets this header on cron invocations
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Fetch all active users
  const { data: users } = await (service.from('users') as any)
    .select('id, full_name, slack_user_id, role')
    .eq('is_active', true);

  if (!users?.length) {
    return NextResponse.json({ data: { sent: 0 }, error: null });
  }

  // Find sprints starting today
  const { data: startingSprints } = await (service.from('sprints') as any)
    .select('id, name, start_date, end_date')
    .eq('start_date', todayStr)
    .eq('status', 'active');

  let briefsSent = 0;

  for (const user of users) {
    try {
      // Get their open tasks
      const { data: tasks } = await (service.from('tasks') as any)
        .select('id, title, status, deadline, priority, task_type')
        .eq('assigned_to', user.id)
        .not('status', 'in', '("done","approved","rejected_by_lead")')
        .order('priority', { ascending: false })
        .limit(10);

      const taskList: any[] = tasks ?? [];
      const overdue = taskList.filter((t: any) =>
        t.deadline && new Date(t.deadline) < today
      );
      const dueToday = taskList.filter((t: any) =>
        t.deadline && t.deadline.slice(0, 10) === todayStr
      );
      const inProgress = taskList.filter((t: any) => t.status === 'in_progress');
      const inReview = taskList.filter((t: any) =>
        ['submitted_for_review', 'under_review', 'qa'].includes(t.status)
      );

      // Build Slack message blocks
      const blocks: any[] = [
        {
          type: 'header',
          text: { type: 'plain_text', text: `Good morning, ${user.full_name.split(' ')[0]} ☀️` },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Your daily brief for ${today.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}*`,
          },
        },
        { type: 'divider' },
      ];

      // Stats section
      const statsText = [
        `📋 *${taskList.length}* open task${taskList.length !== 1 ? 's' : ''}`,
        inProgress.length ? `🔵 *${inProgress.length}* in progress` : '',
        inReview.length  ? `🟣 *${inReview.length}* in review` : '',
        dueToday.length  ? `🟡 *${dueToday.length}* due today` : '',
        overdue.length   ? `🔴 *${overdue.length}* overdue` : '',
      ].filter(Boolean).join('  |  ');

      if (statsText) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: statsText } });
      }

      // Overdue tasks
      if (overdue.length) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⚠️ Overdue Tasks:*\n${overdue.map((t: any) =>
              `• <${process.env.NEXT_PUBLIC_APP_URL}/tasks/${t.id}|${t.title}> — due ${new Date(t.deadline).toLocaleDateString()}`
            ).join('\n')}`,
          },
        });
      }

      // Due today
      if (dueToday.length) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📅 Due Today:*\n${dueToday.map((t: any) =>
              `• <${process.env.NEXT_PUBLIC_APP_URL}/tasks/${t.id}|${t.title}>`
            ).join('\n')}`,
          },
        });
      }

      // Sprint starting today
      if (startingSprints?.length) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🚀 Sprint Starting Today:*\n${startingSprints.map((s: any) =>
              `• <${process.env.NEXT_PUBLIC_APP_URL}/sprints/${s.id}|${s.name}> (ends ${new Date(s.end_date).toLocaleDateString()})`
            ).join('\n')}`,
          },
        });
      }

      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View My Tasks' },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/tasks`,
          },
        ],
      });

      const summaryText = `Morning brief: ${taskList.length} open tasks${overdue.length ? `, ${overdue.length} overdue` : ''}`;

      // Send Slack if user has slack_user_id
      if (user.slack_user_id && process.env.SLACK_BOT_TOKEN) {
        await sendDirectMessage(user.slack_user_id, blocks, summaryText);
      }

      // Always store in-app
      await notify({
        userId: user.id,
        type: 'morning_brief',
        title: 'Morning Brief',
        body: summaryText,
        slackUserId: null, // already sent above
        channel: 'in_app',
      });

      briefsSent++;
    } catch (err) {
      console.error(`[morning-brief] Failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({
    data: { sent: briefsSent, total_users: users.length },
    error: null,
  });
}
