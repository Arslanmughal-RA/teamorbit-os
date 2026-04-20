'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Zap, CheckCircle2, Clock, AlertCircle, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type { SprintStatus } from '@/types/database';

const STATUS_CONFIG: Record<SprintStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  planning:  { label: 'Planning',   variant: 'secondary',    icon: <Clock className="w-3 h-3" /> },
  active:    { label: 'Active',     variant: 'default',      icon: <Zap className="w-3 h-3" /> },
  completed: { label: 'Completed',  variant: 'outline',      icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled',  variant: 'destructive',  icon: <AlertCircle className="w-3 h-3" /> },
};

export default function SprintsPage() {
  const [sprints, setSprints] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    fetch(`/api/sprints?${params.toString()}`)
      .then(r => r.json())
      .then(json => setSprints(json.data ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const activeSprints = sprints.filter(s => s.status === 'active');
  const otherSprints  = sprints.filter(s => s.status !== 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sprints</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/sprints/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Sprint
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-5 h-44" />
            </Card>
          ))}
        </div>
      ) : sprints.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No sprints found</p>
          <p className="text-xs mt-1">Create your first sprint to get the team moving</p>
          <Link href="/sprints/new" className="mt-4 inline-block">
            <Button size="sm" variant="outline">Create Sprint</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active sprints first */}
          {activeSprints.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeSprints.map(sprint => (
                  <SprintCard key={sprint.id} sprint={sprint} />
                ))}
              </div>
            </div>
          )}

          {/* Other sprints */}
          {otherSprints.length > 0 && (
            <div className="space-y-3">
              {activeSprints.length > 0 && (
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Other
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {otherSprints.map(sprint => (
                  <SprintCard key={sprint.id} sprint={sprint} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SprintCard({ sprint }: { sprint: any }) {
  const cfg = STATUS_CONFIG[sprint.status as SprintStatus];
  const completionPct = sprint.total_tasks > 0
    ? Math.round((sprint.done_tasks / sprint.total_tasks) * 100)
    : 0;

  const now = new Date();
  const end = new Date(sprint.end_date);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);

  return (
    <Link href={`/sprints/${sprint.id}`}>
      <Card className={`hover:border-primary/40 transition-colors cursor-pointer ${sprint.status === 'active' ? 'border-primary/30 bg-primary/[0.02]' : ''}`}>
        <CardContent className="pt-5 pb-4 space-y-4">
          {/* Title + Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">{sprint.name}</h3>
              {sprint.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sprint.description}</p>
              )}
            </div>
            <Badge variant={cfg.variant} className="shrink-0 gap-1 text-xs">
              {cfg.icon}
              {cfg.label}
            </Badge>
          </div>

          {/* Pods */}
          {sprint.pods?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sprint.pods.map((pod: any) => (
                <span key={pod.id} className="inline-flex items-center gap-1 text-[10px] bg-secondary px-1.5 py-0.5 rounded-md text-muted-foreground">
                  <Layers className="w-2.5 h-2.5" />
                  {pod.name}
                </span>
              ))}
            </div>
          )}

          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{sprint.done_tasks} / {sprint.total_tasks} tasks done</span>
              <span className="font-semibold tabular-nums">{completionPct}%</span>
            </div>
            <Progress value={completionPct} className="h-1.5" />
          </div>

          {/* Dates */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}</span>
            {sprint.status === 'active' && daysLeft >= 0 && (
              <span className={`font-medium ${daysLeft <= 2 ? 'text-destructive' : 'text-primary'}`}>
                {daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
