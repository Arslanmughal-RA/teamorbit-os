import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = Math.min(Number(searchParams.get('limit') ?? '30'), 100);

  let query = (await createClient()).from('notifications' as any)
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('is_read', false);

  const supabase = await createClient();
  const finalQuery = (supabase.from('notifications') as any)
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data, error } = unreadOnly
    ? await finalQuery.eq('is_read', false)
    : await finalQuery;

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // Count unread
  const { count: unreadCount } = await (supabase.from('notifications') as any)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .eq('channel', 'in_app')
    .eq('is_read', false);

  return NextResponse.json({ data: data ?? [], unread_count: unreadCount ?? 0, error: null });
}

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  // Mark all as read shortcut
  const body = await req.json().catch(() => ({}));
  if (body.action === 'mark_all_read') {
    const service = await createServiceClient();
    await (service.from('notifications') as any)
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    return NextResponse.json({ data: { marked: true }, error: null });
  }

  return NextResponse.json({ data: null, error: { message: 'Unknown action', code: 'VALIDATION_ERROR' } }, { status: 400 });
}
