import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import { ALLOWED_TRANSITIONS, APPROVAL_MATRIX } from '@/lib/constants';
import { notifySubmittedForReview, notifyTaskApproved } from '@/lib/slack/notify';
import type { TaskStatus, TaskType } from '@/types/database';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json();
  const { to_status, notes } = body as { to_status: TaskStatus; notes?: string };

  if (!to_status) {
    return NextResponse.json({ data: null, error: { message: 'to_status is required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: task } = await (supabase.from('tasks') as any)
    .select('*').eq('id', id).single();

  if (!task) return NextResponse.json({ data: null, error: { message: 'Task not found', code: 'NOT_FOUND' } }, { status: 404 });

  const currentStatus = task.status as TaskStatus;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(to_status)) {
    return NextResponse.json({
      data: null,
      error: {
        message: `Cannot transition from '${currentStatus}' to '${to_status}'`,
        code: 'INVALID_TRANSITION',
        allowed_transitions: allowed,
      },
    }, { status: 400 });
  }

  // Permission checks per transition
  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  const isAssignee = task.assigned_to === currentUser.id;
  const isApprover = task.approver_id === currentUser.id;

  // Transitions the assignee can do
  const assigneeTransitions: TaskStatus[] = [
    'in_progress', 'submitted_for_review', 'waiting_for_assets',
  ];
  // Transitions only approver/manager can do
  const approverTransitions: TaskStatus[] = [
    'under_review', 'revision_requested', 'qa', 'approved', 'rejected_by_lead',
  ];
  // Done can only be set after approved
  const managerTransitions: TaskStatus[] = ['done'];

  if (approverTransitions.includes(to_status) && !isApprover && !isManager) {
    return NextResponse.json({ data: null, error: { message: 'Only the approver or a manager can perform this transition', code: 'FORBIDDEN' } }, { status: 403 });
  }
  if (managerTransitions.includes(to_status) && !isManager) {
    return NextResponse.json({ data: null, error: { message: 'Only a manager can mark tasks as done', code: 'FORBIDDEN' } }, { status: 403 });
  }
  if (assigneeTransitions.includes(to_status) && !isAssignee && !isManager) {
    return NextResponse.json({ data: null, error: { message: 'Only the assignee or a manager can perform this transition', code: 'FORBIDDEN' } }, { status: 403 });
  }

  // Build timestamp fields to set
  const now = new Date().toISOString();
  const timestamps: Record<string, string | null> = {};
  if (to_status === 'in_progress' && !task.started_at)    timestamps.started_at = now;
  if (to_status === 'submitted_for_review')                 timestamps.submitted_at = now;
  if (to_status === 'approved')                             timestamps.approved_at = now;
  if (to_status === 'done')                                 timestamps.done_at = now;

  const service = await createServiceClient();

  const { data: updated, error } = await (service.from('tasks') as any)
    .update({ status: to_status, ...timestamps })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // Record history
  await (service.from('task_status_history') as any).insert({
    task_id: id,
    from_status: currentStatus,
    to_status,
    changed_by: currentUser.id,
    notes: notes ?? null,
  });

  // Fire notifications (non-blocking)
  try {
    if (to_status === 'submitted_for_review' && task.approver_id) {
      const { data: approver } = await (supabase.from('users') as any)
        .select('id, slack_user_id').eq('id', task.approver_id).single();
      if (approver) {
        await notifySubmittedForReview(
          approver,
          { id: task.id, title: task.title, sprint_id: task.sprint_id },
          { full_name: currentUser.full_name }
        );
      }
    }
    if (to_status === 'approved') {
      const { data: assignee } = await (supabase.from('users') as any)
        .select('id, slack_user_id').eq('id', task.assigned_to).single();
      if (assignee) {
        await notifyTaskApproved(
          assignee,
          { id: task.id, title: task.title, sprint_id: task.sprint_id },
          { full_name: currentUser.full_name }
        );
      }
    }
  } catch { /* notifications are best-effort */ }

  return NextResponse.json({ data: updated, error: null });
}
