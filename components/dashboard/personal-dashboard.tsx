'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare, Clock, AlertCircle, RotateCcw,
  Zap, BarChart2, ChevronRight, Loader2, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/lib/constants';
import { formatDate, getGreeting } from '@/lib/utils';
import type { TaskStatus, TaskType, PerformanceTier } from '@/types/database';
import type { User } from '@/types/database';

const STATUS_COLORS: Partial<Record<TaskStatus, string>> = {
  backlog:               'bg-muted text-muted-foreground',
  in_progress:           'bg-blue-500/15 text-blue-400',
  waiting_for_assets:    'bg-yellow-500/15 text-yellow-400',
  submitted_for_review:  'bg-purple-500/15 text-purple-400',
  under_review:          'bg-purple-500/15 text-purple-400',
  revision_requested:    'bg-orange-500/15 text-orange-400',
  qa:                    'bg-indigo-500/15 text-indigo-400',
  approved:              'bg-green-500/15 text-green-400',
  done:                  'bg-green-500/15 text-green-400',
  rejected_by_lead:      'bg-red-500/15 text-red-400',
};

const TIER_LABELS: Record<PerformanceTier, { label: string; color: string }> = {
  excellent:  { label: 'Excellent',  color: 'text-green-400' },
  acceptable: { label: 'Acceptable', color: 'text-blue-400'  },
  concerning: { label: 'Concerning', color: 'text-red-400'   },
};

export function PersonalDashboard({ user }: { user: User }) {
  const [tasks, setTasks]             = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/evaluations').then(r => r.json()),
    ]).then(([taskRes, evalRes]) => {
      setTasks(taskRes.data ?? []);
      setEvaluations(evalRes.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const openTasks    = tasks.filter(t => !['done', 'approved', 'rejected_by_lead'].includes(t.status));
  const inProgress   = tasks.filter(t => t.status === 'in_progress');
  const inReview     = tasks.filter(t => ['submitted_for_review', 'under_review', 'qa'].includes(t.status));
  const overdue      = tasks.filter(t =>
    t.deadline && !['done', 'approved', 'rejected_by_lead'].includes(t.status)
    && new Date(t.deadline) < new Date()
  );
  const revisionNeeded = tasks.filter(t => t.status === 'revision_requested');

  const today = new Date().toISOString().slice(0, 10);
  const dueToday = tasks.filter(t =>
    t.deadline?.slice(0, 10) === today && !['done', 'approved', 'rejected_by_lead'].includes(t.status)
  );

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, {user.full_name.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Alert banners */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-destructive font-medium">
            {overdue.length} overdue task{overdue.length !== 1 ? 's' : ''}
          </span>
          <Link href="/tasks" className="ml-auto">
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1">
              View <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}

      {revisionNeeded.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm">
          <RotateCcw className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-orange-400 font-medium">
            {revisionNeeded.length} revision{revisionNeeded.length !== 1 ? 's' : ''} requested
          </span>
          <Link href="/tasks?status=revision_requested" className="ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs border-orange-500/30 text-orange-400 gap-1">
              View <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <PersonalKpi icon={<CheckSquare className="w-4 h-4 text-primary" />}        label="Open Tasks"   value={openTasks.length}    href="/tasks" />
        <PersonalKpi icon={<Zap className="w-4 h-4 text-blue-400" />}              label="In Progress"  value={inProgress.length}   href="/tasks?status=in_progress" />
        <PersonalKpi icon={<Clock className="w-4 h-4 text-purple-400" />}          label="In Review"    value={inReview.length}     href="/tasks?status=submitted_for_review" />
        <PersonalKpi icon={<AlertCircle className="w-4 h-4 text-destructive" />}   label="Overdue"      value={overdue.length}      href="/tasks" highlight={overdue.length > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Due today */}
          {dueToday.length > 0 && (
            <Card className="border-yellow-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-400" /> Due Today ({dueToday.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {dueToday.map(task => <TaskRow key={task.id} task={task} />)}
              </CardContent>
            </Card>
          )}

          {/* Active tasks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  My Tasks ({openTasks.length})
                </CardTitle>
                <Link href="/tasks">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    All <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {openTasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckSquare className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">All caught up! No open tasks.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {openTasks
                    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
                    .slice(0, 10)
                    .map(task => <TaskRow key={task.id} task={task} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Latest evaluations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" /> My Evaluations
                </CardTitle>
                <Link href="/evaluations">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    All <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {evaluations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No evaluations yet. Complete a sprint to get your first review.
                </p>
              ) : (
                <div className="space-y-3">
                  {evaluations.slice(0, 3).map((ev: any) => (
                    <Link key={ev.id} href={`/evaluations/${ev.id}`}>
                      <div className="p-2.5 rounded-lg border hover:border-primary/40 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-medium truncate">{ev.sprint?.name ?? 'Unknown sprint'}</p>
                          {ev.performance_tier ? (
                            <span className={`text-[10px] font-semibold ${TIER_LABELS[ev.performance_tier as PerformanceTier]?.color}`}>
                              {TIER_LABELS[ev.performance_tier as PerformanceTier]?.label}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Pending</span>
                          )}
                        </div>
                        {ev.sprint_completion_rate !== null && (
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Completion</span>
                              <span className="font-medium">{ev.sprint_completion_rate}%</span>
                            </div>
                            <Progress value={ev.sprint_completion_rate} className="h-1" />
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PersonalKpi({ icon, label, value, href, highlight }: {
  icon: React.ReactNode; label: string; value: number; href?: string; highlight?: boolean;
}) {
  const card = (
    <Card className={`transition-colors ${href ? 'hover:border-primary/40 cursor-pointer' : ''} ${highlight ? 'border-destructive/30' : ''}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
        <p className={`text-3xl font-bold ${highlight ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function TaskRow({ task }: { task: any }) {
  const isOverdue = task.deadline && !['done', 'approved', 'rejected_by_lead'].includes(task.status)
    && new Date(task.deadline) < new Date();

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors group">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          task.priority >= 2 ? 'bg-destructive' : task.priority === 1 ? 'bg-orange-400' : 'bg-muted-foreground/30'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{task.title}</p>
          <p className="text-[10px] text-muted-foreground">{TASK_TYPE_LABELS[task.task_type as TaskType]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
          {task.deadline && (
            <span className={`text-[10px] ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {formatDate(task.deadline)}
            </span>
          )}
          <Badge className={`text-[10px] border-0 px-1.5 ${STATUS_COLORS[task.status as TaskStatus] ?? 'bg-muted text-muted-foreground'}`}>
            {TASK_STATUS_LABELS[task.status as TaskStatus]}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
