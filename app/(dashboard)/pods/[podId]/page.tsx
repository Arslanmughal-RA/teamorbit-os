'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Loader2, AlertCircle, Layers,
  Calendar, CheckSquare, FolderKanban, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/database';

const STATUS_COLOR: Record<string, string> = {
  planning:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  active:    'bg-green-500/15 text-green-400 border-green-500/30',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{done}/{total} tasks done</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ProjectCard({ sprint, podId }: { sprint: any; podId: string }) {
  return (
    <Link href={`/pods/${podId}/projects/${sprint.id}`}>
      <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer group">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FolderKanban className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                  {sprint.name}
                </p>
                {sprint.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{sprint.description}</p>
                )}
              </div>
            </div>
            <Badge className={`text-[10px] shrink-0 border ${STATUS_COLOR[sprint.status] ?? ''}`}>
              {sprint.status}
            </Badge>
          </div>

          <ProgressBar done={sprint.done_tasks ?? 0} total={sprint.total_tasks ?? 0} />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              <span>{sprint.total_tasks} tasks</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PodProjectsPage() {
  const { podId } = useParams<{ podId: string }>();
  const [pod, setPod]       = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [me, setMe]         = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [podRes, sprintsRes, meRes] = await Promise.all([
      fetch(`/api/pods/${podId}`).then(r => r.json()),
      fetch(`/api/sprints?pod_id=${podId}`).then(r => r.json()),
      fetch('/api/users/me').then(r => r.json()),
    ]);
    if (podRes.data) setPod(podRes.data);
    setSprints(sprintsRes.data ?? []);
    if (meRes.data) setMe(meRes.data);
    setLoading(false);
  }, [podId]);

  useEffect(() => { load(); }, [load]);

  const isManager = me && ['studio_lead', 'producer'].includes(me.role);

  const activeProjects = sprints.filter(s => ['active', 'planning'].includes(s.status));
  const completedProjects = sprints.filter(s => s.status === 'completed');
  const otherProjects = sprints.filter(s => !['active', 'planning', 'completed'].includes(s.status));

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!pod) return (
    <div className="text-center py-20 text-muted-foreground">
      <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Pod not found</p>
      <Link href="/pods" className="mt-3 inline-block">
        <Button variant="outline" size="sm">Back to Pods</Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/pods">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{pod.name}</h1>
              {pod.is_studio_wide && <Badge variant="secondary">Studio-Wide</Badge>}
            </div>
            {pod.description && (
              <p className="text-muted-foreground text-sm mt-1 ml-10">{pod.description}</p>
            )}
          </div>
        </div>
        {isManager && (
          <Link href={`/pods/${podId}/projects/new`}>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </Link>
        )}
      </div>

      {/* Pod members strip */}
      <div className="flex items-center gap-3 bg-card border rounded-lg px-4 py-2.5">
        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          {(pod.members ?? []).map((m: any) => (
            <Link key={m.id} href={`/team/${m.id}`}>
              <div className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px]">
                    {m.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{m.full_name.split(' ')[0]}</span>
              </div>
            </Link>
          ))}
          {!pod.members?.length && (
            <span className="text-xs text-muted-foreground italic">No members</span>
          )}
        </div>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {pod.members?.length ?? 0} member{(pod.members?.length ?? 0) !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active & Planning Projects */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Active Projects
          <span className="text-muted-foreground font-normal">({activeProjects.length})</span>
        </h2>
        {activeProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeProjects.map(s => (
              <ProjectCard key={s.id} sprint={s} podId={podId} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 border rounded-xl border-dashed text-muted-foreground">
            <FolderKanban className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm">No active projects</p>
            {isManager && (
              <Link href={`/pods/${podId}/projects/new`} className="mt-3">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Create First Project
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />
            Completed Projects
            <span className="text-muted-foreground font-normal">({completedProjects.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-75">
            {completedProjects.map(s => (
              <ProjectCard key={s.id} sprint={s} podId={podId} />
            ))}
          </div>
        </div>
      )}

      {/* Other (cancelled etc) */}
      {otherProjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive/60 inline-block" />
            Other
            <span className="text-muted-foreground font-normal">({otherProjects.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
            {otherProjects.map(s => (
              <ProjectCard key={s.id} sprint={s} podId={podId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
