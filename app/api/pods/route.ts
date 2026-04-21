import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

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

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (!['studio_lead', 'producer'].includes(currentUser.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const { name, description, is_studio_wide, member_ids } = await req.json();
  if (!name?.trim()) return NextResponse.json({ data: null, error: { message: 'Name is required', code: 'VALIDATION_ERROR' } }, { status: 400 });

  const service = await createServiceClient();

  const { data: pod, error } = await (service.from('pods') as any)
    .insert({ name: name.trim(), description: description ?? null, is_studio_wide: !!is_studio_wide })
    .select().single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  if (member_ids?.length) {
    await (service.from('pod_members') as any).insert(
      member_ids.map((uid: string) => ({ pod_id: pod.id, user_id: uid }))
    );
  }

  return NextResponse.json({ data: pod, error: null }, { status: 201 });
}
