import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';
import { APPROVAL_MATRIX } from '@/lib/constants';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const status = searchParams.get('status');
  const podId  = searchParams.get('pod_id');

  let query = (supabase.from('sprints') as any).select('*').order('start_date', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data: sprints, error } = await query;
  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // Enrich each sprint with pod info and task counts
  const enriched = await Promise.all((sprints ?? []).map(async (sprint: any) => {
    const { data: sprintPods } = await (supabase.from('sprint_pods') as any)
      .select('pod_id').eq('sprint_id', sprint.id);
    const podIds = (sprintPods ?? []).map((sp: any) => sp.pod_id);

    let pods: any[] = [];
    if (podIds.length) {
      const { data } = await (supabase.from('pods') as any)
        .select('id, name, is_studio_wide').in('id', podIds);
      pods = data ?? [];
    }

    // Filter by pod if requested
    if (podId && !podIds.includes(podId)) return null;

    const { count: totalTasks } = await (supabase.from('tasks') as any)
      .select('id', { count: 'exact', head: true }).eq('sprint_id', sprint.id);
    const { count: doneTasks } = await (supabase.from('tasks') as any)
      .select('id', { count: 'exact', head: true })
      .eq('sprint_id', sprint.id).in('status', ['done', 'approved']);

    return { ...sprint, pods, total_tasks: totalTasks ?? 0, done_tasks: doneTasks ?? 0 };
  }));

  return NextResponse.json({ data: enriched.filter(Boolean), error: null });
}

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (!['studio_lead', 'producer'].includes(currentUser.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, start_date, end_date, pod_ids } = body;

  if (!name || !start_date || !end_date || !pod_ids?.length) {
    return NextResponse.json({ data: null, error: { message: 'Missing required fields', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ data: null, error: { message: 'End date must be after start date', code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: sprint, error } = await (service.from('sprints') as any).insert({
    name, description, start_date, end_date,
    status: 'planning',
    created_by: currentUser.id,
  }).select().single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  // Link pods
  const podLinks = pod_ids.map((pod_id: string) => ({ sprint_id: sprint.id, pod_id }));
  await (service.from('sprint_pods') as any).insert(podLinks);

  return NextResponse.json({ data: sprint, error: null }, { status: 201 });
}
