import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notify } from '@/lib/slack/notify';

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
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  // Find active sprints whose end_date has passed
  const { data: expiredSprints } = await (service.from('sprints') as any)
    .select('id, name, start_date, end_date')
    .eq('status', 'active')
    .lt('end_date', nowStr);

  if (!expiredSprints?.length) {
    return NextResponse.json({ data: { completed: 0 }, error: null });
  }

  let completedCount = 0;

  for (const sprint of expiredSprints) {
    try {
      // Auto-complete the sprint
      await (service.from('sprints') as any)
        .update({ status: 'completed' })
        .eq('id', sprint.id);

      // Move non-terminal tasks to backlog
      await (service.from('tasks') as any)
        .update({ status: 'backlog' })
        .eq('sprint_id', sprint.id)
        .not('status', 'in', '("done","approved","rejected_by_lead")');

      // Find all users assigned tasks in this sprint
      const { data: assignees } = await (service.from('tasks') as any)
        .select('assigned_to')
        .eq('sprint_id', sprint.id);

      const userIds: string[] = [
        ...new Set<string>((assignees ?? []).map((a: any) => a.assigned_to as string).filter(Boolean)),
      ];

      // Seed evaluation stubs — Phase 11 will fill in AI summaries
      for (const userId of userIds) {
        // Check if evaluation already exists
        const { data: existing } = await (service.from('evaluations') as any)
          .select('id')
          .eq('user_id', userId)
          .eq('sprint_id', sprint.id)
          .single();

        if (!existing) {
          // Compute basic metrics
          const { data: tasks } = await (service.from('tasks') as any)
            .select('id, status, deadline, done_at, revision_count, attributable_revision_count, eta_hours, started_at')
            .eq('sprint_id', sprint.id)
            .eq('assigned_to', userId);

          const taskList: any[] = tasks ?? [];
          const total = taskList.length;
          const completed = taskList.filter((t: any) => ['done', 'approved'].includes(t.status)).length;

          // Deadline hit rate
          const tasksWithDeadline = taskList.filter((t: any) => t.deadline);
          const hitDeadline = tasksWithDeadline.filter((t: any) =>
            t.done_at && new Date(t.done_at) <= new Date(t.deadline)
          ).length;
          const deadlineHitRate = tasksWithDeadline.length > 0
            ? Math.round((hitDeadline / tasksWithDeadline.length) * 100)
            : null;

          // Total revisions
          const totalRevisions = taskList.reduce((s: number, t: any) => s + (t.revision_count ?? 0), 0);
          const attributableRevisions = taskList.reduce((s: number, t: any) => s + (t.attributable_revision_count ?? 0), 0);

          // Sprint completion rate
          const sprintCompletionRate = total > 0 ? Math.round((completed / total) * 100) : null;

          await (service.from('evaluations') as any).insert({
            user_id: userId,
            sprint_id: sprint.id,
            period_start: sprint.start_date,
            period_end: sprint.end_date,
            total_tasks: total,
            completed_tasks: completed,
            deadline_hit_rate: deadlineHitRate,
            total_revisions: totalRevisions,
            attributable_revisions: attributableRevisions,
            sprint_completion_rate: sprintCompletionRate,
            is_finalized: false,
          });
        }

        // Notify user their evaluation is ready
        const { data: user } = await (service.from('users') as any)
          .select('id, slack_user_id').eq('id', userId).single();

        if (user) {
          await notify({
            userId,
            type: 'evaluation_ready',
            title: 'Sprint Evaluation Ready',
            body: `Your performance data for ${sprint.name} has been compiled and is ready for review`,
            relatedSprintId: sprint.id,
            slackUserId: user.slack_user_id,
            channel: 'in_app',
          });
        }
      }

      // Notify studio leads + producers about sprint completion
      const { data: managers } = await (service.from('users') as any)
        .select('id, slack_user_id')
        .in('role', ['studio_lead', 'producer'])
        .eq('is_active', true);

      for (const manager of managers ?? []) {
        await notify({
          userId: manager.id,
          type: 'evaluation_ready',
          title: `Sprint Completed: ${sprint.name}`,
          body: `${sprint.name} ended ${nowStr}. ${userIds.length} evaluation${userIds.length !== 1 ? 's' : ''} are ready for review.`,
          relatedSprintId: sprint.id,
          slackUserId: manager.slack_user_id,
          channel: 'slack',
        });
      }

      completedCount++;
      console.log(`[sprint-end] Auto-completed sprint ${sprint.id} (${sprint.name}), seeded ${userIds.length} evaluations`);
    } catch (err) {
      console.error(`[sprint-end] Failed for sprint ${sprint.id}:`, err);
    }
  }

  return NextResponse.json({
    data: {
      completed: completedCount,
      sprints_processed: expiredSprints.length,
    },
    error: null,
  });
}
