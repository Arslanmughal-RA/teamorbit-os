import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import { notifyRevisionRequested } from '@/lib/slack/notify';
import type { RevisionReason, AccountabilityTag } from '@/types/database';


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  // Only approvers and managers can request revisions
  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  const supabase = await createClient();

  const { data: task } = await (supabase.from('tasks') as any)
    .select('*').eq('id', id).single();

  if (!task) return NextResponse.json({ data: null, error: { message: 'Task not found', code: 'NOT_FOUND' } }, { status: 404 });

  const isApprover = task.approver_id === currentUser.id;
  if (!isApprover && !isManager) {
    return NextResponse.json({ data: null, error: { message: 'Only the approver or a manager can request revisions', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const { reason, accountability, notes } = body as {
    reason: RevisionReason;
    accountability: AccountabilityTag;
    notes: string;
  };

  if (!reason || !accountability || !notes?.trim()) {
    return NextResponse.json({ data: null, error: { message: 'reason, accountability, and notes are required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const service = await createServiceClient();

  // Increment revision counters
  const newRevisionCount = (task.revision_count ?? 0) + 1;
  const newAttributable = (task.attributable_revision_count ?? 0) +
    (accountability === 'employee' ? 1 : 0);

  // Insert revision record
  const { data: revision, error: revErr } = await (service.from('revisions') as any)
    .insert({
      task_id: id,
      requested_by: currentUser.id,
      reason,
      accountability,
      notes: notes.trim(),
      revision_number: newRevisionCount,
    })
    .select()
    .single();

  if (revErr) return NextResponse.json({ data: null, error: { message: revErr.message, code: 'DB_ERROR' } }, { status: 500 });

  // Update task counters + transition to revision_requested
  await (service.from('tasks') as any)
    .update({
      status: 'revision_requested',
      revision_count: newRevisionCount,
      attributable_revision_count: newAttributable,
    })
    .eq('id', id);

  // Status history
  await (service.from('task_status_history') as any).insert({
    task_id: id,
    from_status: task.status,
    to_status: 'revision_requested',
    changed_by: currentUser.id,
    notes: `Revision #${newRevisionCount}: ${reason}`,
  });

  // Notify assignee (non-blocking)
  try {
    const { data: assignee } = await (supabase.from('users') as any)
      .select('id, slack_user_id').eq('id', task.assigned_to).single();
    if (assignee) {
      await notifyRevisionRequested(
        assignee,
        { id: task.id, title: task.title, sprint_id: task.sprint_id },
        { full_name: currentUser.full_name },
        newRevisionCount
      );
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ data: revision, error: null }, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await (supabase.from('revisions') as any)
    .select('*, requester:users!revisions_requested_by_fkey(id, full_name, role)')
    .eq('task_id', id)
    .order('revision_number', { ascending: true });

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: data ?? [], error: null });
}
