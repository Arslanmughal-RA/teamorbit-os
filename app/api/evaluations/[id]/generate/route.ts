import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import { calculateMetrics } from '@/lib/evaluations/calculate-metrics';
import { generateEvaluationReport } from '@/lib/evaluations/generate-report';
import type { UserRole } from '@/types/database';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!isManager) {
    return NextResponse.json({ data: null, error: { message: 'Only managers can generate evaluations', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const supabase = await createClient();

  // Load evaluation + relations
  const { data: evaluation, error: evalErr } = await (supabase.from('evaluations') as any)
    .select(`
      *,
      user:users!evaluations_user_id_fkey(id, full_name, role),
      sprint:sprints!evaluations_sprint_id_fkey(id, name, start_date, end_date)
    `)
    .eq('id', id)
    .single();

  if (evalErr || !evaluation) {
    return NextResponse.json({ data: null, error: { message: 'Evaluation not found', code: 'NOT_FOUND' } }, { status: 404 });
  }

  if (evaluation.is_finalized) {
    return NextResponse.json({ data: null, error: { message: 'Evaluation is already finalized', code: 'INVALID_STATE' } }, { status: 400 });
  }

  if (!evaluation.sprint?.id) {
    return NextResponse.json({ data: null, error: { message: 'Evaluation has no associated sprint', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  // Load all tasks for this user in this sprint
  const [tasksRes, revisionsRes, deadlineMissesRes] = await Promise.all([
    (supabase.from('tasks') as any)
      .select('id, status, deadline, done_at, eta_hours, started_at, revision_count, attributable_revision_count, task_type')
      .eq('sprint_id', evaluation.sprint.id)
      .eq('assigned_to', evaluation.user_id),
    (supabase.from('revisions') as any)
      .select('accountability, reason, tasks!inner(sprint_id, assigned_to)')
      .eq('tasks.sprint_id', evaluation.sprint.id)
      .eq('tasks.assigned_to', evaluation.user_id),
    (supabase.from('deadline_misses') as any)
      .select('accountability, reason, original_eta_hours, actual_hours, tasks!inner(sprint_id, assigned_to)')
      .eq('tasks.sprint_id', evaluation.sprint.id)
      .eq('tasks.assigned_to', evaluation.user_id),
  ]);

  const tasks = tasksRes.data ?? [];
  const revisions = revisionsRes.data ?? [];
  const deadlineMisses = deadlineMissesRes.data ?? [];

  // Calculate metrics
  const metrics = calculateMetrics(tasks, revisions, deadlineMisses);

  // Generate AI report
  let aiReport = null;
  let aiError = null;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      aiReport = await generateEvaluationReport(
        { full_name: evaluation.user.full_name, role: evaluation.user.role as UserRole },
        evaluation.sprint,
        metrics
      );
    } catch (err: any) {
      console.error('[evaluation/generate] Claude error:', err.message);
      aiError = err.message;
    }
  } else {
    aiError = 'ANTHROPIC_API_KEY not configured';
  }

  // Save updated evaluation
  const service = await createServiceClient();
  const updates: Record<string, unknown> = {
    total_tasks:              metrics.total_tasks,
    completed_tasks:          metrics.completed_tasks,
    deadline_hit_rate:        metrics.deadline_hit_rate,
    total_revisions:          metrics.total_revisions,
    attributable_revisions:   metrics.attributable_revisions,
    avg_eta_accuracy:         metrics.avg_eta_accuracy,
    sprint_completion_rate:   metrics.sprint_completion_rate,
    performance_tier:         metrics.performance_tier,
  };

  if (aiReport) {
    updates.ai_summary         = aiReport.summary;
    updates.ai_strengths       = aiReport.strengths;
    updates.ai_concerns        = aiReport.concerns;
    updates.ai_recommendations = aiReport.recommendations;
  }

  const { data: updated, error: saveErr } = await (service.from('evaluations') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (saveErr) return NextResponse.json({ data: null, error: { message: saveErr.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({
    data: updated,
    ai_generated: !!aiReport,
    ai_error: aiError,
    error: null,
  });
}
