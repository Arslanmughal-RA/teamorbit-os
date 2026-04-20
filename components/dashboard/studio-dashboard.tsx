'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Zap, CheckSquare, AlertCircle, Clock,
  TrendingUp, TrendingDown, Minus, BarChart2,
  Layers, ChevronRight, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { TASK_STATUS_LABELS, ROLE_LABELS } from '@/lib/constants';
import { formatDate, getGreeting } from '@/lib/utils';
import type { TaskStatus, PerformanceTier, UserRole } from '@/types/database';
import type { User } from '@/types/database';

const TIER_ICONS: Record<PerformanceTier, React.ReactNode> = {
  excellent:  <TrendingUp className="w-3 h-3 text-green-400" />,
  acceptable: <Minus className="w-3 h-3 text-blue-400" />,
  concerning: <TrendingDown className="w-3 h-3 text-red-400" />,
};

const TIER_COLORS: Record<PerformanceTier, string> = {
  excellent:  'text-green-400',
  acceptable: 'text-blue-400',
  concerning: 'text-red-400',
};

const STATUS_COLORS: Partial<Record<TaskStatus, string>> = {
  in_progress:          'bg-blue-500/15 text-blue-400',
  submitted_for_review: 'bg-purple-500/15 text-purple-400',
  under_review:         'bg-purple-500/15 text-purple-400',
  waiting_for_assets:   'bg-yellow-500/15 text-yellow-400',
  revision_requested:   'bg-orange-500/15 text-orange-400',
  qa:                   'bg-indigo-500/15 text-indigo-400',
  backlog:              'bg-muted text-muted-foreground',
};

export function StudioDashboard({ user }: { user: User }) {
  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/studio/stats')
      .then(r => r.json())
      .then(j => setStats(j.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const d = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, {user.full_name.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Studio overview — {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="w-4 h-4 text-primary" />}       label="Active Members"    value={d?.total_users ?? '—'}      href="/team" />
        <KpiCard icon={<Zap className="w-4 h-4 text-blue-400" />}        label="Active Sprints"    value={d?.active_sprints?.length ?? '—'} href="/sprints" />
        <KpiCard icon={<CheckSquare className="w-4 h-4 text-muted-foreground" />} label="Open Tasks" value={d?.open_tasks ?? '—'} href="/tasks" />
        <KpiCard
          icon={<AlertCircle className="w-4 h-4 text-destructive" />}
          label="Overdue Tasks"
          value={d?.overdue_tasks?.length ?? '—'}
          href="/tasks"
          highlight={(d?.overdue_tasks?.length ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="xl:col-span-2 space-y-6">
          {/* Active Sprints */}
          {d?.active_sprints?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Active Sprints
                  </CardTitle>
                  <Link href="/sprints">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      All <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {d.active_sprints.map((sprint: any) => {
                  const pct = sprint.total_tasks > 0
                    ? Math.round((sprint.done_tasks / sprint.total_tasks) * 100)
                    : 0;
                  return (
                    <Link key={sprint.id} href={`/sprints/${sprint.id}`}>
                      <div className="space-y-2 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{sprint.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{sprint.done_tasks}/{sprint.total_tasks} tasks</span>
                            <span className={sprint.days_left <= 2 ? 'text-destructive font-medium' : ''}>
                              {sprint.days_left === 0 ? 'Ends today' : `${sprint.days_left}d left`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={pct} className="flex-1 h-2" />
                          <span className="text-xs font-semibold tabular-nums w-9 text-right">{pct}%</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Overdue Tasks */}
          {d?.overdue_tasks?.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Overdue Tasks ({d.overdue_tasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {d.overdue_tasks.slice(0, 8).map((task: any) => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                        <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.assignee?.full_name ?? '—'} · due {formatDate(task.deadline)}
                          </p>
                        </div>
                        <span className="text-xs text-destructive font-medium shrink-0">
                          {Math.ceil((new Date().getTime() - new Date(task.deadline).getTime()) / 86400000)}d late
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Review */}
          {(d?.pending_review ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    Awaiting Review ({d.pending_review})
                  </CardTitle>
                  <Link href="/tasks?status=submitted_for_review">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      View All <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {d.pending_review} task{d.pending_review !== 1 ? 's' : ''} waiting for review or QA approval.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">
          {/* Task Status Breakdown */}
          {d?.status_breakdown && Object.keys(d.status_breakdown).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" /> Task Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(d.status_breakdown as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLORS[status as TaskStatus] ?? 'bg-muted text-muted-foreground'}`}>
                        {TASK_STATUS_LABELS[status as TaskStatus] ?? status}
                      </span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Evaluation Tier Distribution */}
          {d?.tier_distribution && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Evaluations
                  </CardTitle>
                  <Link href="/evaluations">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      View <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(Object.entries(d.tier_distribution) as [string, number][])
                  .filter(([, v]) => v > 0)
                  .map(([tier, count]) => (
                    <div key={tier} className="flex items-center gap-2 text-xs">
                      {tier !== 'unscored' ? TIER_ICONS[tier as PerformanceTier] : <Minus className="w-3 h-3 text-muted-foreground" />}
                      <span className={`capitalize flex-1 ${tier !== 'unscored' ? TIER_COLORS[tier as PerformanceTier] : 'text-muted-foreground'}`}>
                        {tier}
                      </span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  ))}
                {d.evaluations?.filter((e: any) => !e.is_finalized).length > 0 && (
                  <p className="text-[10px] text-muted-foreground pt-1 border-t">
                    {d.evaluations.filter((e: any) => !e.is_finalized).length} pending review
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Team Load */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Team Load
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(d?.team_load ?? []).slice(0, 8).map((member: any) => (
                <Link key={member.id} href={`/team/${member.id}`}>
                  <div className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="text-[9px]">
                        {member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{member.full_name.split(' ')[0]}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums ml-1">
                          {member.open_tasks} task{member.open_tasks !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (member.open_tasks / 10) * 100)}
                        className={`h-1 ${member.open_tasks > 7 ? '[&>div]:bg-destructive' : member.open_tasks > 4 ? '[&>div]:bg-yellow-500' : ''}`}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, href, highlight }: {
  icon: React.ReactNode; label: string; value: string | number; href?: string; highlight?: boolean;
}) {
  const card = (
    <Card className={`transition-colors ${href ? 'hover:border-primary/40 cursor-pointer' : ''} ${highlight ? 'border-destructive/30' : ''}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className={`text-3xl font-bold tabular-nums ${highlight ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
