'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Plus, CheckSquare, Clock, AlertCircle, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { TaskStatus, TaskType } from '@/types/database';

const STATUS_COLORS: Record<TaskStatus, string> = {
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

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Normal',   color: 'text-muted-foreground' },
  1: { label: 'High',     color: 'text-orange-400' },
  2: { label: 'Critical', color: 'text-destructive' },
};

function TasksContent() {
  const searchParams = useSearchParams();
  const defaultSprint = searchParams.get('sprint_id') ?? '';

  const [tasks, setTasks] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sprintFilter, setSprintFilter] = useState(defaultSprint || 'all');

  // Load sprints for filter dropdown
  useEffect(() => {
    fetch('/api/sprints').then(r => r.json()).then(json => setSprints(json.data ?? []));
  }, []);

  const loadTasks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('task_type', typeFilter);
    if (sprintFilter !== 'all') params.set('sprint_id', sprintFilter);

    fetch(`/api/tasks?${params.toString()}`)
      .then(r => r.json())
      .then(json => setTasks(json.data ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, sprintFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const filtered = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/tasks/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'all')}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sprintFilter} onValueChange={v => setSprintFilter(v ?? 'all')}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Sprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sprints</SelectItem>
            {sprints.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter !== 'all' || typeFilter !== 'all' || sprintFilter !== 'all' || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-9 text-xs"
            onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSprintFilter('all'); setSearch(''); }}
          >
            <Filter className="w-3 h-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-16 pt-4" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No tasks found</p>
          <p className="text-xs mt-1">
            {search || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first task to get started'}
          </p>
          {!search && statusFilter === 'all' && typeFilter === 'all' && (
            <Link href="/tasks/new" className="mt-4 inline-block">
              <Button size="sm" variant="outline">Create Task</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(task => <TaskRow key={task.id} task={task} />)}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: any }) {
  const priConfig = PRIORITY_LABELS[task.priority as number] ?? PRIORITY_LABELS[0];
  const isOverdue = task.deadline && !['done', 'approved', 'rejected_by_lead'].includes(task.status)
    && new Date(task.deadline) < new Date();

  return (
    <Link href={`/tasks/${task.id}`}>
      <Card className="hover:border-primary/40 transition-colors cursor-pointer">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            {/* Priority dot */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              task.priority >= 2 ? 'bg-destructive' :
              task.priority === 1 ? 'bg-orange-400' :
              'bg-muted-foreground/30'
            }`} />

            {/* Title + type */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{task.title}</p>
                {isOverdue && (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {TASK_TYPE_LABELS[task.task_type as TaskType]}
                </span>
                {task.sprint && (
                  <>
                    <span className="text-muted-foreground/30 text-[10px]">·</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {task.sprint?.name ?? ''}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Assignee */}
            {task.assignee && (
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[9px]">
                    {task.assignee.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground max-w-[100px] truncate">{task.assignee.full_name}</span>
              </div>
            )}

            {/* Deadline */}
            {task.deadline && (
              <div className={`hidden md:flex items-center gap-1 text-xs shrink-0 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Clock className="w-3 h-3" />
                {formatDate(task.deadline)}
              </div>
            )}

            {/* Status */}
            <Badge className={`shrink-0 text-[10px] px-1.5 py-0.5 border-0 ${STATUS_COLORS[task.status as TaskStatus]}`}>
              {TASK_STATUS_LABELS[task.status as TaskStatus]}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-muted-foreground text-sm">Loading...</div>}>
      <TasksContent />
    </Suspense>
  );
}
