import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();
  const { data: notification } = await (supabase.from('notifications') as any)
    .select('id, user_id').eq('id', id).single();

  if (!notification) return NextResponse.json({ data: null, error: { message: 'Not found', code: 'NOT_FOUND' } }, { status: 404 });
  if (notification.user_id !== currentUser.id) return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });

  const service = await createServiceClient();
  const { data, error } = await (service.from('notifications') as any)
    .update({ is_read: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
