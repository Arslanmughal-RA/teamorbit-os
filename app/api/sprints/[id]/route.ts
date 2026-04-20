import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const { data: sprint, error } = await (supabase.from('sprints') as any)
    .select('*').eq('id', params.id).single();

  if (error || !sprint) return NextResponse.json({ data: null, error: { message: 'Sprint not found', code: 'NOT_FOUND' } }, { status: 404 });

  // Enrich with pods
  const { data: sprintPods } = await (supabase.from('sprint_pods') as any)
    .select('pod_id').eq('sprint_id', sprint.id);
  const podIds = (sprintPods ?? []).map((sp: any) => sp.pod_id);

  let pods: any[] = [];
  if (podIds.length) {
    const { data } = await (supabase.from('pods') as any)
      .select('id, name, is_studio_wide').in('id', podIds);
    pods = data ?? [];
  }

  // Task counts by status
  const { data: tasks } = await (supabase.from('tasks') as any)
    .select('id, status, assigned_to, task_type, title, deadline, priority')
    .eq('sprint_id', sprint.id);

  const taskList = tasks ?? [];
  const total_tasks = taskList.length;
  const done_tasks = taskList.filter((t: any) => ['done', 'approved'].includes(t.status)).length;
  const in_progress_tasks = taskList.filter((t: any) => t.status === 'in_progress').length;
  const backlog_tasks = taskList.filter((t: any) => t.status === 'backlog').length;
  const review_tasks = taskList.filter((t: any) =>
    ['submitted_for_review', 'under_review', 'qa'].includes(t.status)
  ).length;

  // Created by user
  const { data: creator } = await (supabase.from('users') as any)
    .select('id, full_name, role').eq('id', sprint.created_by).single();

  return NextResponse.json({
    data: {
      ...sprint,
      pods,
      pod_ids: podIds,
      tasks: taskList,
      total_tasks,
      done_tasks,
      in_progress_tasks,
      backlog_tasks,
      review_tasks,
      completion_pct: total_tasks > 0 ? Math.round((done_tasks / total_tasks) * 100) : 0,
      creator: creator ?? null,
    },
    error: null,
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (!['studio_lead', 'producer'].includes(currentUser.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, start_date, end_date, pod_ids } = body;

  const supabase = await createClient();

  // Fetch current sprint
  const { data: existing, error: fetchErr } = await (supabase.from('sprints') as any)
    .select('*').eq('id', params.id).single();
  if (fetchErr || !existing) return NextResponse.json({ data: null, error: { message: 'Sprint not found', code: 'NOT_FOUND' } }, { status: 404 });

  // Only allow editing planning sprints
  if (existing.status === 'completed' || existing.status === 'cancelled') {
    return NextResponse.json({ data: null, error: { message: 'Cannot edit a completed or cancelled sprint', code: 'INVALID_STATE' } }, { status: 400 });
  }

  if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ data: null, error: { message: 'End date must be after start date', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const service = await createServiceClient();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;

  const { data: updated, error } = await (service.from('sprints') as any)
    .update(updates).eq('id', params.id).select().single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // Update pod links if provided
  if (pod_ids !== undefined) {
    await (service.from('sprint_pods') as any).delete().eq('sprint_id', params.id);
    if (pod_ids.length) {
      const links = pod_ids.map((pod_id: string) => ({ sprint_id: params.id, pod_id }));
      await (service.from('sprint_pods') as any).insert(links);
    }
  }

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(_req: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (currentUser.role !== 'studio_lead') {
    return NextResponse.json({ data: null, error: { message: 'Only Studio Lead can delete sprints', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: existing } = await (supabase.from('sprints') as any)
    .select('status').eq('id', params.id).single();

  if (!existing) return NextResponse.json({ data: null, error: { message: 'Sprint not found', code: 'NOT_FOUND' } }, { status: 404 });
  if (existing.status === 'active') {
    return NextResponse.json({ data: null, error: { message: 'Cannot delete an active sprint', code: 'INVALID_STATE' } }, { status: 400 });
  }

  const service = await createServiceClient();
  await (service.from('sprints') as any).update({ status: 'cancelled' }).eq('id', params.id);

  return NextResponse.json({ data: { id: params.id, status: 'cancelled' }, error: null });
}
