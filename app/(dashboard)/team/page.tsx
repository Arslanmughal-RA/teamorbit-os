'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Loader2, Pencil, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/database';

const ALL_ROLES: UserRole[] = [
  'studio_lead', 'producer', 'developer', 'game_designer',
  'post_production_artist', 'creative_artist', 'ua_manager', 'aso_specialist',
];

export default function TeamPage() {
  const [users, setUsers]   = useState<any[]>([]);
  const [me, setMe]         = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ role: UserRole; is_active: boolean }>({ role: 'developer', is_active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, meRes] = await Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/users/me').then(r => r.json()),
    ]);
    setUsers(usersRes.data ?? []);
    setMe(meRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isManager = me && ['studio_lead', 'producer'].includes(me.role);

  function startEdit(member: any) {
    setEditing(member.id);
    setEditForm({ role: member.role, is_active: member.is_active });
  }

  async function saveEdit(memberId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Failed'); return; }
      toast.success('Member updated');
      setEditing(null);
      load();
    } finally { setSaving(false); }
  }

  const sorted = [...users].sort((a, b) =>
    ALL_ROLES.indexOf(a.role) - ALL_ROLES.indexOf(b.role)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground text-sm mt-1">{users.length} team members</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(member => {
            const initials = member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const isEditing = editing === member.id;

            return (
              <Card key={member.id} className={`transition-colors ${!member.is_active ? 'opacity-50' : 'hover:border-primary/40'}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex flex-col items-center text-center gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="text-base font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="w-full">
                      <p className="font-semibold text-sm leading-tight">{member.full_name}</p>
                      {!isEditing ? (
                        <Badge variant="secondary" className="mt-1.5 text-xs font-medium">
                          {ROLE_LABELS[member.role as UserRole]}
                        </Badge>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v as UserRole }))}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROLES.map(r => (
                                <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center justify-center gap-2 text-xs">
                            <Switch
                              checked={editForm.is_active}
                              onCheckedChange={v => setEditForm(f => ({ ...f, is_active: v }))}
                              className="scale-75"
                            />
                            <span className="text-muted-foreground">{editForm.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>

                    {isManager && !isEditing && member.id !== me?.id && (
                      <div className="flex gap-2 w-full">
                        <Link href={`/team/${member.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full text-xs">Profile</Button>
                        </Link>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(member)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}

                    {isEditing && (
                      <div className="flex gap-2 w-full">
                        <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => saveEdit(member.id)} disabled={saving}>
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}

                    {(!isManager || member.id === me?.id) && !isEditing && (
                      <Link href={`/team/${member.id}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full text-xs">View Profile</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {users.length === 0 && (
            <div className="col-span-4 text-center py-16 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No team members yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
