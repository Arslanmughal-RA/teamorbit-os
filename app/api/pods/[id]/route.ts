import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
