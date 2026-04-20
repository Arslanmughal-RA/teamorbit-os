'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Clock, User, Layers, Zap, Link2,
  Tag, AlertCircle, Loader2, History, FileText,
  RotateCcw, Edit, Plus, ChevronRight, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  TASK_STATUS_LABELS, TASK_TYPE_LABELS, ROLE_LABELS,
  ALLOWED_TRANSITIONS,
} from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { TaskStatus, TaskType, RevisionReason, AccountabilityTag, DeadlineMissReason } from '@/types/database';

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

const TRANSITION_LABELS: Partial<Record<TaskStatus, string>> = {
  in_progress:          'Start Working',
  submitted_for_review: 'Submit for Review',
  waiting_for_assets:   'Mark Waiting for Assets',
  under_review:         'Begin Review',
  revision_requested:   'Request Revision',
  qa:                   'Move to QA',
  approved:             'Approve',
  rejected_by_lead:     'Reject',
  done:                 'Mark Done',
};

const REVISION_REASONS: { value: RevisionReason; label: string }[] = [
  { value: 'quality_issue',               label: 'Quality Issue' },
  { value: 'brief_unclear',               label: 'Brief Unclear' },
  { value: 'scope_changed',               label: 'Scope Changed' },
  { value: 'creative_direction_change',   label: 'Creative Direction Change' },
  { value: 'technical_issue',             label: 'Technical Issue' },
  { value: 'doesnt_match_reference',      label: "Doesn't Match Reference" },
  { value: 'performance_issue',           label: 'Performance Issue' },
];

const DEADLINE_MISS_REASONS: { value: DeadlineMissReason; label: string }[] = [
  { value: 'underestimated_complexity',  label: 'Underestimated Complexity' },
  { value: 'blocked_by_dependency',      label: 'Blocked by Dependency' },
  { value: 'scope_expanded',             label: 'Scope Expanded' },
  { value: 'pulled_to_urgent_task',      label: 'Pulled to Urgent Task' },
  { value: 'personal_sick_day',          label: 'Personal / Sick Day' },
  { value: 'tool_environment_issue',     label: 'Tool / Environment Issue' },
];

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [transitionDialog, setTransitionDialog] = useState<TaskStatus | null>(null);
  const [revisionDialog, setRevisionDialog] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  const [deadlineMissDialog, setDeadlineMissDialog] = useState(false);

  const [transitionNote, setTransitionNote] = useState('');
  const [revisionForm, setRevisionForm] = useState({ reason: '' as RevisionReason | '', accountability: '' as AccountabilityTag | '', notes: '' });
  const [noteForm, setNoteForm] = useState({ note: '', is_blocking: false });
  const [deadlineMissForm, setDeadlineMissForm] = useState({ reason: '' as DeadlineMissReason | '', accountability: '' as AccountabilityTag | '', notes: '', actual_hours: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [taskRes, meRes] = await Promise.all([
      fetch(`/api/tasks/${taskId}`).then(r => r.json()),
      fetch('/api/users/me').then(r => r.json()),
    ]);
    if (taskRes.data) setTask(taskRes.data);
    if (meRes.data) setMe(meRes.data);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const isManager   = me && ['studio_lead', 'producer'].includes(me.role);
  const isAssignee  = me && task && task.assigned_to === me.id;
  const isApprover  = me && task && task.approver_id === me.id;

  // Which transitions are available to this user?
  const availableTransitions: TaskStatus[] = task
    ? (ALLOWED_TRANSITIONS[task.status as TaskStatus] ?? []).filter((t: TaskStatus) => {
        if (['in_progress', 'submitted_for_review', 'waiting_for_assets'].includes(t)) {
          return isAssignee || isManager;
        }
        if (['under_review', 'qa', 'approved', 'rejected_by_lead'].includes(t)) {
          return isApprover || isManager;
        }
        if (t === 'done') return isManager;
        return isManager;
      })
    : [];

  async function doTransition(to: TaskStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_status: to, notes: transitionNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Transition failed'); return; }
      toast.success(`Task moved to ${TASK_STATUS_LABELS[to]}`);
      setTransitionDialog(null);
      setTransitionNote('');
      await load();
    } finally { setSaving(false); }
  }

  async function submitRevision() {
    if (!revisionForm.reason || !revisionForm.accountability || !revisionForm.notes.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revisionForm),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }
      toast.success('Revision logged');
      setRevisionDialog(false);
      setRevisionForm({ reason: '', accountability: '', notes: '' });
      await load();
    } finally { setSaving(false); }
  }

  async function submitNote() {
    if (!noteForm.note.trim()) { toast.error('Note cannot be empty'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }
      toast.success('Note added');
      setNoteDialog(false);
      setNoteForm({ note: '', is_blocking: false });
      await load();
    } finally { setSaving(false); }
  }

  async function submitDeadlineMiss() {
    if (!deadlineMissForm.reason || !deadlineMissForm.accountability) {
      toast.error('Reason and accountability are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/deadline-miss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...deadlineMissForm,
          actual_hours: deadlineMissForm.actual_hours ? Number(deadlineMissForm.actual_hours) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }
      toast.success('Deadline miss logged');
      setDeadlineMissDialog(false);
      await load();
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!task) return (
    <div className="text-center py-20 text-muted-foreground">
      <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Task not found</p>
      <Link href="/tasks" className="mt-3 inline-block">
        <Button variant="outline" size="sm">Back to Tasks</Button>
      </Link>
    </div>
  );

  const isOverdue = task.deadline && !['done', 'approved', 'rejected_by_lead'].includes(task.status)
    && new Date(task.deadline) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <Link href="/tasks">
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">{task.title}</h1>
              {isOverdue && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="w-3 h-3" /> Overdue
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`text-xs border-0 ${STATUS_COLORS[task.status as TaskStatus]}`}>
                {TASK_STATUS_LABELS[task.status as TaskStatus]}
              </Badge>
              <span className="text-muted-foreground text-xs">{TASK_TYPE_LABELS[task.task_type as TaskType]}</span>
              {task.priority >= 1 && (
                <span className={`text-xs font-medium ${task.priority >= 2 ? 'text-destructive' : 'text-orange-400'}`}>
                  {task.priority >= 2 ? '● Critical' : '● High'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {availableTransitions.map(t => (
            <Button
              key={t}
              size="sm"
              variant={t === 'rejected_by_lead' ? 'destructive' : t === 'approved' || t === 'done' ? 'default' : 'outline'}
              className="gap-1.5 text-xs h-8"
              onClick={() => { setTransitionDialog(t); setTransitionNote(''); }}
            >
              <ChevronRight className="w-3 h-3" />
              {TRANSITION_LABELS[t] ?? TASK_STATUS_LABELS[t]}
            </Button>
          ))}
          {(isApprover || isManager) && ['under_review', 'qa'].includes(task.status) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8 text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
              onClick={() => setRevisionDialog(true)}
            >
              <RotateCcw className="w-3 h-3" />
              Request Revision
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Meta */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MetaRow icon={<User className="w-3.5 h-3.5" />} label="Assignee">
                {task.assignee ? (
                  <Link href={`/team/${task.assignee.id}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px]">
                        {task.assignee.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{task.assignee.full_name}</span>
                  </Link>
                ) : <span className="text-muted-foreground text-xs">—</span>}
              </MetaRow>

              {task.approver && (
                <MetaRow icon={<Shield className="w-3.5 h-3.5 text-primary" />} label="Approver">
                  <span className="text-xs">{task.approver.full_name}</span>
                </MetaRow>
              )}

              {task.sprint && (
                <MetaRow icon={<Zap className="w-3.5 h-3.5" />} label="Sprint">
                  <Link href={`/sprints/${task.sprint.id}`} className="text-xs hover:text-primary transition-colors">
                    {task.sprint.name}
                  </Link>
                </MetaRow>
              )}

              {task.pod && (
                <MetaRow icon={<Layers className="w-3.5 h-3.5" />} label="Pod">
                  <Link href={`/pods/${task.pod.id}`} className="text-xs hover:text-primary transition-colors">
                    {task.pod.name}
                  </Link>
                </MetaRow>
              )}

              {task.eta_hours && (
                <MetaRow icon={<Clock className="w-3.5 h-3.5" />} label="ETA">
                  <span className="text-xs">{task.eta_hours}h</span>
                </MetaRow>
              )}

              {task.deadline && (
                <MetaRow icon={<Clock className="w-3.5 h-3.5" />} label="Deadline">
                  <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                    {formatDate(task.deadline)}{isOverdue && ' (overdue)'}
                  </span>
                </MetaRow>
              )}

              {task.work_link && (
                <MetaRow icon={<Link2 className="w-3.5 h-3.5" />} label="Work Link">
                  <a href={task.work_link} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-primary hover:underline block truncate max-w-[160px]">
                    Open Link
                  </a>
                </MetaRow>
              )}

              {task.tags?.length > 0 && (
                <MetaRow icon={<Tag className="w-3.5 h-3.5" />} label="Tags">
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag: string) => (
                      <span key={tag} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </MetaRow>
              )}

              <Separator />

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div>Created {formatDate(task.created_at)} by {task.creator?.full_name ?? '—'}</div>
                {task.revision_count > 0 && (
                  <div className="flex items-center gap-1 text-orange-400">
                    <RotateCcw className="w-3 h-3" />
                    {task.revision_count} revision{task.revision_count !== 1 ? 's' : ''}
                    {task.attributable_revision_count > 0 && (
                      <span className="text-muted-foreground">
                        ({task.attributable_revision_count} attributable)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {(isAssignee || isManager) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs h-8"
                  onClick={() => setNoteDialog(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Technical Note
                </Button>
                {isOverdue && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setDeadlineMissDialog(true)}
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> Log Deadline Miss
                  </Button>
                )}
                <Link href={`/tasks/${taskId}/edit`} className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8">
                    <Edit className="w-3.5 h-3.5" /> Edit Task
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Content area */}
        <div className="lg:col-span-2 space-y-4">
          {task.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.description}</p>
              </CardContent>
            </Card>
          )}

          {task.blocker_description && (
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-4 h-4" /> Blocker
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{task.blocker_description}</p>
              </CardContent>
            </Card>
          )}

          {task.revisions?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-orange-400" />
                  Revisions ({task.revisions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.revisions.map((rev: any) => (
                  <div key={rev.id} className="text-sm border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-orange-400">Revision #{rev.revision_number}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(rev.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{rev.reason.replace(/_/g, ' ')}</p>
                    {rev.notes && <p className="text-xs">{rev.notes}</p>}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span>By {rev.requester?.full_name ?? '—'}</span>
                      <span>·</span>
                      <span className={rev.accountability === 'employee' ? 'text-destructive' : ''}>
                        {rev.accountability} accountability
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {task.technical_notes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Technical Notes ({task.technical_notes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.technical_notes.map((note: any) => (
                  <div key={note.id} className={`text-sm border rounded-lg p-3 ${note.is_blocking ? 'border-destructive/40 bg-destructive/5' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{note.author?.full_name ?? '—'}</span>
                      <div className="flex items-center gap-2">
                        {note.is_blocking && <Badge variant="destructive" className="text-[10px] h-4">Blocking</Badge>}
                        <span className="text-[10px] text-muted-foreground">{formatDate(note.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{note.note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {task.status_history?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" /> Status History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...task.status_history].reverse().map((h: any) => (
                    <div key={h.id} className="flex items-start gap-3 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {h.from_status && (
                            <>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLORS[h.from_status as TaskStatus] ?? ''}`}>
                                {TASK_STATUS_LABELS[h.from_status as TaskStatus] ?? h.from_status}
                              </span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLORS[h.to_status as TaskStatus] ?? ''}`}>
                            {TASK_STATUS_LABELS[h.to_status as TaskStatus] ?? h.to_status}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          {h.changed_by_user?.full_name ?? '—'} · {formatDate(h.changed_at)}
                          {h.notes && <span> · {h.notes}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Transition Dialog */}
      <Dialog open={!!transitionDialog} onOpenChange={() => setTransitionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transitionDialog ? (TRANSITION_LABELS[transitionDialog] ?? TASK_STATUS_LABELS[transitionDialog]) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Move task to <span className="font-medium text-foreground">
                {transitionDialog ? TASK_STATUS_LABELS[transitionDialog] : ''}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes (optional)</Label>
              <Textarea
                placeholder="Any notes for this transition..."
                value={transitionNote}
                onChange={e => setTransitionNote(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransitionDialog(null)}>Cancel</Button>
            <Button
              onClick={() => transitionDialog && doTransition(transitionDialog)}
              disabled={saving}
              variant={transitionDialog === 'rejected_by_lead' ? 'destructive' : 'default'}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={revisionDialog} onOpenChange={setRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Reason <span className="text-destructive">*</span></Label>
              <Select value={revisionForm.reason} onValueChange={v => setRevisionForm(p => ({ ...p, reason: (v ?? '') as RevisionReason }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REVISION_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Accountability <span className="text-destructive">*</span></Label>
              <Select value={revisionForm.accountability} onValueChange={v => setRevisionForm(p => ({ ...p, accountability: (v ?? '') as AccountabilityTag }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Who is accountable?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                  <SelectItem value="studio_lead">Studio Lead</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Describe what needs to change..."
                value={revisionForm.notes}
                onChange={e => setRevisionForm(p => ({ ...p, notes: e.target.value }))}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevisionDialog(false)}>Cancel</Button>
            <Button onClick={submitRevision} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Technical Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Note <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Document a technical detail, blocker, or observation..."
                value={noteForm.note}
                onChange={e => setNoteForm(p => ({ ...p, note: e.target.value }))}
                className="min-h-[100px] resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_blocking"
                checked={noteForm.is_blocking}
                onChange={e => setNoteForm(p => ({ ...p, is_blocking: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is_blocking" className="text-sm font-normal cursor-pointer">
                This is a <span className="text-destructive font-medium">blocking</span> issue
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteDialog(false)}>Cancel</Button>
            <Button onClick={submitNote} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deadline Miss Dialog */}
      <Dialog open={deadlineMissDialog} onOpenChange={setDeadlineMissDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Deadline Miss</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Reason <span className="text-destructive">*</span></Label>
              <Select value={deadlineMissForm.reason} onValueChange={v => setDeadlineMissForm(p => ({ ...p, reason: (v ?? '') as DeadlineMissReason }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Why was the deadline missed?" />
                </SelectTrigger>
                <SelectContent>
                  {DEADLINE_MISS_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Accountability <span className="text-destructive">*</span></Label>
              <Select value={deadlineMissForm.accountability} onValueChange={v => setDeadlineMissForm(p => ({ ...p, accountability: (v ?? '') as AccountabilityTag }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Who is accountable?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                  <SelectItem value="studio_lead">Studio Lead</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Actual Hours Spent</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 12"
                value={deadlineMissForm.actual_hours}
                onChange={e => setDeadlineMissForm(p => ({ ...p, actual_hours: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Textarea
                placeholder="Additional context..."
                value={deadlineMissForm.notes}
                onChange={e => setDeadlineMissForm(p => ({ ...p, notes: e.target.value }))}
                className="min-h-[70px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeadlineMissDialog(false)}>Cancel</Button>
            <Button onClick={submitDeadlineMiss} disabled={saving} variant="destructive">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Deadline Miss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}
