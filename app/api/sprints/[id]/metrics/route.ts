import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();

  const { data: sprint, error: fetchErr } = await (supabase.from('sprints') as any)
    .select('*').eq('id', id).single();

  if (fetchErr || !sprint) {
    return NextResponse.json({ data: null, error: { message: 'Sprint not found', code: 'NOT_FOUND' } }, { status: 404 });
  }

  // Fetch all tasks for this sprint
  const { data: tasks } = await (supabase.from('tasks') as any)
    .select('id, status, task_type, assigned_to, eta_hours, deadline, done_at, revision_count, attributable_revision_count, created_at')
    .eq('sprint_id', id);

  const taskList: any[] = tasks ?? [];

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const t of taskList) {
    statusBreakdown[t.status] = (statusBreakdown[t.status] ?? 0) + 1;
  }

  // Task type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const t of taskList) {
    typeBreakdown[t.task_type] = (typeBreakdown[t.task_type] ?? 0) + 1;
  }

  // Per-assignee stats
  const assigneeMap: Record<string, { total: number; done: number; revisions: number }> = {};
  for (const t of taskList) {
    if (!assigneeMap[t.assigned_to]) {
      assigneeMap[t.assigned_to] = { total: 0, done: 0, revisions: 0 };
    }
    assigneeMap[t.assigned_to].total++;
    if (['done', 'approved'].includes(t.status)) assigneeMap[t.assigned_to].done++;
    assigneeMap[t.assigned_to].revisions += t.revision_count ?? 0;
  }

  // Enrich assignee IDs with names
  const assigneeIds = Object.keys(assigneeMap);
  let assigneeUsers: any[] = [];
  if (assigneeIds.length) {
    const { data } = await (supabase.from('users') as any)
      .select('id, full_name, role').in('id', assigneeIds);
    assigneeUsers = data ?? [];
  }

  const byAssignee = assigneeUsers.map((u: any) => ({
    user_id: u.id,
    full_name: u.full_name,
    role: u.role,
    ...assigneeMap[u.id],
    completion_pct: assigneeMap[u.id]?.total > 0
      ? Math.round((assigneeMap[u.id].done / assigneeMap[u.id].total) * 100)
      : 0,
  }));

  const total = taskList.length;
  const done = (statusBreakdown['done'] ?? 0) + (statusBreakdown['approved'] ?? 0);
  const totalRevisions = taskList.reduce((s, t) => s + (t.revision_count ?? 0), 0);

  // Days remaining / elapsed
  const now = new Date();
  const start = new Date(sprint.start_date);
  const end = new Date(sprint.end_date);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000));
  const remainingDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));

  return NextResponse.json({
    data: {
      sprint_id: id,
      sprint_name: sprint.name,
      sprint_status: sprint.status,
      total_tasks: total,
      done_tasks: done,
      completion_pct: total > 0 ? Math.round((done / total) * 100) : 0,
      total_revisions: totalRevisions,
      status_breakdown: statusBreakdown,
      type_breakdown: typeBreakdown,
      by_assignee: byAssignee,
      timeline: { total_days: totalDays, elapsed_days: elapsedDays, remaining_days: remainingDays },
    },
    error: null,
  });
}
