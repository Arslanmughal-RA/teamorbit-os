import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import { calculateMetrics } from '@/lib/evaluations/calculate-metrics';
import { notify } from '@/lib/slack/notify';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (!['studio_lead', 'producer'].includes(currentUser.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: sprint, error: fetchErr } = await (supabase.from('sprints') as any)
    .select('*').eq('id', id).single();

  if (fetchErr || !sprint) {
    return NextResponse.json({ data: null, error: { message: 'Sprint not found', code: 'NOT_FOUND' } }, { status: 404 });
  }

  if (sprint.status !== 'active') {
    return NextResponse.json({
      data: null,
      error: { message: `Sprint is ${sprint.status}; only active sprints can be completed`, code: 'INVALID_STATE' },
    }, { status: 400 });
  }

  const service = await createServiceClient();

  // Mark sprint completed
  const { data: updated, error } = await (service.from('sprints') as any)
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // Move all non-terminal tasks back to backlog
  await (service.from('tasks') as any)
    .update({ status: 'backlog' })
    .eq('sprint_id', id)
    .not('status', 'in', '("done","approved","rejected_by_lead")');

  // Seed evaluation stubs for all assignees in this sprint
  let evaluationCount = 0;
  try {
    const { data: assigneeRows } = await (service.from('tasks') as any)
      .select('assigned_to').eq('sprint_id', id);
    const userIds = [...new Set<string>((assigneeRows ?? []).map((a: any) => a.assigned_to as string).filter(Boolean))];

    for (const userId of userIds) {
      // Skip if already exists
      const { data: existing } = await (service.from('evaluations') as any)
        .select('id').eq('user_id', userId).eq('sprint_id', id).single();
      if (existing) continue;

      const { data: tasks } = await (service.from('tasks') as any)
        .select('id, status, deadline, done_at, eta_hours, started_at, revision_count, attributable_revision_count, task_type')
        .eq('sprint_id', id).eq('assigned_to', userId);
      const { data: revisions } = await (service.from('revisions') as any)
        .select('accountability, reason, tasks!inner(sprint_id, assigned_to)')
        .eq('tasks.sprint_id', id).eq('tasks.assigned_to', userId);
      const { data: deadlineMisses } = await (service.from('deadline_misses') as any)
        .select('accountability, reason, original_eta_hours, actual_hours, tasks!inner(sprint_id, assigned_to)')
        .eq('tasks.sprint_id', id).eq('tasks.assigned_to', userId);

      const metrics = calculateMetrics(tasks ?? [], revisions ?? [], deadlineMisses ?? []);

      await (service.from('evaluations') as any).insert({
        user_id: userId,
        sprint_id: id,
        period_start: sprint.start_date,
        period_end: sprint.end_date,
        total_tasks: metrics.total_tasks,
        completed_tasks: metrics.completed_tasks,
        deadline_hit_rate: metrics.deadline_hit_rate,
        total_revisions: metrics.total_revisions,
        attributable_revisions: metrics.attributable_revisions,
        avg_eta_accuracy: metrics.avg_eta_accuracy,
        sprint_completion_rate: metrics.sprint_completion_rate,
        performance_tier: metrics.performance_tier,
        is_finalized: false,
      });

      const { data: userRow } = await (service.from('users') as any)
        .select('id, slack_user_id').eq('id', userId).single();
      if (userRow) {
        await notify({
          userId,
          type: 'evaluation_ready',
          title: 'Sprint Evaluation Ready',
          body: `Your performance data for ${sprint.name} has been compiled. A manager will review it soon.`,
          relatedSprintId: sprint.id,
          slackUserId: userRow.slack_user_id,
          channel: 'in_app',
        });
      }
      evaluationCount++;
    }
  } catch (evalErr) {
    console.error('[sprint/complete] Evaluation seeding error:', evalErr);
  }

  return NextResponse.json({
    data: { ...updated, evaluations_seeded: evaluationCount },
    error: null,
  });
}
