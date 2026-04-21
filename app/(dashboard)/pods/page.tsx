'use server';

import { getCurrentUser, createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, ChevronRight, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/database';

async function getPods() {
  const supabase = await createClient();

  const { data: pods } = await (supabase.from('pods') as any)
    .select('id, name, description, is_studio_wide')
    .order('name');

  if (!pods?.length) return [];

  // Get members for each pod
  const podIds = pods.map((p: any) => p.id);
  const { data: memberRows } = await (supabase.from('pod_members') as any)
    .select('pod_id, user:users!pod_members_user_id_fkey(id, full_name, role)')
    .in('pod_id', podIds);

  const membersByPod: Record<string, any[]> = {};
  for (const row of memberRows ?? []) {
    if (!membersByPod[row.pod_id]) membersByPod[row.pod_id] = [];
    if (row.user) membersByPod[row.pod_id].push(row.user);
  }

  return pods.map((pod: any) => ({
    ...pod,
    members: membersByPod[pod.id] ?? [],
  }));
}

export default async function PodsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!['studio_lead', 'producer'].includes(user.role)) redirect('/dashboard');

  const pods = await getPods();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pods</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pods.length} pods · {pods.reduce((sum: number, p: any) => sum + p.members.length, 0)} members total
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pods.map((pod: any) => (
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
                <Link href={`/pods/${pod.id}`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pod.description && (
                <p className="text-xs text-muted-foreground">{pod.description}</p>
              )}

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">
                    {pod.members.length} member{pod.members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {pod.members.map((member: any) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{member.full_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {ROLE_LABELS[member.role as UserRole]}
                      </span>
                    </div>
                  ))}
                  {pod.members.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No members assigned</p>
                  )}
                </div>
              </div>

              <Link href={`/pods/${pod.id}`} className="block">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  View Pod
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

        {pods.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <Layers className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No pods yet. Create pods in Supabase to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
