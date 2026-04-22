'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Zap, Layers, LayoutGrid, List,
  Clock, AlertCircle, RotateCcw, Loader2, Plus, ChevronRight,
} from 'lucide-react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ROLE_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS, ALLOWED_TRANSITIONS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { TaskStatus, TaskType, UserRole } from '@/types/database';

const COLUMN_COLORS: Partial<Record<TaskStatus, string>> = {
  backlog:               'border-t-muted-foreground/30',
  in_progress:           'border-t-blue-500',
  waiting_for_assets:    'border-t-yellow-500',
  submitted_for_review:  'border-t-purple-500',
  under_review:          'border-t-purple-400',
  revision_requested:    'border-t-orange-500',
  qa:                    'border-t-indigo-500',
  approved:              'border-t-green-500',
  done:                  'border-t-green-400',
  rejected_by_lead:      'border-t-red-500',
};

type ViewMode = 'board' | 'overview';

export default function PodDetailPage() {
  const { podId } = useParams<{ podId: string }>();
  const [view, setView]                   = useState<ViewMode>('board');
  const [pod, setPod]                     = useState<any>(null);
  const [board, setBoard]                 = useState<any>(null);
  const [sprints, setSprints]             = useState<any[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [loading, setLoading]             = useState(true);
  const [me, setMe]                       = useState<any>(null);

  const loadBoard = useCallback(async (sprintId?: string) => {
    const params = new URLSearchParams();
    if (sprintId) params.set('sprint_id', sprintId);
    const [boardRes, podRes] = await Promise.all([
      fetch(`/api/pods/${podId}/board?${params.toString()}`).then(r => r.json()),
      fetch(`/api/pods/${podId}`).then(r => r.json()),
    ]);
    if (boardRes.data) setBoard(boardRes.data);
    if (podRes.data)   setPod(podRes.data);
    setLoading(false);
  }, [podId]);

  useEffect(() => {
    Promise.all([
      fetch('/api/users/me').then(r => r.json()),
      fetch(`/api/sprints?pod_id=${podId}`).then(r => r.json()),
    ]).then(([meRes, sprintsRes]) => {
      if (meRes.data) setMe(meRes.data);
      setSprints(sprintsRes.data ?? []);
    });
    loadBoard();
  }, [podId, loadBoard]);

  async function handleTransition(taskId: string, toStatus: TaskStatus) {
    // Optimistic update
    setBoard((prev: any) => {
      if (!prev) return prev;
      let movedTask: any = null;
      const newCols = prev.columns.map((col: any) => {
        const filtered = col.tasks.filter((t: any) => {
          if (t.id === taskId) { movedTask = { ...t, status: toStatus }; return false; }
          return true;
        });
        return { ...col, tasks: filtered };
      }).map((col: any) => {
        if (col.status === toStatus && movedTask) return { ...col, tasks: [movedTask, ...col.tasks] };
        return col;
      });
      return { ...prev, columns: newCols };
    });

    const res = await fetch(`/api/tasks/${taskId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_status: toStatus }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error?.message ?? 'Transition failed');
      loadBoard(selectedSprintId || undefined); // revert
      return;
    }
    toast.success(`Moved to ${TASK_STATUS_LABELS[toStatus]}`);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!pod) return (
    <div className="text-center py-20 text-muted-foreground">
      <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Pod not found</p>
      <Link href="/pods" className="mt-3 inline-block">
        <Button variant="outline" size="sm">Back to Pods</Button>
      </Link>
    </div>
  );

  const isManager = me && ['studio_lead', 'producer'].includes(me.role);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/pods">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{pod.name}</h1>
              {pod.is_studio_wide && <Badge variant="secondary">Studio-Wide</Badge>}
            </div>
            {pod.description && <p className="text-muted-foreground text-sm mt-0.5">{pod.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sprints.length > 0 && (
            <Select
              value={selectedSprintId || '__active__'}
              onValueChange={v => {
                const id = v === '__active__' ? '' : (v ?? '');
                setSelectedSprintId(id);
                loadBoard(id || undefined);
              }}
            >
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__active__">Active Sprint</SelectItem>
                {sprints.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center border rounded-md overflow-hidden">
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" className="rounded-none h-8 px-2.5" onClick={() => setView('board')}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button variant={view === 'overview' ? 'secondary' : 'ghost'} size="sm" className="rounded-none h-8 px-2.5" onClick={() => setView('overview')}>
              <List className="w-3.5 h-3.5" />
            </Button>
          </div>

          {isManager && (
            <Link href={`/tasks/new?pod_id=${podId}&sprint_id=${board?.sprint?.id ?? ''}`}>
              <Button size="sm" className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Add Task
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Sprint info bar */}
      {board?.sprint && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-card border rounded-lg px-4 py-2.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-foreground">{board.sprint.name}</span>
          <Badge variant={board.sprint.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{board.sprint.status}</Badge>
          <span>{formatDate(board.sprint.start_date)} → {formatDate(board.sprint.end_date)}</span>
          <span className="ml-auto">{board.total_tasks} tasks</span>
          <Link href={`/sprints/${board.sprint.id}`}>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">View Sprint <ChevronRight className="w-3 h-3" /></Button>
          </Link>
        </div>
      )}

      {!board?.sprint && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 border rounded-lg px-4 py-2.5">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>No active sprint for this pod.</span>
          {isManager && <Link href="/sprints/new"><Button variant="outline" size="sm" className="h-6 text-xs ml-2">Create Sprint</Button></Link>}
        </div>
      )}

      {view === 'board' ? (
        <KanbanBoard columns={board?.columns ?? []} me={me} onTransition={handleTransition} />
      ) : (
        <OverviewTab pod={pod} board={board} />
      )}
    </div>
  );
}

/* ─── Kanban Board with DnD ─────────────────────────────────── */
function KanbanBoard({ columns, me, onTransition }: {
  columns: any[];
  me: any;
  onTransition: (taskId: string, to: TaskStatus) => void;
}) {
  const [activeTask, setActiveTask] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Build a task lookup map
  const taskMap: Record<string, any> = {};
  for (const col of columns) for (const t of col.tasks) taskMap[t.id] = t;

  // Build a status lookup map (taskId -> current status)
  const taskStatus: Record<string, TaskStatus> = {};
  for (const col of columns) for (const t of col.tasks) taskStatus[t.id] = col.status;

  function onDragStart(event: DragStartEvent) {
    setActiveTask(taskMap[event.active.id as string] ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId    = active.id as string;
    const toStatus  = over.id as TaskStatus;
    const fromStatus = taskStatus[taskId];

    if (!toStatus || toStatus === fromStatus) return;

    // Check if this transition is allowed
    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      toast.error(`Cannot move from ${TASK_STATUS_LABELS[fromStatus]} to ${TASK_STATUS_LABELS[toStatus]}`);
      return;
    }

    onTransition(taskId, toStatus);
  }

  if (!columns.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No tasks to display</p>
    </div>
  );

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {columns.map((col: any) => (
          <KanbanColumn key={col.status} column={col} me={me} onTransition={onTransition} isDragging={!!activeTask} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <CardPreview task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Droppable Column ───────────────────────────────────────── */
function KanbanColumn({ column, me, onTransition, isDragging }: {
  column: any; me: any;
  onTransition: (taskId: string, to: TaskStatus) => void;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const borderColor = COLUMN_COLORS[column.status as TaskStatus] ?? 'border-t-border';

  return (
    <div
      ref={setNodeRef}
      className={`flex-none w-[280px] bg-card border rounded-xl flex flex-col border-t-2 transition-colors ${borderColor} ${isOver ? 'ring-2 ring-primary/40 bg-primary/5' : ''}`}
    >
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{column.label}</span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-medium tabular-nums">
            {column.tasks.length}
          </span>
        </div>
        {isOver && <span className="text-[10px] text-primary font-medium">Drop here</span>}
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[80px]">
        {column.tasks.length === 0 ? (
          <div className={`py-6 text-center text-[11px] rounded-lg transition-colors ${isDragging ? 'border-2 border-dashed border-primary/20 text-primary/40' : 'text-muted-foreground opacity-60'}`}>
            {isDragging ? 'Drop here' : 'Empty'}
          </div>
        ) : (
          column.tasks.map((task: any) => (
            <KanbanCard key={task.id} task={task} me={me} onTransition={onTransition} />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Draggable Card ─────────────────────────────────────────── */
function KanbanCard({ task, me, onTransition }: {
  task: any; me: any;
  onTransition: (taskId: string, to: TaskStatus) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isManager  = me && ['studio_lead', 'producer'].includes(me.role);
  const isAssignee = me && task.assigned_to === me.id;
  const canTransition = isManager || isAssignee;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };

  const available = canTransition ? (ALLOWED_TRANSITIONS[task.status as TaskStatus] ?? []) : [];

  return (
    <div ref={setNodeRef} style={style}>
      <Link href={`/tasks/${task.id}`}>
        <div
          className={`bg-background border rounded-lg p-3 space-y-2.5 hover:border-primary/40 transition-colors group ${canTransition ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
          {...(canTransition ? { ...listeners, ...attributes } : {})}
        >
          {/* Drag handle hint */}
          {canTransition && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-muted-foreground truncate">
                {TASK_TYPE_LABELS[task.task_type as TaskType]}
              </span>
              <div className="flex items-center gap-1.5">
                {task.priority >= 1 && (
                  <span className={`text-[10px] font-medium shrink-0 ${task.priority >= 2 ? 'text-destructive' : 'text-orange-400'}`}>
                    {task.priority >= 2 ? '●●' : '●'}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/40 select-none">⠿</span>
              </div>
            </div>
          )}

          {!canTransition && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-muted-foreground truncate">
                {TASK_TYPE_LABELS[task.task_type as TaskType]}
              </span>
            </div>
          )}

          <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {task.title}
          </p>

          <div className="flex items-center justify-between gap-2">
            {task.assignee ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="text-[8px]">
                    {task.assignee.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground truncate">{task.assignee.full_name.split(' ')[0]}</span>
              </div>
            ) : <div />}

            <div className="flex items-center gap-1.5 shrink-0">
              {task.revision_count > 0 && (
                <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                  <RotateCcw className="w-2.5 h-2.5" />{task.revision_count}
                </span>
              )}
              {task.is_overdue && <AlertCircle className="w-3 h-3 text-destructive" />}
              {task.deadline && (
                <span className={`text-[10px] flex items-center gap-0.5 ${task.is_overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(task.deadline).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* Quick transition buttons */}
          {available.length > 0 && showActions && (
            <div className="flex flex-wrap gap-1 pt-1 border-t" onClick={e => e.preventDefault()}>
              {available.slice(0, 2).map((t: TaskStatus) => (
                <button
                  key={t}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onTransition(task.id, t); }}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors hover:opacity-80
                    ${t === 'rejected_by_lead' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : t === 'approved' || t === 'done' ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                    : 'border-primary/30 text-primary hover:bg-primary/10'}`}
                >
                  → {TASK_STATUS_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

/* ─── Drag Overlay Preview ───────────────────────────────────── */
function CardPreview({ task }: { task: any }) {
  return (
    <div className="bg-background border border-primary/40 rounded-lg p-3 w-[272px] shadow-xl opacity-95 rotate-1">
      <p className="text-[10px] text-muted-foreground">{TASK_TYPE_LABELS[task.task_type as TaskType]}</p>
      <p className="text-xs font-medium mt-1 leading-snug line-clamp-2">{task.title}</p>
    </div>
  );
}

/* ─── Overview Tab ───────────────────────────────────────────── */
function OverviewTab({ pod, board }: { pod: any; board: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Members ({pod.members?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(pod.members ?? []).map((member: any) => (
            <Link key={member.id} href={`/team/${member.id}`}>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs font-semibold">
                    {member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.role as UserRole]}</p>
                </div>
              </div>
            </Link>
          ))}
          {!pod.members?.length && <p className="text-sm text-muted-foreground text-center py-4">No members</p>}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            {board?.sprint ? 'Sprint Summary' : 'No Active Sprint'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {board?.sprint ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(board.columns ?? []).map((col: any) => (
                  <div key={col.status} className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{col.tasks.length}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{col.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{board.total_tasks} total tasks</span>
                <span>·</span>
                <span>{formatDate(board.sprint.start_date)} → {formatDate(board.sprint.end_date)}</span>
              </div>
              <Link href={`/sprints/${board.sprint.id}`}>
                <Button variant="outline" size="sm">View Full Sprint</Button>
              </Link>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active sprint</p>
              <Link href="/sprints/new" className="mt-3 inline-block">
                <Button variant="outline" size="sm">Create Sprint</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
