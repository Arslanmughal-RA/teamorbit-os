'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, CheckCircle2, Clock, Star, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { PerformanceTier, UserRole } from '@/types/database';

const TIER_CONFIG: Record<PerformanceTier, { label: string; color: string; bgColor: string }> = {
  excellent:  { label: 'Excellent',  color: 'text-green-400', bgColor: 'bg-green-500/15' },
  acceptable: { label: 'Acceptable', color: 'text-blue-400',  bgColor: 'bg-blue-500/15'  },
  concerning: { label: 'Concerning', color: 'text-red-400',   bgColor: 'bg-red-500/15'   },
};

export default function EvaluationsPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [sprints, setSprints]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sprintFilter, setSprintFilter]       = useState('all');
  const [tierFilter, setTierFilter]           = useState('all');
  const [finalizedFilter, setFinalizedFilter] = useState('all');

  useEffect(() => {
    fetch('/api/sprints').then(r => r.json()).then(j => setSprints(j.data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sprintFilter !== 'all')    params.set('sprint_id', sprintFilter);
    if (finalizedFilter !== 'all') params.set('finalized', finalizedFilter);
    fetch(`/api/evaluations?${params.toString()}`)
      .then(r => r.json())
      .then(j => setEvaluations(j.data ?? []))
      .finally(() => setLoading(false));
  }, [sprintFilter, finalizedFilter]);

  const filtered = evaluations.filter(e =>
    tierFilter === 'all' || e.performance_tier === tierFilter
  );

  const hasFilters = sprintFilter !== 'all' || tierFilter !== 'all' || finalizedFilter !== 'all';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evaluations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {filtered.length} evaluation{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sprintFilter} onValueChange={v => setSprintFilter(v ?? 'all')}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All Sprints" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sprints</SelectItem>
            {sprints.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={tierFilter} onValueChange={v => setTierFilter(v ?? 'all')}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="All Tiers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="excellent">Excellent</SelectItem>
            <SelectItem value="acceptable">Acceptable</SelectItem>
            <SelectItem value="concerning">Concerning</SelectItem>
          </SelectContent>
        </Select>

        <Select value={finalizedFilter} onValueChange={v => setFinalizedFilter(v ?? 'all')}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Finalized</SelectItem>
            <SelectItem value="false">Pending Review</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs"
            onClick={() => { setSprintFilter('all'); setTierFilter('all'); setFinalizedFilter('all'); }}>
            <Filter className="w-3 h-3" /> Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-44 pt-5" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No evaluations found</p>
          <p className="text-xs mt-1">Evaluations are generated automatically when a sprint completes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(ev => <EvaluationCard key={ev.id} evaluation={ev} />)}
        </div>
      )}
    </div>
  );
}

function EvaluationCard({ evaluation: ev }: { evaluation: any }) {
  const tier    = ev.performance_tier as PerformanceTier | null;
  const tierCfg = tier ? TIER_CONFIG[tier] : null;
  const initials = ev.user?.full_name
    ?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <Link href={`/evaluations/${ev.id}`}>
      <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
        <CardContent className="pt-5 pb-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{ev.user?.full_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[ev.user?.role as UserRole]}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {tierCfg && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierCfg.bgColor} ${tierCfg.color}`}>
                  {tierCfg.label}
                </span>
              )}
              {ev.is_finalized ? (
                <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5 text-green-400" /> Finalized
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] h-4 gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> Pending
                </Badge>
              )}
            </div>
          </div>

          {/* Sprint label */}
          {ev.sprint && (
            <p className="text-xs text-muted-foreground truncate">
              {ev.sprint.name} · {formatDate(ev.sprint.start_date)} – {formatDate(ev.sprint.end_date)}
            </p>
          )}

          {/* Key metrics */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <MetricMini label="Completion"  value={ev.sprint_completion_rate !== null ? `${ev.sprint_completion_rate}%` : '—'} />
              <MetricMini label="Deadline Hit" value={ev.deadline_hit_rate !== null ? `${ev.deadline_hit_rate}%` : '—'} />
              <MetricMini label="Tasks Done"  value={`${ev.completed_tasks ?? 0}/${ev.total_tasks ?? 0}`} />
              <MetricMini label="Revisions"   value={ev.attributable_revisions ?? '—'} highlight={(ev.attributable_revisions ?? 0) > 2} />
            </div>
            {ev.sprint_completion_rate !== null && (
              <Progress value={ev.sprint_completion_rate} className="h-1" />
            )}
          </div>

          {/* AI summary snippet */}
          {ev.ai_summary ? (
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed border-t pt-2">
              {ev.ai_summary}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground italic border-t pt-2">
              AI analysis not yet generated
            </p>
          )}

          {ev.manual_score !== null && (
            <div className="flex items-center gap-1 text-xs text-yellow-400">
              <Star className="w-3 h-3 fill-yellow-400" />
              <span className="font-semibold">{ev.manual_score}/10</span>
              <span className="text-muted-foreground">manual score</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function MetricMini({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-semibold tabular-nums text-sm ${highlight ? 'text-orange-400' : ''}`}>{value}</p>
    </div>
  );
}
