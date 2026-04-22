'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Layers, Zap, AlertCircle, Loader2, Plus, X,
  Clock, RotateCcw, ImageIcon, Upload,
} from 'lucide-react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import {
  TASK_STATUS_LABELS, TASK_TYPE_LABELS, ALLOWED_TRANSITIONS, ROLE_LABELS,
} from '@/lib/constants';
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

const ALL_STATUSES: TaskStatus[] = [
  'backlog', 'in_progress', 'waiting_for_assets', 'submitted_for_review',
  'under_review', 'revision_requested', 'qa', 'approved', 'done',
];

export default function ProjectKanbanPage() {
  const { podId, sprintId } = useParams<{ podId: string; sprintId: string }>();
  const [board, setBoard]   = useState<any>(null);
  const [pod, setPod]       = useState<any>(null);
  const [me, setMe]         = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const loadBoard = useCallback(async () => {
    const [boardRes, podRes] = await Promise.all([
      fetch(`/api/pods/${podId}/board?sprint_id=${sprintId}`).then(r => r.json()),
      fetch(`/api/pods/${podId}`).then(r => r.json()),
    ]);
    if (boardRes.data) setBoard(boardRes.data);
    if (podRes.data)   setPod(podRes.data);
    setLoading(false);
  }, [podId, sprintId]);

  useEffect(() => {
    fetch('/api/users/me').then(r => r.json()).then(json => {
      if (json.data) setMe(json.data);
    });
    loadBoard();
  }, [loadBoard]);

  async function handleTransition(taskId: string, toStatus: TaskStatus) {
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
      loadBoard();
      return;
    }
    toast.success(`Moved to ${TASK_STATUS_LABELS[toStatus]}`);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const sprint = board?.sprint;
  const isManager = me && ['studio_lead', 'producer'].includes(me.role);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/pods/${podId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/pods" className="text-muted-foreground text-xs hover:text-foreground transition-colors">Pods</Link>
              <span className="text-muted-foreground text-xs">/</span>
              <Link href={`/pods/${podId}`} className="text-muted-foreground text-xs hover:text-foreground transition-colors">
                {pod?.name ?? '…'}
              </Link>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-xs font-medium">{sprint?.name ?? 'Project'}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight mt-0.5">{sprint?.name ?? 'Loading…'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setAddTaskOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Task
          </Button>
        </div>
      </div>

      {/* Sprint info bar */}
      {sprint && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-card border rounded-lg px-4 py-2.5 flex-wrap">
          <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
          <Badge
            variant={sprint.status === 'active' ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {sprint.status}
          </Badge>
          <span>{formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}</span>
          <span className="ml-auto">{board?.total_tasks ?? 0} tasks</span>
          {isManager && (
            <Link href={`/sprints/${sprintId}`}>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">
                Sprint Settings
              </Button>
            </Link>
          )}
        </div>
      )}

      {!sprint && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 border rounded-lg px-4 py-2.5">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Project not found or not linked to this pod.</span>
        </div>
      )}

      <KanbanBoard
        columns={board?.columns ?? []}
        me={me}
        onTransition={handleTransition}
      />

      {addTaskOpen && (
        <AddTaskDialog
          podId={podId}
          sprintId={sprintId}
          users={pod?.members ?? []}
          me={me}
          onClose={() => setAddTaskOpen(false)}
          onCreated={() => { loadBoard(); setAddTaskOpen(false); }}
        />
      )}
    </div>
  );
}

/* ─── Add Task Dialog ────────────────────────────────────────── */
function AddTaskDialog({
  podId, sprintId, users, me, onClose, onCreated,
}: {
  podId: string; sprintId: string; users: any[]; me: any;
  onClose: () => void; onCreated: () => void;
}) {
  const isManager = me && ['studio_lead', 'producer'].includes(me.role);
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type: '' as TaskType | '',
    assigned_to: isManager ? '' : (me?.id ?? ''),
    status: 'backlog' as TaskStatus,
    priority: '0',
    eta_hours: '',
    deadline: '',
    work_link: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(json => {
      setAllUsers(json.data ?? []);
    });
  }, []);

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...selected]);
    const newPreviews = selected.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = '';
  }

  function removeFile(idx: number) {
    URL.revokeObjectURL(previews[idx]);
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadFiles(taskId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('task_id', taskId);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok && json.data?.url) urls.push(json.data.url);
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim())  { toast.error('Title is required'); return; }
    if (!form.task_type)     { toast.error('Task type is required'); return; }
    if (!form.assigned_to)   { toast.error('Assignee is required'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description || undefined,
        task_type: form.task_type,
        assigned_to: form.assigned_to,
        sprint_id: sprintId,
        pod_id: podId,
        status: form.status,
        priority: Number(form.priority),
        work_link: form.work_link || undefined,
      };
      if (form.eta_hours) payload.eta_hours = Number(form.eta_hours);
      if (form.deadline)  payload.deadline = form.deadline;

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }

      const taskId = json.data.id;

      // Upload images if any
      if (files.length > 0) {
        const urls = await uploadFiles(taskId);
        if (urls.length > 0) {
          await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachments: urls }),
          });
        }
      }

      toast.success('Task created!');
      onCreated();
    } catch {
      toast.error('Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  const displayUsers = allUsers.length > 0 ? allUsers : users;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Title <span className="text-destructive">*</span></Label>
            <Input
              placeholder="What needs to be done?"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Description</Label>
            <Textarea
              placeholder="Details, references, acceptance criteria..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="min-h-[70px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Task Type <span className="text-destructive">*</span></Label>
              <Select value={form.task_type} onValueChange={v => set('task_type', v ?? '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Initial Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v ?? 'backlog')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Assignee <span className="text-destructive">*</span></Label>
              <Select
                value={form.assigned_to}
                onValueChange={v => set('assigned_to', v ?? '')}
                disabled={!isManager}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  {displayUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Priority</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v ?? '0')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Normal</SelectItem>
                  <SelectItem value="1">High</SelectItem>
                  <SelectItem value="2">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">ETA (hours)</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 8"
                value={form.eta_hours}
                onChange={e => set('eta_hours', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={e => set('deadline', e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Work Link</Label>
            <Input
              placeholder="https://figma.com/..."
              value={form.work_link}
              onChange={e => set('work_link', e.target.value)}
              className="h-9"
            />
          </div>

          {/* Image Attachments */}
          <div className="space-y-2">
            <Label className="text-sm">Attachments</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={src}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed rounded-lg px-3 py-2 hover:border-primary/50 hover:text-primary transition-colors w-full justify-center"
            >
              <Upload className="w-3.5 h-3.5" />
              {files.length > 0 ? `${files.length} image${files.length > 1 ? 's' : ''} selected — click to add more` : 'Upload images'}
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Creating…' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Kanban Board with DnD ─────────────────────────────────── */
function KanbanBoard({ columns, me, onTransition }: {
  columns: any[];
  me: any;
  onTransition: (taskId: string, to: TaskStatus) => void;
}) {
  const [activeTask, setActiveTask] = useState<any>(null);
  const [validDropTargets, setValidDropTargets] = useState<TaskStatus[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const taskMap: Record<string, any> = {};
  for (const col of columns) for (const t of col.tasks) taskMap[t.id] = t;

  const taskStatus: Record<string, TaskStatus> = {};
  for (const col of columns) for (const t of col.tasks) taskStatus[t.id] = col.status;

  function onDragStart(event: DragStartEvent) {
    const task = taskMap[event.active.id as string] ?? null;
    setActiveTask(task);
    if (task) {
      setValidDropTargets(
        Object.keys(ALLOWED_TRANSITIONS).filter(s => s !== taskStatus[task.id]) as TaskStatus[]
      );
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    setValidDropTargets([]);
    const { active, over } = event;
    if (!over) return;
    const taskId     = active.id as string;
    const toStatus   = over.id as TaskStatus;
    const fromStatus = taskStatus[taskId];
    if (!toStatus || toStatus === fromStatus) return;
    onTransition(taskId, toStatus);
  }

  if (!columns.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No tasks yet</p>
    </div>
  );

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {columns.map((col: any) => (
          <KanbanColumn
            key={col.status}
            column={col}
            me={me}
            onTransition={onTransition}
            isDragging={!!activeTask}
            isValidTarget={validDropTargets.includes(col.status)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <CardPreview task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Droppable Column ───────────────────────────────────────── */
function KanbanColumn({ column, me, onTransition, isDragging, isValidTarget }: {
  column: any; me: any;
  onTransition: (taskId: string, to: TaskStatus) => void;
  isDragging: boolean;
  isValidTarget: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const borderColor = COLUMN_COLORS[column.status as TaskStatus] ?? 'border-t-border';

  const containerClass = cn(
    'flex-none w-[280px] bg-card border rounded-xl flex flex-col border-t-2 transition-all',
    borderColor,
    isDragging && !isValidTarget && 'opacity-40',
    isDragging && isValidTarget && 'ring-2 ring-primary/50 scale-[1.01]',
    isOver && isValidTarget && 'ring-2 ring-primary bg-primary/5',
  );

  return (
    <div ref={setNodeRef} className={containerClass}>
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{column.label}</span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-medium tabular-nums">
            {column.tasks.length}
          </span>
        </div>
        {isDragging && isValidTarget && (
          <span className="text-[10px] text-primary font-medium animate-pulse">Drop here ↓</span>
        )}
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[80px]">
        {column.tasks.length === 0 ? (
          <div className={cn(
            'py-6 text-center text-[11px] rounded-lg transition-colors',
            isDragging && isValidTarget
              ? 'border-2 border-dashed border-primary/40 text-primary/60'
              : 'text-muted-foreground opacity-60'
          )}>
            {isDragging && isValidTarget ? '↓ Drop here' : 'Empty'}
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
              {task.attachments?.length > 0 && (
                <ImageIcon className="w-2.5 h-2.5 text-muted-foreground/60" />
              )}
              {canTransition && (
                <span className="text-[10px] text-muted-foreground/40 select-none">⠿</span>
              )}
            </div>
          </div>

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
