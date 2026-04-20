'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { TASK_TYPE_LABELS, ROLE_LABELS } from '@/lib/constants';
import type { TaskType, UserRole } from '@/types/database';

export default function EditTaskPage() {
  const router = useRouter();
  const { taskId } = useParams<{ taskId: string }>();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers]       = useState<any[]>([]);
  const [sprints, setSprints]   = useState<any[]>([]);
  const [pods, setPods]         = useState<any[]>([]);

  const [form, setForm] = useState({
    title:                '',
    description:          '',
    task_type:            '' as TaskType | '',
    assigned_to:          '',
    sprint_id:            '',
    pod_id:               '',
    eta_hours:            '',
    deadline:             '',
    priority:             '0',
    tags:                 '',
    work_link:            '',
    blocker_description:  '',
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks/${taskId}`).then(r => r.json()),
      fetch('/api/users/me').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/sprints').then(r => r.json()),
      fetch('/api/pods').then(r => r.json()),
    ]).then(([taskRes, meRes, usersRes, sprintsRes, podsRes]) => {
      if (!taskRes.data) { setNotFound(true); setLoading(false); return; }

      const t = taskRes.data;
      setForm({
        title:               t.title ?? '',
        description:         t.description ?? '',
        task_type:           t.task_type ?? '',
        assigned_to:         t.assigned_to ?? '',
        sprint_id:           t.sprint_id ?? '',
        pod_id:              t.pod_id ?? '',
        eta_hours:           t.eta_hours != null ? String(t.eta_hours) : '',
        deadline:            t.deadline ? t.deadline.slice(0, 10) : '',
        priority:            t.priority != null ? String(t.priority) : '0',
        tags:                Array.isArray(t.tags) ? t.tags.join(', ') : '',
        work_link:           t.work_link ?? '',
        blocker_description: t.blocker_description ?? '',
      });

      setCurrentUser(meRes.data ?? null);
      setUsers(usersRes.data ?? []);
      setSprints(sprintsRes.data ?? []);
      setPods(podsRes.data ?? []);
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [taskId]);

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  const isManager = currentUser && ['studio_lead', 'producer'].includes(currentUser.role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim())  { toast.error('Title is required'); return; }
    if (!form.task_type)     { toast.error('Task type is required'); return; }
    if (!form.assigned_to)   { toast.error('Assignee is required'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title:               form.title.trim(),
        description:         form.description || null,
        sprint_id:           form.sprint_id   || null,
        pod_id:              form.pod_id       || null,
        priority:            Number(form.priority),
        work_link:           form.work_link   || null,
        blocker_description: form.blocker_description || null,
        eta_hours:           form.eta_hours   ? Number(form.eta_hours) : null,
        deadline:            form.deadline    || null,
        tags:                form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };

      // Managers can change assignee + task_type
      if (isManager) {
        payload.assigned_to = form.assigned_to;
        payload.task_type   = form.task_type;
      }

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed to update task'); return; }
      toast.success('Task updated');
      router.push(`/tasks/${taskId}`);
    } catch {
      toast.error('Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (notFound) return (
    <div className="text-center py-20 text-muted-foreground">
      <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Task not found</p>
      <Link href="/tasks" className="mt-3 inline-block">
        <Button variant="outline" size="sm">Back to Tasks</Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/tasks/${taskId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Task</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Update task details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Core Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Task Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Design main menu background — S12"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                placeholder="Detailed requirements, references, acceptance criteria..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Task Type <span className="text-destructive">*</span>
                  {!isManager && <span className="text-muted-foreground font-normal ml-1">(read-only)</span>}
                </Label>
                <Select
                  value={form.task_type}
                  onValueChange={v => set('task_type', v ?? '')}
                  disabled={!isManager}
                >
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
          </CardContent>
        </Card>

        {/* Assignment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Assignee <span className="text-destructive">*</span>
                  {!isManager && <span className="text-muted-foreground font-normal ml-1">(read-only)</span>}
                </Label>
                <Select
                  value={form.assigned_to}
                  onValueChange={v => set('assigned_to', v ?? '')}
                  disabled={!isManager}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select assignee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} — {ROLE_LABELS[u.role as UserRole]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Pod</Label>
                <Select value={form.pod_id || '__none__'} onValueChange={v => set('pod_id', v === '__none__' ? '' : (v ?? ''))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select pod..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No pod</SelectItem>
                    {pods.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Sprint</Label>
              <Select value={form.sprint_id || '__none__'} onValueChange={v => set('sprint_id', v === '__none__' ? '' : (v ?? ''))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select sprint..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No sprint (backlog)</SelectItem>
                  {sprints.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} <span className="text-muted-foreground">({s.status})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Scheduling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        {/* Optional */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Optional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Work Link</Label>
              <Input
                placeholder="https://figma.com/..."
                value={form.work_link}
                onChange={e => set('work_link', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tags <span className="text-muted-foreground text-xs font-normal">(comma-separated)</span></Label>
              <Input
                placeholder="e.g. ui, mobile, urgent"
                value={form.tags}
                onChange={e => set('tags', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Blocker Description</Label>
              <Textarea
                placeholder="Describe what is blocking this task..."
                value={form.blocker_description}
                onChange={e => set('blocker_description', e.target.value)}
                className="min-h-[70px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Link href={`/tasks/${taskId}`}>
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
