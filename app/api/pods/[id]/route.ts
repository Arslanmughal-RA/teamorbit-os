import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const { data: pod, error } = await supabase
    .from('pods')
    .select('*')
    .eq('id', id)
    .single() as any;

  if (error || !pod) return NextResponse.json({ data: null, error: { message: 'Pod not found', code: 'NOT_FOUND' } }, { status: 404 });

  // Get members
  const { data: memberRows } = await supabase
    .from('pod_members')
    .select('user_id')
    .eq('pod_id', id);

  const userIds = (memberRows ?? []).map((m: any) => m.user_id);
  const { data: members } = userIds.length
    ? await supabase.from('users').select('id, full_name, display_name, avatar_url, role, email').in('id', userIds)
    : { data: [] };

  // Get current active sprint
  const { data: sprintPods } = await supabase
    .from('sprint_pods')
    .select('sprint_id')
    .eq('pod_id', id) as any;

  const sprintIds = (sprintPods ?? []).map((sp: any) => sp.sprint_id);
  let activeSprint = null;
  if (sprintIds.length) {
    const { data: sprints } = await supabase
      .from('sprints')
      .select('*')
      .in('id', sprintIds)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1) as any;
    activeSprint = sprints?.[0] ?? null;
  }

  return NextResponse.json({
    data: { ...pod, members: members ?? [], active_sprint: activeSprint },
    error: null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (!['studio_lead', 'producer'].includes(currentUser.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ['name', 'description', 'is_studio_wide'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) updates[key] = body[key];

  const service = await createServiceClient();

  // Handle member_ids update if provided
  if (Array.isArray(body.member_ids)) {
    await (service.from('pod_members') as any).delete().eq('pod_id', id);
    if (body.member_ids.length) {
      await (service.from('pod_members') as any).insert(
        body.member_ids.map((uid: string) => ({ pod_id: id, user_id: uid }))
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: null, error: { message: 'Nothing to update', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const { data, error } = await (service.from('pods') as any).update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data, error: null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (currentUser.role !== 'studio_lead') {
    return NextResponse.json({ data: null, error: { message: 'Only Studio Lead can delete pods', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const service = await createServiceClient();
  await (service.from('pod_members') as any).delete().eq('pod_id', id);
  const { error } = await (service.from('pods') as any).delete().eq('id', id);
  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: { id }, error: null });
}
