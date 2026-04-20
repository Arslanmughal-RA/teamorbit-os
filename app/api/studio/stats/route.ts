import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });

  const supabase = await createClient();

  const [
    usersRes,
    activeSprintsRes,
    openTasksRes,
    overdueTasksRes,
    pendingReviewTasksRes,
    recentEvaluationsRes,
    podsRes,
  ] = await Promise.all([
    // Active users
    (supabase.from('users') as any).select('id, full_name, role, slack_user_id', { count: 'exact' }).eq('is_active', true),

    // Active sprints with pod/task counts
    (supabase.from('sprints') as any).select('id, name, start_date, end_date, status').eq('status', 'active').order('start_date', { ascending: false }),

    // Total open tasks (non-terminal)
    (supabase.from('tasks') as any).select('id, status, assigned_to, priority, task_type', { count: 'exact' })
      .not('status', 'in', '("done","approved","rejected_by_lead")'),

    // Overdue tasks
    (supabase.from('tasks') as any)
      .select('id, title, deadline, assigned_to, sprint_id, task_type, status', { count: 'exact' })
      .not('status', 'in', '("done","approved","rejected_by_lead")')
      .lt('deadline', new Date().toISOString().slice(0, 10))
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(10),

    // Tasks awaiting review
    (supabase.from('tasks') as any)
      .select('id, title, status, assigned_to, task_type', { count: 'exact' })
      .in('status', ['submitted_for_review', 'under_review', 'qa']),

    // Recent evaluations (last 20, unfinalized first)
    (supabase.from('evaluations') as any)
      .select('id, user_id, sprint_id, performance_tier, sprint_completion_rate, deadline_hit_rate, attributable_revisions, is_finalized, created_at, user:users!evaluations_user_id_fkey(id, full_name, role), sprint:sprints!evaluations_sprint_id_fkey(id, name)')
      .order('is_finalized', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(20),

    // Pods
    (supabase.from('pods') as any).select('id, name, is_studio_wide', { count: 'exact' }),
  ]);

  const users        = usersRes.data ?? [];
  const activeSprints = activeSprintsRes.data ?? [];
  const openTasks    = openTasksRes.data ?? [];
  const overdueTasks = overdueTasksRes.data ?? [];
  const pendingReview = pendingReviewTasksRes.data ?? [];
  const evaluations  = recentEvaluationsRes.data ?? [];

  // Enrich overdue tasks with assignee names
  const overdueAssigneeIds = [...new Set<string>(overdueTasks.map((t: any) => t.assigned_to).filter(Boolean))];
  let assigneeMap: Record<string, any> = {};
  if (overdueAssigneeIds.length) {
    const { data: assignees } = await (supabase.from('users') as any)
      .select('id, full_name, role').in('id', overdueAssigneeIds);
    for (const u of assignees ?? []) assigneeMap[u.id] = u;
  }
  const overdueEnriched = overdueTasks.map((t: any) => ({
    ...t,
    assignee: assigneeMap[t.assigned_to] ?? null,
  }));

  // Per-user load (open tasks count)
  const userLoadMap: Record<string, number> = {};
  for (const t of openTasks) {
    userLoadMap[(t as any).assigned_to] = (userLoadMap[(t as any).assigned_to] ?? 0) + 1;
  }
  const teamLoad = users
    .map((u: any) => ({ ...u, open_tasks: userLoadMap[u.id] ?? 0 }))
    .sort((a: any, b: any) => b.open_tasks - a.open_tasks);

  // Status breakdown of open tasks
  const statusBreakdown: Record<string, number> = {};
  for (const t of openTasks) {
    statusBreakdown[(t as any).status] = (statusBreakdown[(t as any).status] ?? 0) + 1;
  }

  // Evaluation tier distribution
  const tierDist = { excellent: 0, acceptable: 0, concerning: 0, unscored: 0 };
  for (const e of evaluations) {
    const tier = (e as any).performance_tier;
    if (tier === 'excellent')  tierDist.excellent++;
    else if (tier === 'acceptable') tierDist.acceptable++;
    else if (tier === 'concerning') tierDist.concerning++;
    else tierDist.unscored++;
  }

  // Enrich active sprints with task counts
  const enrichedSprints = await Promise.all(activeSprints.map(async (sprint: any) => {
    const { count: total }  = await (supabase.from('tasks') as any).select('id', { count: 'exact', head: true }).eq('sprint_id', sprint.id);
    const { count: done }   = await (supabase.from('tasks') as any).select('id', { count: 'exact', head: true }).eq('sprint_id', sprint.id).in('status', ['done', 'approved']);
    const now = new Date();
    const end = new Date(sprint.end_date);
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    return { ...sprint, total_tasks: total ?? 0, done_tasks: done ?? 0, days_left: daysLeft };
  }));

  return NextResponse.json({
    data: {
      total_users:     users.length,
      total_pods:      (podsRes.data ?? []).length,
      active_sprints:  enrichedSprints,
      open_tasks:      openTasksRes.count ?? openTasks.length,
      overdue_tasks:   overdueEnriched,
      pending_review:  pendingReview.length,
      status_breakdown: statusBreakdown,
      team_load:       teamLoad,
      evaluations:     evaluations,
      tier_distribution: tierDist,
    },
    error: null,
  });
}
