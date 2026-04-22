import { NextRequest, NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { TASK_STATUS_LABELS } from '@/lib/constants';
import type { TaskStatus } from '@/types/database';

// Ordered columns for the Kanban board
export const KANBAN_COLUMNS: TaskStatus[] = [
  'backlog',
  'in_progress',
  'waiting_for_assets',
  'submitted_for_review',
  'under_review',
  'revision_requested',
  'qa',
  'approved',
  'done',
];


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sprintIdParam = searchParams.get('sprint_id');

  // Get pod
  const { data: pod } = await (supabase.from('pods') as any)
    .select('id, name').eq('id', id).single();
  if (!pod) return NextResponse.json({ data: null, error: { message: 'Pod not found', code: 'NOT_FOUND' } }, { status: 404 });

  // Resolve sprint to use
  let sprintId: string | null = sprintIdParam;
  let sprint: any = null;

  if (!sprintId) {
    // Find active sprint for this pod
    const { data: sprintPods } = await (supabase.from('sprint_pods') as any)
      .select('sprint_id').eq('pod_id', id);
    const ids = (sprintPods ?? []).map((sp: any) => sp.sprint_id);
    if (ids.length) {
      const { data: sprints } = await (supabase.from('sprints') as any)
        .select('*').in('id', ids).eq('status', 'active').order('start_date', { ascending: false }).limit(1);
      sprint = sprints?.[0] ?? null;
      sprintId = sprint?.id ?? null;
    }
  } else {
    const { data } = await (supabase.from('sprints') as any)
      .select('*').eq('id', sprintId).single();
    sprint = data;
  }

  // Get tasks
  let tasks: any[] = [];
  if (sprintId) {
    const { data } = await (supabase.from('tasks') as any)
      .select('id, title, status, task_type, priority, deadline, revision_count, assigned_to, eta_hours, tags, work_link')
      .eq('sprint_id', sprintId)
      .eq('pod_id', id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });
    tasks = data ?? [];
  } else {
    // No active sprint — show backlog tasks for this pod
    const { data } = await (supabase.from('tasks') as any)
      .select('id, title, status, task_type, priority, deadline, revision_count, assigned_to, eta_hours, tags, work_link')
      .eq('pod_id', id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });
    tasks = data ?? [];
  }

  // Enrich with assignee names
  const assigneeIds = [...new Set(tasks.map((t: any) => t.assigned_to).filter(Boolean))];
  let usersMap: Record<string, any> = {};
  if (assigneeIds.length) {
    const { data: users } = await (supabase.from('users') as any)
      .select('id, full_name, avatar_url, role').in('id', assigneeIds);
    for (const u of users ?? []) usersMap[u.id] = u;
  }

  const tasksEnriched = tasks.map((t: any) => ({
    ...t,
    assignee: usersMap[t.assigned_to] ?? null,
    is_overdue: t.deadline && !['done', 'approved', 'rejected_by_lead'].includes(t.status)
      && new Date(t.deadline) < new Date(),
  }));

  // Build columns — always show all columns
  const columns = KANBAN_COLUMNS.map(status => ({
    status,
    label: TASK_STATUS_LABELS[status],
    tasks: tasksEnriched.filter((t: any) => t.status === status),
  }));

  return NextResponse.json({
    data: {
      pod,
      sprint,
      columns,
      total_tasks: tasks.length,
    },
    error: null,
  });
}
