import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const { data: pods, error } = await supabase
    .from('pods')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // For each pod, get members with user info
  const podsWithMembers = await Promise.all(
    (pods as any[]).map(async (pod) => {
      const { data: members } = await supabase
        .from('pod_members')
        .select('user_id')
        .eq('pod_id', pod.id);

      const userIds = (members ?? []).map((m: any) => m.user_id);

      const { data: users } = userIds.length
        ? await supabase.from('users').select('id, full_name, display_name, avatar_url, role').in('id', userIds)
        : { data: [] };

      return { ...pod, members: users ?? [] };
    })
  );

  return NextResponse.json({ data: podsWithMembers, error: null });
}
