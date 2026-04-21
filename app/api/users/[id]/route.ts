import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single() as any;

  if (error || !profile) return NextResponse.json({ data: null, error: { message: 'User not found', code: 'NOT_FOUND' } }, { status: 404 });

  // Get pod memberships
  const { data: podMemberships } = await supabase
    .from('pod_members')
    .select('pod_id')
    .eq('user_id', id) as any;

  const podIds = (podMemberships ?? []).map((pm: any) => pm.pod_id);
  const { data: pods } = podIds.length
    ? await supabase.from('pods').select('id, name, is_studio_wide').in('id', podIds)
    : { data: [] };

  // Active task count
  const { count: activeTaskCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', id)
    .not('status', 'in', '("done","approved","rejected_by_lead")') as any;

  return NextResponse.json({
    data: { ...profile, pods: pods ?? [], active_task_count: activeTaskCount ?? 0 },
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
  const allowed = ['role', 'full_name', 'is_active', 'slack_user_id'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) updates[key] = body[key];

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: null, error: { message: 'Nothing to update', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data, error } = await (service.from('users') as any).update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
