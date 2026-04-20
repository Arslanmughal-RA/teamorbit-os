import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data: task } = await (supabase.from('tasks') as any)
    .select('id, assigned_to, created_by').eq('id', params.id).single();

  if (!task) return NextResponse.json({ data: null, error: { message: 'Task not found', code: 'NOT_FOUND' } }, { status: 404 });

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  const isRelated = task.assigned_to === currentUser.id || task.created_by === currentUser.id;
  if (!isManager && !isRelated) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const { note, is_blocking = false } = body;

  if (!note?.trim()) {
    return NextResponse.json({ data: null, error: { message: 'Note content is required', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data, error } = await (service.from('technical_notes') as any)
    .insert({
      task_id: params.id,
      author_id: currentUser.id,
      note: note.trim(),
      is_blocking,
    })
    .select('*, author:users!technical_notes_author_id_fkey(id, full_name)')
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function GET(_req: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await (supabase.from('technical_notes') as any)
    .select('*, author:users!technical_notes_author_id_fkey(id, full_name)')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: data ?? [], error: null });
}
