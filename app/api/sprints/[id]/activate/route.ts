import { NextResponse } from 'next/server';
import { createClient, createServiceClient, getCurrentUser } from '@/lib/supabase/server';

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
  if (!['studio_lead', 'producer'].includes(currentUser.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: sprint, error: fetchErr } = await (supabase.from('sprints') as any)
    .select('*').eq('id', params.id).single();

  if (fetchErr || !sprint) {
    return NextResponse.json({ data: null, error: { message: 'Sprint not found', code: 'NOT_FOUND' } }, { status: 404 });
  }

  if (sprint.status !== 'planning') {
    return NextResponse.json({
      data: null,
      error: { message: `Sprint is already ${sprint.status}; only planning sprints can be activated`, code: 'INVALID_STATE' },
    }, { status: 400 });
  }

  // Ensure start_date is not in the future (optional soft warning — we allow it)
  // Check that sprint has at least one pod
  const { data: sprintPods } = await (supabase.from('sprint_pods') as any)
    .select('pod_id').eq('sprint_id', params.id);

  if (!sprintPods?.length) {
    return NextResponse.json({
      data: null,
      error: { message: 'Sprint must have at least one pod assigned before activation', code: 'VALIDATION_ERROR' },
    }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: updated, error } = await (service.from('sprints') as any)
    .update({ status: 'active' })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message, code: 'DB_ERROR' } }, { status: 500 });

  return NextResponse.json({ data: updated, error: null });
}
