import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import { APPROVAL_MATRIX } from '@/lib/constants';
import type { TaskType } from '@/types/database';


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();

  const { data: task, error } = await (supabase.from('tasks') as any)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !task) {
    return NextResponse.json({ data: null, error: { message: 'Task not found', code: 'NOT_FOUND' } }, { status: 404 });
  }

  // Non-managers can only view their own tasks
  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!isManager && task.assigned_to !== currentUser.id && task.created_by !== currentUser.id) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  // Enrich with related data
  const [assigneeRes, creatorRes, approverRes, sprintRes, podRes, historyRes, revisionsRes, notesRes] = await Promise.all([
    (supabase.from('users') as any).select('id, full_name, role, avatar_url').eq('id', task.assigned_to).single(),
    (supabase.from('users') as any).select('id, full_name, role').eq('id', task.created_by).single(),
    task.approver_id
      ? (supabase.from('users') as any).select('id, full_name, role').eq('id', task.approver_id).single()
      : Promise.resolve({ data: null }),
    task.sprint_id
      ? (supabase.from('sprints') as any).select('id, name, status').eq('id', task.sprint_id).single()
      : Promise.resolve({ data: null }),
    task.pod_id
      ? (supabase.from('pods') as any).select('id, name').eq('id', task.pod_id).single()
      : Promise.resolve({ data: null }),
    (supabase.from('task_status_history') as any)
      .select('*, changed_by_user:users!task_status_history_changed_by_fkey(id, full_name)')
      .eq('task_id', id)
      .order('changed_at', { ascending: true }),
    (supabase.from('revisions') as any)
      .select('*, requester:users!revisions_requested_by_fkey(id, full_name)')
      .eq('task_id', id)
      .order('revision_number', { ascending: true }),
    (supabase.from('technical_notes') as any)
      .select('*, author:users!technical_notes_author_id_fkey(id, full_name)')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({
    data: {
      ...task,
      assignee: assigneeRes.data ?? null,
      creator: creatorRes.data ?? null,
      approver: approverRes.data ?? null,
      sprint: sprintRes.data ?? null,
      pod: podRes.data ?? null,
      status_history: historyRes.data ?? [],
      revisions: revisionsRes.data ?? [],
      technical_notes: notesRes.data ?? [],
    },
    error: null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data: existing } = await (supabase.from('tasks') as any)
    .select('*').eq('id', id).single();

  if (!existing) return NextResponse.json({ data: null, error: { message: 'Task not found', code: 'NOT_FOUND' } }, { status: 404 });

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  // Only assignee, creator, or managers can edit
  if (!isManager && existing.assigned_to !== currentUser.id && existing.created_by !== currentUser.id) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const allowedFields = ['title', 'description', 'sprint_id', 'pod_id', 'eta_hours', 'deadline', 'priority', 'tags', 'work_link', 'blocker_description'];

  // Managers can also reassign
  if (isManager) allowedFields.push('assigned_to', 'task_type');

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  // If task_type changed, update approver
  if (updates.task_type && updates.task_type !== existing.task_type) {
    const newRole = APPROVAL_MATRIX[updates.task_type as TaskType];
    if (newRole) {
      const { data: approver } = await (supabase.from('users') as any)
        .select('id').eq('role', newRole).eq('is_active', true).limit(1).single();
      updates.approver_id = approver?.id ?? null;
    }
  }

  // Track eta_set_at
  if (updates.eta_hours !== undefined && updates.eta_hours !== existing.eta_hours) {
    updates.eta_set_at = new Date().toISOString();
  }

  const service = await createServiceClient();
  const { data: updated, error } = await (service.from('tasks') as any)
    .update(updates).eq('id', id).select().single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!isManager) {
    return NextResponse.json({ data: null, error: { message: 'Only managers can delete tasks', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: existing } = await (supabase.from('tasks') as any)
    .select('status').eq('id', id).single();

  if (!existing) return NextResponse.json({ data: null, error: { message: 'Task not found', code: 'NOT_FOUND' } }, { status: 404 });

  if (['approved', 'done'].includes(existing.status)) {
    return NextResponse.json({ data: null, error: { message: 'Cannot delete a completed task', code: 'INVALID_STATE' } }, { status: 400 });
  }

  const service = await createServiceClient();
  await (service.from('tasks') as any).delete().eq('id', id);

  return NextResponse.json({ data: { id: id }, error: null });
}
