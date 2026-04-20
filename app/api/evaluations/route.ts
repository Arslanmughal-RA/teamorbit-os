import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sprintId  = searchParams.get('sprint_id');
  const userId    = searchParams.get('user_id');
  const finalized = searchParams.get('finalized');

  const isManager = ['studio_lead', 'producer'].includes(currentUser.role);

  let query = (supabase.from('evaluations') as any)
    .select(`
      *,
      user:users!evaluations_user_id_fkey(id, full_name, role, avatar_url),
      sprint:sprints!evaluations_sprint_id_fkey(id, name, start_date, end_date, status),
      reviewer:users!evaluations_reviewed_by_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false });

  // Non-managers can only see their own evaluations
  if (!isManager) {
    query = query.eq('user_id', currentUser.id);
  } else if (userId) {
    query = query.eq('user_id', userId);
  }

  if (sprintId)           query = query.eq('sprint_id', sprintId);
  if (finalized !== null && finalized !== undefined) {
    query = query.eq('is_finalized', finalized === 'true');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: data ?? [], error: null });
}
