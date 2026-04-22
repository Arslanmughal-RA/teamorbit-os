import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import { APPROVAL_MATRIX } from '@/lib/constants';
import { notifyTaskAssigned } from '@/lib/slack/notify';
import type { TaskType } from '@/types/database';

export async function GET(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const sprintId  = searchParams.get('sprint_id');
  const podId     = searchParams.get('pod_id');
  const status    = searchParams.get('status');
  const assignedTo = searchParams.get('assigned_to');
  const taskType  = searchParams.get('task_type');

  let query = (supabase.from('tasks') as any)
    .select('*, assignee:users!tasks_assigned_to_fkey(id, full_name, role, avatar_url), creator:users!tasks_created_by_fkey(id, full_name)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  // Role-based filtering: non-leads only see their own tasks
  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!isManager) {
    query = query.eq('assigned_to', currentUser.id);
  }

  if (sprintId)   query = query.eq('sprint_id', sprintId);
  if (podId)      query = query.eq('pod_id', podId);
  if (status)     query = query.eq('status', status);
  if (assignedTo && isManager) query = query.eq('assigned_to', assignedTo);
  if (taskType)   query = query.eq('task_type', taskType);

  const { data: tasks, error } = await query;
  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: tasks ?? [], error: null });
}

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json();
  const {
    title, description, task_type, sprint_id, pod_id,
    assigned_to, eta_hours, deadline, priority = 0, tags, work_link,
    status = 'backlog', attachments,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ data: null, error: { message: 'Title is required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }
  if (!task_type) {
    return NextResponse.json({ data: null, error: { message: 'Task type is required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }
  if (!assigned_to) {
    return NextResponse.json({ data: null, error: { message: 'Assignee is required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  // Non-managers can only create tasks for themselves
  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!isManager && assigned_to !== currentUser.id) {
    return NextResponse.json({ data: null, error: { message: 'You can only create tasks for yourself', code: 'FORBIDDEN' } }, { status: 403 });
  }

  // Determine approver from approval matrix
  const approver_id = APPROVAL_MATRIX[task_type as TaskType]
    ? await resolveApprover(task_type as TaskType)
    : null;

  const service = await createServiceClient();

  const { data: task, error } = await (service.from('tasks') as any)
    .insert({
      title: title.trim(),
      description: description ?? null,
      task_type,
      sprint_id: sprint_id ?? null,
      pod_id: pod_id ?? null,
      assigned_to,
      created_by: currentUser.id,
      approver_id,
      eta_hours: eta_hours ?? null,
      eta_set_at: eta_hours ? new Date().toISOString() : null,
      deadline: deadline ?? null,
      priority,
      tags: tags ?? null,
      work_link: work_link ?? null,
      status: status || 'backlog',
      attachments: attachments ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // Record initial status history
  await (service.from('task_status_history') as any).insert({
    task_id: task.id,
    from_status: null,
    to_status: status || 'backlog',
    changed_by: currentUser.id,
    notes: 'Task created',
  });

  // Notify assignee if different from creator (non-blocking)
  try {
    if (assigned_to !== currentUser.id) {
      const supabase = await createClient();
      const { data: assignee } = await (supabase.from('users') as any)
        .select('id, full_name, slack_user_id').eq('id', assigned_to).single();
      if (assignee) {
        await notifyTaskAssigned(
          assignee,
          { id: task.id, title: task.title, sprint_id: task.sprint_id },
          { full_name: currentUser.full_name }
        );
      }
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ data: task, error: null }, { status: 201 });
}

// Resolve the approver user ID from the approval matrix role
async function resolveApprover(taskType: TaskType): Promise<string | null> {
  const supabase = await createClient();
  const approverRole = APPROVAL_MATRIX[taskType];
  if (!approverRole) return null;
  const { data } = await (supabase.from('users') as any)
    .select('id').eq('role', approverRole).eq('is_active', true).limit(1).single();
  return data?.id ?? null;
}
