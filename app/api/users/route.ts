import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, display_name, avatar_url, role, email, is_active, created_at')
    .eq('is_active', true)
    .order('full_name') as any;

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: users, error: null });
}
