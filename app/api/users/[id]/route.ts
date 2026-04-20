import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
