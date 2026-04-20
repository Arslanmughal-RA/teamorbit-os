import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data: evaluation, error } = await (supabase.from('evaluations') as any)
    .select(`
      *,
      user:users!evaluations_user_id_fkey(id, full_name, role, avatar_url, email),
      sprint:sprints!evaluations_sprint_id_fkey(id, name, start_date, end_date, status),
      reviewer:users!evaluations_reviewed_by_fkey(id, full_name)
    `)
    .eq('id', params.id)
    .single();

  if (error || !evaluation) {
    return NextResponse.json({ data: null, error: { message: 'Evaluation not found', code: 'NOT_FOUND' } }, { status: 404 });
  }

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!isManager && evaluation.user_id !== currentUser.id) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  return NextResponse.json({ data: evaluation, error: null });
}

export async function PATCH(req: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!isManager) {
    return NextResponse.json({ data: null, error: { message: 'Only managers can review evaluations', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const { manual_score, manual_notes, is_finalized } = body;

  const updates: Record<string, unknown> = {};
  if (manual_score !== undefined)  updates.manual_score  = manual_score;
  if (manual_notes !== undefined)  updates.manual_notes  = manual_notes;
  if (is_finalized !== undefined) {
    updates.is_finalized  = is_finalized;
    updates.reviewed_by   = currentUser.id;
    updates.reviewed_at   = new Date().toISOString();
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ data: null, error: { message: 'Nothing to update', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data, error } = await (service.from('evaluations') as any)
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
