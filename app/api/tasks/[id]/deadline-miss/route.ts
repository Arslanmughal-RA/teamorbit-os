import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import type { DeadlineMissReason, AccountabilityTag } from '@/types/database';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data: task } = await (supabase.from('tasks') as any)
    .select('*').eq('id', id).single();

  if (!task) return NextResponse.json({ data: null, error: { message: 'Task not found', code: 'NOT_FOUND' } }, { status: 404 });

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  const isAssignee = task.assigned_to === currentUser.id;
  if (!isManager && !isAssignee) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const {
    reason,
    accountability,
    notes,
    original_eta_hours,
    actual_hours,
  } = body as {
    reason: DeadlineMissReason;
    accountability: AccountabilityTag;
    notes?: string;
    original_eta_hours?: number;
    actual_hours?: number;
  };

  if (!reason || !accountability) {
    return NextResponse.json({ data: null, error: { message: 'reason and accountability are required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  // Check for existing deadline miss on this task to avoid duplicates
  const { data: existing } = await (supabase.from('deadline_misses') as any)
    .select('id').eq('task_id', id).single();

  if (existing) {
    return NextResponse.json({ data: null, error: { message: 'A deadline miss is already logged for this task', code: 'DUPLICATE' } }, { status: 409 });
  }

  const service = await createServiceClient();
  const { data, error } = await (service.from('deadline_misses') as any)
    .insert({
      task_id: id,
      logged_by: currentUser.id,
      reason,
      accountability,
      notes: notes ?? null,
      original_eta_hours: original_eta_hours ?? task.eta_hours ?? null,
      actual_hours: actual_hours ?? null,
      confirmed_by_producer: isManager,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await (supabase.from('deadline_misses') as any)
    .select('*, logger:users!deadline_misses_logged_by_fkey(id, full_name)')
    .eq('task_id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? null, error: null });
}
