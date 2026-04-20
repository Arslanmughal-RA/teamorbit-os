'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function NewSprintPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pods, setPods] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    pod_ids: [] as string[],
  });

  useEffect(() => {
    fetch('/api/pods')
      .then(r => r.json())
      .then(json => setPods(json.data ?? []));
  }, []);

  function togglePod(id: string) {
    setForm(prev => ({
      ...prev,
      pod_ids: prev.pod_ids.includes(id)
        ? prev.pod_ids.filter(p => p !== id)
        : [...prev.pod_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) { toast.error('Sprint name is required'); return; }
    if (!form.start_date)  { toast.error('Start date is required'); return; }
    if (!form.end_date)    { toast.error('End date is required'); return; }
    if (!form.pod_ids.length) { toast.error('Select at least one pod'); return; }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast.error('End date must be after start date');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? 'Failed to create sprint');
        return;
      }
      toast.success('Sprint created successfully');
      router.push(`/sprints/${json.data.id}`);
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
        <Link href="/sprints">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Sprint</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Set up a new sprint for your pods</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sprint Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm">Sprint Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Sprint 12 — Game Art Focus"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional goals or context for this sprint..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start_date" className="text-sm">Start Date <span className="text-destructive">*</span></Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date" className="text-sm">End Date <span className="text-destructive">*</span></Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pod Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Assign Pods <span className="text-destructive">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading pods...</p>
            ) : (
              <div className="space-y-2">
                {pods.map(pod => (
                  <div
                    key={pod.id}
                    onClick={() => togglePod(pod.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.pod_ids.includes(pod.id)
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <Checkbox
                      checked={form.pod_ids.includes(pod.id)}
                      onCheckedChange={() => togglePod(pod.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{pod.name}</p>
                      {pod.description && (
                        <p className="text-xs text-muted-foreground truncate">{pod.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{pod.members?.length ?? 0} member{pod.members?.length !== 1 ? 's' : ''}</span>
                      {pod.is_studio_wide && (
                        <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">Studio-Wide</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Creating...' : 'Create Sprint'}
          </Button>
          <Link href="/sprints">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
