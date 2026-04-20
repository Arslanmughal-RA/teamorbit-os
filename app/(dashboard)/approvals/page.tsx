'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield, CheckCircle2, XCircle, RotateCcw,
  AlertCircle, Loader2, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { TaskStatus, TaskType, RevisionReason, AccountabilityTag } from '@/types/database';

const STATUS_SECTION_COLORS: Partial<Record<TaskStatus, string>> = {
  submitted_for_review: 'bg-purple-500',
  under_review:         'bg-purple-400',
  qa:                   'bg-indigo-500',
};

const REVISION_REASONS: { value: RevisionReason; label: string }[] = [
  { value: 'quality_issue',             label: 'Quality Issue' },
  { value: 'brief_unclear',             label: 'Brief Unclear' },
  { value: 'scope_changed',             label: 'Scope Changed' },
  { value: 'creative_direction_change', label: 'Creative Direction Change' },
  { value: 'technical_issue',           label: 'Technical Issue' },
  { value: 'doesnt_match_reference',    label: "Doesn't Match Reference" },
  { value: 'performance_issue',         label: 'Performance Issue' },
];

export default function ApprovalsPage() {
  const [tasks, setTasks]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe]           = useState<any>(null);

  const [approveDialog, setApproveDialog]   = useState<any>(null);
  const [rejectDialog, setRejectDialog]     = useState<any>(null);
  const [revisionDialog, setRevisionDialog] = useState<any>(null);
  const [revisionForm, setRevisionForm] = useState<{
    reason: RevisionReason | ''; accountability: AccountabilityTag | ''; notes: string;
  }>({ reason: '', accountability: '', notes: '' });
  const [actionNote, setActionNote] = useState('');
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [meRes, s1, s2, s3] = await Promise.all([
      fetch('/api/users/me').then(r => r.json()),
      fetch('/api/tasks?status=submitted_for_review').then(r => r.json()),
      fetch('/api/tasks?status=under_review').then(r => r.json()),
      fetch('/api/tasks?status=qa').then(r => r.json()),
    ]);
    const me_ = meRes.data;
    setMe(me_);
    const all = [...(s1.data ?? []), ...(s2.data ?? []), ...(s3.data ?? [])];
    if (me_) {
      const isManager = ['studio_lead', 'producer'].includes(me_.role);
      setTasks(isManager ? all : all.filter((t: any) => t.approver_id === me_.id));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doTransition(taskId: string, to: TaskStatus, notes?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_status: to, notes }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return false; }
      return true;
    } finally { setSaving(false); }
  }

  async function handleApprove() {
    if (!approveDialog) return;
    if (await doTransition(approveDialog.id, 'approved', actionNote || undefined)) {
      toast.success('Task approved'); setApproveDialog(null); setActionNote(''); load();
    }
  }

  async function handleReject() {
    if (!rejectDialog || !actionNote.trim()) { toast.error('Provide a reason'); return; }
    if (await doTransition(rejectDialog.id, 'rejected_by_lead', actionNote)) {
      toast.success('Task rejected'); setRejectDialog(null); setActionNote(''); load();
    }
  }

  async function handleRevision() {
    if (!revisionDialog) return;
    if (!revisionForm.reason || !revisionForm.accountability || !revisionForm.notes.trim()) {
      toast.error('All fields required'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${revisionDialog.id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revisionForm),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }
      toast.success('Revision requested');
      setRevisionDialog(null);
      setRevisionForm({ reason: '', accountability: '', notes: '' });
      load();
    } finally { setSaving(false); }
  }

  async function moveNext(task: any) {
    const next: Partial<Record<TaskStatus, TaskStatus>> = {
      submitted_for_review: 'under_review',
      under_review: 'qa',
    };
    const to = next[task.status as TaskStatus];
    if (!to) return;
    if (await doTransition(task.id, to)) {
      toast.success(`Moved to ${TASK_STATUS_LABELS[to]}`); load();
    }
  }

  const sections: { status: TaskStatus; label: string }[] = [
    { status: 'submitted_for_review', label: 'Submitted for Review' },
    { status: 'under_review',         label: 'Under Review' },
    { status: 'qa',                   label: 'QA' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} awaiting your review
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No pending approvals</p>
          <p className="text-xs mt-1">Tasks submitted for review will appear here</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map(({ status, label }) => {
            const list = tasks.filter(t => t.status === status);
            if (!list.length) return null;
            const dotColor = STATUS_SECTION_COLORS[status] ?? 'bg-muted-foreground';
            return (
              <div key={status} className="space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  {label} ({list.length})
                </h2>
                <div className="space-y-2">
                  {list.map(task => (
                    <ApprovalRow
                      key={task.id}
                      task={task}
                      me={me}
                      canMoveNext={status !== 'qa'}
                      onApprove={() => { setApproveDialog(task); setActionNote(''); }}
                      onReject={() => { setRejectDialog(task); setActionNote(''); }}
                      onRevision={() => { setRevisionDialog(task); setRevisionForm({ reason: '', accountability: '', notes: '' }); }}
                      onMoveNext={() => moveNext(task)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Task</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Approving: <span className="font-medium text-foreground">{approveDialog?.title}</span></p>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes (optional)</Label>
              <Textarea value={actionNote} onChange={e => setActionNote(e.target.value)} className="min-h-[70px] resize-none" placeholder="Any approval notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveDialog(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={saving} className="bg-green-600 hover:bg-green-700 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Task</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Rejecting: <span className="font-medium text-foreground">{rejectDialog?.title}</span></p>
            <div className="space-y-1.5">
              <Label className="text-sm">Reason (required)</Label>
              <Textarea value={actionNote} onChange={e => setActionNote(e.target.value)} className="min-h-[80px] resize-none" placeholder="Explain why this task is rejected..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={saving || !actionNote.trim()} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision */}
      <Dialog open={!!revisionDialog} onOpenChange={() => setRevisionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Revision</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Reason *</Label>
              <Select value={revisionForm.reason} onValueChange={v => setRevisionForm(p => ({ ...p, reason: (v ?? '') as RevisionReason }))}>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {REVISION_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Accountability *</Label>
              <Select value={revisionForm.accountability} onValueChange={v => setRevisionForm(p => ({ ...p, accountability: (v ?? '') as AccountabilityTag }))}>
                <SelectTrigger><SelectValue placeholder="Who is accountable?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                  <SelectItem value="studio_lead">Studio Lead</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes *</Label>
              <Textarea value={revisionForm.notes} onChange={e => setRevisionForm(p => ({ ...p, notes: e.target.value }))} className="min-h-[80px] resize-none" placeholder="What needs to change..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevisionDialog(null)}>Cancel</Button>
            <Button onClick={handleRevision} disabled={saving} className="bg-orange-500 hover:bg-orange-600 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Request Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalRow({ task, me, canMoveNext, onApprove, onReject, onRevision, onMoveNext }: {
  task: any; me: any; canMoveNext: boolean;
  onApprove: () => void; onReject: () => void; onRevision: () => void; onMoveNext: () => void;
}) {
  const isManager  = me && ['studio_lead', 'producer'].includes(me.role);
  const isApprover = me && task.approver_id === me.id;
  const canAct     = isApprover || isManager;
  const isOverdue  = task.deadline && new Date(task.deadline) < new Date();
  const initials   = task.assignee?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/tasks/${task.id}`} className="text-sm font-semibold hover:text-primary transition-colors truncate">
                {task.title}
              </Link>
              {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span>{task.assignee?.full_name ?? '—'}</span>
              <span>·</span>
              <span>{TASK_TYPE_LABELS[task.task_type as TaskType]}</span>
              {task.deadline && <><span>·</span><span className={isOverdue ? 'text-destructive' : ''}>{formatDate(task.deadline)}</span></>}
            </div>
          </div>
          {canAct && (
            <div className="flex items-center gap-1.5 shrink-0">
              {canMoveNext && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onMoveNext}>
                  Next <ChevronRight className="w-3 h-3" />
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1" onClick={onApprove}>
                <CheckCircle2 className="w-3 h-3" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-orange-400 border-orange-400/30 hover:bg-orange-400/10 gap-1" onClick={onRevision}>
                <RotateCcw className="w-3 h-3" /> Revise
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={onReject}>
                <XCircle className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
