'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Zap, CheckCircle2, Clock, Users, BarChart3,
  Layers, Play, Flag, Loader2, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { TASK_STATUS_LABELS, ROLE_LABELS } from '@/lib/constants';
import type { SprintStatus, TaskStatus } from '@/types/database';

const STATUS_CONFIG: Record<SprintStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  planning:  { label: 'Planning',   variant: 'secondary' },
  active:    { label: 'Active',     variant: 'default' },
  completed: { label: 'Completed',  variant: 'outline' },
  cancelled: { label: 'Cancelled',  variant: 'destructive' },
};

const TASK_STATUS_COLORS: Partial<Record<TaskStatus, string>> = {
  backlog:               'bg-muted text-muted-foreground',
  in_progress:           'bg-blue-500/15 text-blue-400',
  waiting_for_assets:    'bg-yellow-500/15 text-yellow-400',
  submitted_for_review:  'bg-purple-500/15 text-purple-400',
  under_review:          'bg-purple-500/15 text-purple-400',
  revision_requested:    'bg-orange-500/15 text-orange-400',
  qa:                    'bg-indigo-500/15 text-indigo-400',
  approved:              'bg-green-500/15 text-green-400',
  rejected_by_lead:      'bg-red-500/15 text-red-400',
  done:                  'bg-green-500/15 text-green-400',
};

export default function SprintDetailPage() {
  const { sprintId } = useParams<{ sprintId: string }>();
  const router = useRouter();

  const [sprint, setSprint] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'activate' | 'complete' | null>(null);

  const load = useCallback(async () => {
    const [sprintRes, metricsRes] = await Promise.all([
      fetch(`/api/sprints/${sprintId}`).then(r => r.json()),
      fetch(`/api/sprints/${sprintId}/metrics`).then(r => r.json()),
    ]);
    if (sprintRes.data) setSprint(sprintRes.data);
    if (metricsRes.data) setMetrics(metricsRes.data);
    setLoading(false);
  }, [sprintId]);

  useEffect(() => { load(); }, [load]);

  async function handleActivate() {
    setActionLoading('activate');
    try {
      const res = await fetch(`/api/sprints/${sprintId}/activate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed to activate'); return; }
      toast.success('Sprint activated!');
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComplete() {
    if (!confirm('Complete this sprint? Incomplete tasks will return to backlog.')) return;
    setActionLoading('complete');
    try {
      const res = await fetch(`/api/sprints/${sprintId}/complete`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed to complete'); return; }
      toast.success('Sprint completed! Evaluations will be generated.');
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Sprint not found</p>
        <Link href="/sprints" className="mt-3 inline-block">
          <Button variant="outline" size="sm">Back to Sprints</Button>
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[sprint.status as SprintStatus];

  const now = new Date();
  const end = new Date(sprint.end_date);
  const start = new Date(sprint.start_date);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - start.getTime()) / 86400000)));
  const timelinePct = Math.round((elapsedDays / totalDays) * 100);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sprints">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{sprint.name}</h1>
              <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
            </div>
            {sprint.description && (
              <p className="text-muted-foreground text-sm mt-0.5">{sprint.description}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {sprint.status === 'planning' && (
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={!!actionLoading}
              className="gap-1.5"
            >
              {actionLoading === 'activate'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Play className="w-3.5 h-3.5" />
              }
              Activate Sprint
            </Button>
          )}
          {sprint.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleComplete}
              disabled={!!actionLoading}
              className="gap-1.5"
            >
              {actionLoading === 'complete'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Flag className="w-3.5 h-3.5" />
              }
              Complete Sprint
            </Button>
          )}
          {sprint.status === 'planning' && (
            <Link href={`/sprints/${sprintId}/edit`}>
              <Button size="sm" variant="ghost">Edit</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Overview Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle2 className="w-4 h-4 text-green-400" />} label="Tasks Done" value={`${sprint.done_tasks} / ${sprint.total_tasks}`} />
        <StatCard icon={<Zap className="w-4 h-4 text-blue-400" />} label="In Progress" value={sprint.in_progress_tasks} />
        <StatCard icon={<Clock className="w-4 h-4 text-yellow-400" />} label="In Review" value={sprint.review_tasks} />
        <StatCard icon={<BarChart3 className="w-4 h-4 text-primary" />} label="Completion" value={`${sprint.completion_pct}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sprint Info */}
        <div className="space-y-4">
          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Start</p>
                  <p className="font-medium">{formatDate(sprint.start_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">End</p>
                  <p className="font-medium">{formatDate(sprint.end_date)}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Day {elapsedDays} of {totalDays}</span>
                  {sprint.status === 'active' && (
                    <span className={daysLeft <= 2 ? 'text-destructive font-medium' : ''}>
                      {daysLeft === 0 ? 'Ends today' : `${daysLeft} days left`}
                    </span>
                  )}
                </div>
                <Progress value={timelinePct} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          {/* Pods */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Pods ({sprint.pods?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(sprint.pods ?? []).map((pod: any) => (
                <Link key={pod.id} href={`/pods/${pod.id}`}>
                  <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium flex-1">{pod.name}</span>
                    {pod.is_studio_wide && (
                      <Badge variant="outline" className="text-[10px]">Studio-Wide</Badge>
                    )}
                  </div>
                </Link>
              ))}
              {!sprint.pods?.length && (
                <p className="text-xs text-muted-foreground py-2">No pods assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Completion Progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Task Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Overall completion</span>
                  <span className="font-semibold">{sprint.completion_pct}%</span>
                </div>
                <Progress value={sprint.completion_pct} className="h-2" />
              </div>
              {metrics?.status_breakdown && (
                <div className="space-y-1 pt-1">
                  {Object.entries(metrics.status_breakdown as Record<string, number>)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${TASK_STATUS_COLORS[status as TaskStatus] ?? 'bg-muted text-muted-foreground'}`}>
                          {TASK_STATUS_LABELS[status as TaskStatus] ?? status}
                        </span>
                        <span className="font-medium tabular-nums">{count as number}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Tasks + Assignees */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tasks List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tasks ({sprint.total_tasks})</CardTitle>
                <Link href={`/tasks?sprint_id=${sprintId}`}>
                  <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {sprint.tasks?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No tasks yet</p>
                  <Link href={`/tasks/new?sprint_id=${sprintId}`} className="mt-2 inline-block">
                    <Button variant="outline" size="sm" className="text-xs h-7">Add Task</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {(sprint.tasks ?? [])
                    .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))
                    .slice(0, 20)
                    .map((task: any) => (
                      <Link key={task.id} href={`/tasks/${task.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {task.title}
                            </p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${TASK_STATUS_COLORS[task.status as TaskStatus] ?? 'bg-muted text-muted-foreground'}`}>
                            {TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignee Breakdown */}
          {metrics?.by_assignee?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.by_assignee
                    .sort((a: any, b: any) => b.completion_pct - a.completion_pct)
                    .map((member: any) => (
                      <div key={member.user_id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{member.full_name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {member.done}/{member.total} done
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                              </span>
                              {member.revisions > 0 && (
                                <>
                                  <Separator orientation="vertical" className="h-2" />
                                  <span className="text-[10px] text-orange-400">{member.revisions} rev{member.revisions !== 1 ? 's' : ''}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-bold tabular-nums w-9 text-right">
                            {member.completion_pct}%
                          </span>
                        </div>
                        <Progress value={member.completion_pct} className="h-1" />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1.5">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
