'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, Layers, Plus, Pencil, Trash2, Loader2, X, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/database';

export default function PodsPage() {
  const [pods, setPods]     = useState<any[]>([]);
  const [users, setUsers]   = useState<any[]>([]);
  const [me, setMe]         = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', is_studio_wide: false, member_ids: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [podsRes, usersRes, meRes] = await Promise.all([
      fetch('/api/pods').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/users/me').then(r => r.json()),
    ]);
    setPods(podsRes.data ?? []);
    setUsers(usersRes.data ?? []);
    setMe(meRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isManager = me && ['studio_lead', 'producer'].includes(me.role);

  function openCreate() {
    setForm({ name: '', description: '', is_studio_wide: false, member_ids: [] });
    setEditTarget(null);
    setDialog('create');
  }

  function openEdit(pod: any) {
    setForm({
      name: pod.name,
      description: pod.description ?? '',
      is_studio_wide: pod.is_studio_wide,
      member_ids: pod.members.map((m: any) => m.id),
    });
    setEditTarget(pod);
    setDialog('edit');
  }

  function toggleMember(uid: string) {
    setForm(f => ({
      ...f,
      member_ids: f.member_ids.includes(uid)
        ? f.member_ids.filter(id => id !== uid)
        : [...f.member_ids, uid],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Pod name is required'); return; }
    setSaving(true);
    try {
      const url  = dialog === 'edit' ? `/api/pods/${editTarget.id}` : '/api/pods';
      const method = dialog === 'edit' ? 'PATCH' : 'POST';
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }
      toast.success(dialog === 'edit' ? 'Pod updated' : 'Pod created');
      setDialog(null);
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete(pod: any) {
    setSaving(true);
    try {
      const res  = await fetch(`/api/pods/${pod.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }
      toast.success('Pod deleted');
      setDeleteTarget(null);
      load();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pods</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pods.length} pods · {pods.reduce((s, p) => s + p.members.length, 0)} members total
          </p>
        </div>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> New Pod
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pods.map(pod => (
            <Card key={pod.id} className="hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm">{pod.name}</h2>
                      {pod.is_studio_wide && (
                        <Badge variant="secondary" className="text-xs mt-0.5">Studio-Wide</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isManager && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pod)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(pod)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <Link href={`/pods/${pod.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {pod.description && <p className="text-xs text-muted-foreground">{pod.description}</p>}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {pod.members.length} member{pod.members.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {pod.members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {m.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{m.full_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{ROLE_LABELS[m.role as UserRole]}</span>
                      </div>
                    ))}
                    {pod.members.length === 0 && <p className="text-xs text-muted-foreground italic">No members yet</p>}
                  </div>
                </div>
                <Link href={`/pods/${pod.id}`} className="block">
                  <Button variant="outline" size="sm" className="w-full text-xs">View Projects</Button>
                </Link>
              </CardContent>
            </Card>
          ))}

          {pods.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Layers className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No pods yet.</p>
              {isManager && <p className="text-xs mt-1">Click "New Pod" to create your first one.</p>}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === 'edit' ? 'Edit Pod' : 'New Pod'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Art, UA, Dev..." />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="resize-none min-h-[60px]" placeholder="Optional description..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_studio_wide} onCheckedChange={v => setForm(f => ({ ...f, is_studio_wide: v }))} />
              <Label>Studio-Wide pod (visible to all)</Label>
            </div>
            <div className="space-y-2">
              <Label>Members</Label>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {users.map((u: any) => {
                  const selected = form.member_ids.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent ${selected ? 'bg-primary/10' : ''}`}
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {u.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[u.role as UserRole]}</p>
                      </div>
                      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{form.member_ids.length} selected</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {dialog === 'edit' ? 'Save Changes' : 'Create Pod'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Pod</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteTarget)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
