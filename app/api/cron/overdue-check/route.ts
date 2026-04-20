import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyTaskOverdue } from '@/lib/slack/notify';

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
  const nowStr = new Date().toISOString().slice(0, 10);

  // Find tasks past their deadline that are still open
  const { data: overdueTasks } = await (service.from('tasks') as any)
    .select('id, title, deadline, sprint_id, assigned_to')
    .not('status', 'in', '("done","approved","rejected_by_lead","cancelled")')
    .lt('deadline', nowStr)
    .not('deadline', 'is', null);

  if (!overdueTasks?.length) {
    return NextResponse.json({ data: { notified: 0 }, error: null });
  }

  // Dedupe by assignee — only notify once per assignee per run even if multiple tasks overdue
  const assigneeIds: string[] = [
    ...new Set<string>(overdueTasks.map((t: any) => t.assigned_to as string).filter(Boolean)),
  ];

  // Fetch user profiles
  const { data: users } = await (service.from('users') as any)
    .select('id, slack_user_id')
    .in('id', assigneeIds);

  const userMap: Record<string, any> = {};
  for (const u of users ?? []) userMap[u.id] = u;

  let notifiedCount = 0;

  // Group tasks by assignee
  const tasksByAssignee: Record<string, any[]> = {};
  for (const task of overdueTasks) {
    if (!tasksByAssignee[task.assigned_to]) tasksByAssignee[task.assigned_to] = [];
    tasksByAssignee[task.assigned_to].push(task);
  }

  for (const [userId, tasks] of Object.entries(tasksByAssignee)) {
    const user = userMap[userId];
    if (!user) continue;

    try {
      // Only notify for each task once every 24 hours — check for recent notification
      for (const task of tasks) {
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 22); // 22h window

        const { data: recentNotif } = await (service.from('notifications') as any)
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'task_overdue')
          .eq('related_task_id', task.id)
          .gte('created_at', yesterday.toISOString())
          .limit(1)
          .single();

        if (!recentNotif) {
          await notifyTaskOverdue(
            { id: user.id, slack_user_id: user.slack_user_id },
            {
              id: task.id,
              title: task.title,
              deadline: task.deadline,
              sprint_id: task.sprint_id,
            }
          );
          notifiedCount++;
        }
      }
    } catch (err) {
      console.error(`[overdue-check] Failed for user ${userId}:`, err);
    }
  }

  // Notify managers about overdue tasks summary (once per run)
  try {
    const { data: managers } = await (service.from('users') as any)
      .select('id, slack_user_id')
      .in('role', ['studio_lead', 'producer'])
      .eq('is_active', true);

    if (managers?.length && overdueTasks.length > 0) {
      // Check if managers were notified recently (last 4 hours)
      const fourHoursAgo = new Date();
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

      for (const manager of managers) {
        const { data: recentManagerNotif } = await (service.from('notifications') as any)
          .select('id')
          .eq('user_id', manager.id)
          .eq('type', 'task_overdue')
          .gte('created_at', fourHoursAgo.toISOString())
          .limit(1)
          .single();

        if (!recentManagerNotif) {
          // Group by assignee for summary
          const summary = Object.entries(tasksByAssignee)
            .map(([uid, tasks]) => `${tasks.length} task${tasks.length > 1 ? 's' : ''} (user ${uid.slice(0, 8)}...)`)
            .join(', ');

          await notifyTaskOverdue(
            { id: manager.id, slack_user_id: manager.slack_user_id },
            {
              id: overdueTasks[0].id,
              title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} across ${assigneeIds.length} team member${assigneeIds.length > 1 ? 's' : ''}`,
              deadline: overdueTasks[0].deadline,
              sprint_id: overdueTasks[0].sprint_id,
            }
          );
        }
      }
    }
  } catch (err) {
    console.error('[overdue-check] Failed to notify managers:', err);
  }

  return NextResponse.json({
    data: {
      overdue_tasks: overdueTasks.length,
      notified: notifiedCount,
      assignees_affected: assigneeIds.length,
    },
    error: null,
  });
}
