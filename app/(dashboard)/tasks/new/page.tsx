'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
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

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [pods, setPods] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type: '' as TaskType | '',
    assigned_to: '',
    sprint_id: searchParams.get('sprint_id') ?? '',
    pod_id: '',
    eta_hours: '',
    deadline: '',
    priority: '0',
    tags: '',
    work_link: '',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/sprints?status=active').then(r => r.json()),
      fetch('/api/sprints').then(r => r.json()),
      fetch('/api/pods').then(r => r.json()),
    ]).then(([usersJson, activeSprintsJson, allSprintsJson, podsJson]) => {
      setUsers(usersJson.data ?? []);
      // Prefer active sprints, fall back to all
      const activeSprints = activeSprintsJson.data ?? [];
      setSprints(activeSprints.length ? activeSprints : (allSprintsJson.data ?? []));
      setPods(podsJson.data ?? []);
    });

    // Get current user profile
    fetch('/api/users/me').then(r => r.json()).then(json => {
      if (json.data) {
        setCurrentUser(json.data);
        // Pre-fill assignee for non-managers
        if (!['studio_lead', 'producer'].includes(json.data.role)) {
          setForm(p => ({ ...p, assigned_to: json.data.id }));
        }
      }
    });
  }, []);

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  const isManager = currentUser && ['studio_lead', 'producer'].includes(currentUser.role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.task_type)    { toast.error('Task type is required'); return; }
    if (!form.assigned_to) { toast.error('Assignee is required'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description || undefined,
        task_type: form.task_type,
        assigned_to: form.assigned_to,
        sprint_id: form.sprint_id || undefined,
        pod_id: form.pod_id || undefined,
        priority: Number(form.priority),
        work_link: form.work_link || undefined,
      };
      if (form.eta_hours) payload.eta_hours = Number(form.eta_hours);
      if (form.deadline)  payload.deadline = form.deadline;
      if (form.tags)      payload.tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed to create task'); return; }
      toast.success('Task created!');
      router.push(`/tasks/${json.data.id}`);
    } catch {
      toast.error('Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tasks">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Task</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Add a new task to the backlog</p>
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
                <Label className="text-sm">Assignee <span className="text-destructive">*</span></Label>
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
                <Select value={form.pod_id} onValueChange={v => set('pod_id', v === '__none__' ? '' : (v ?? ''))}>
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
              <Select value={form.sprint_id} onValueChange={v => set('sprint_id', v === '__none__' ? '' : (v ?? ''))}>
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Creating...' : 'Create Task'}
          </Button>
          <Link href="/tasks">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>}>
      <NewTaskForm />
    </Suspense>
  );
}
