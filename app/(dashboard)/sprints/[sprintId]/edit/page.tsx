'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function EditSprintPage() {
  const router = useRouter();
  const { sprintId } = useParams<{ sprintId: string }>();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [pods, setPods]         = useState<any[]>([]);

  const [form, setForm] = useState({
    name:        '',
    description: '',
    start_date:  '',
    end_date:    '',
    pod_ids:     [] as string[],
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/sprints/${sprintId}`).then(r => r.json()),
      fetch('/api/pods').then(r => r.json()),
    ]).then(([sprintRes, podsRes]) => {
      if (!sprintRes.data) { setNotFound(true); setLoading(false); return; }

      const s = sprintRes.data;
      setForm({
        name:        s.name ?? '',
        description: s.description ?? '',
        start_date:  s.start_date ? s.start_date.slice(0, 10) : '',
        end_date:    s.end_date   ? s.end_date.slice(0, 10)   : '',
        pod_ids:     s.pod_ids ?? [],
      });
      setPods(podsRes.data ?? []);
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [sprintId]);

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

    if (!form.name.trim())    { toast.error('Sprint name is required'); return; }
    if (!form.start_date)     { toast.error('Start date is required'); return; }
    if (!form.end_date)       { toast.error('End date is required'); return; }
    if (!form.pod_ids.length) { toast.error('Select at least one pod'); return; }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast.error('End date must be after start date');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name.trim(),
          description: form.description || null,
          start_date:  form.start_date,
          end_date:    form.end_date,
          pod_ids:     form.pod_ids,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed to update sprint'); return; }
      toast.success('Sprint updated');
      router.push(`/sprints/${sprintId}`);
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
      <p className="text-sm">Sprint not found</p>
      <Link href="/sprints" className="mt-3 inline-block">
        <Button variant="outline" size="sm">Back to Sprints</Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/sprints/${sprintId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Sprint</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Update sprint details and pod assignments</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Core Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sprint Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Sprint Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Sprint 12 — Combat UI"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                placeholder="Sprint goals, scope, focus areas..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Start Date <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">End Date <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pod Assignment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Pod Assignment <span className="text-destructive">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pods.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pods available. Create pods first.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pods.map(pod => {
                  const selected = form.pod_ids.includes(pod.id);
                  return (
                    <button
                      key={pod.id}
                      type="button"
                      onClick={() => togglePod(pod.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => togglePod(pod.id)}
                        className="shrink-0 pointer-events-none"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{pod.name}</p>
                        {pod.is_studio_wide && (
                          <p className="text-[10px] text-muted-foreground">Studio-wide</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {form.pod_ids.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {form.pod_ids.length} pod{form.pod_ids.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Link href={`/sprints/${sprintId}`}>
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
