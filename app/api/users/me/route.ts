import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/server';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  return NextResponse.json({ data: user, error: null });
}
