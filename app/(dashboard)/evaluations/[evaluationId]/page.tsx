'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Sparkles, CheckCircle2, AlertCircle,
  Loader2, Star, RotateCcw, TrendingUp, TrendingDown,
  Minus, Target, Clock, Zap, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { PerformanceTier, UserRole } from '@/types/database';

const TIER_CONFIG: Record<PerformanceTier, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  excellent:  { label: 'Excellent',  color: 'text-green-400', bgColor: 'bg-green-500/15',  icon: <TrendingUp className="w-4 h-4 text-green-400" />  },
  acceptable: { label: 'Acceptable', color: 'text-blue-400',  bgColor: 'bg-blue-500/15',   icon: <Minus className="w-4 h-4 text-blue-400" />        },
  concerning: { label: 'Concerning', color: 'text-red-400',   bgColor: 'bg-red-500/15',    icon: <TrendingDown className="w-4 h-4 text-red-400" />  },
};

export default function EvaluationDetailPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const [evaluation, setEvaluation]   = useState<any>(null);
  const [me, setMe]                   = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [saving, setSaving]           = useState(false);

  const [manualScore, setManualScore] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const load = useCallback(async () => {
    const [evRes, meRes] = await Promise.all([
      fetch(`/api/evaluations/${evaluationId}`).then(r => r.json()),
      fetch('/api/users/me').then(r => r.json()),
    ]);
    if (evRes.data) {
      setEvaluation(evRes.data);
      setManualScore(evRes.data.manual_score?.toString() ?? '');
      setManualNotes(evRes.data.manual_notes ?? '');
    }
    if (meRes.data) setMe(meRes.data);
    setLoading(false);
  }, [evaluationId]);

  useEffect(() => { load(); }, [load]);

  const isManager = me && ['studio_lead', 'producer'].includes(me.role);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/generate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Generation failed'); return; }
      if (json.ai_error) toast.warning(`Metrics updated. AI: ${json.ai_error}`);
      else toast.success('AI evaluation generated!');
      await load();
    } finally { setGenerating(false); }
  }

  async function handleSaveReview(finalize = false) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        manual_notes: manualNotes || undefined,
      };
      if (manualScore) {
        const score = Number(manualScore);
        if (isNaN(score) || score < 0 || score > 10) {
          toast.error('Score must be between 0 and 10');
          return;
        }
        body.manual_score = score;
      }
      if (finalize) body.is_finalized = true;

      const res = await fetch(`/api/evaluations/${evaluationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error?.message ?? 'Save failed'); return; }
      toast.success(finalize ? 'Evaluation finalized' : 'Review saved');
      await load();
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!evaluation) return (
    <div className="text-center py-20 text-muted-foreground">
      <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Evaluation not found</p>
      <Link href="/evaluations" className="mt-3 inline-block">
        <Button variant="outline" size="sm">Back</Button>
      </Link>
    </div>
  );

  const tier    = evaluation.performance_tier as PerformanceTier | null;
  const tierCfg = tier ? TIER_CONFIG[tier] : null;
  const initials = evaluation.user?.full_name
    ?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/evaluations">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{evaluation.user?.full_name}</h1>
                {tierCfg && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${tierCfg.bgColor} ${tierCfg.color}`}>
                    {tierCfg.icon} {tierCfg.label}
                  </span>
                )}
                {evaluation.is_finalized
                  ? <Badge variant="outline" className="gap-1 text-xs"><CheckCircle2 className="w-3 h-3 text-green-400" /> Finalized</Badge>
                  : <Badge variant="secondary" className="text-xs">Pending Review</Badge>
                }
              </div>
              <p className="text-sm text-muted-foreground">
                {ROLE_LABELS[evaluation.user?.role as UserRole]} ·{' '}
                {evaluation.sprint?.name ?? 'No sprint'} ·{' '}
                {evaluation.sprint ? `${formatDate(evaluation.sprint.start_date)} – ${formatDate(evaluation.sprint.end_date)}` : ''}
              </p>
            </div>
          </div>
        </div>

        {isManager && !evaluation.is_finalized && (
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="gap-1.5 shrink-0"
          >
            {generating
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />
            }
            {generating ? 'Generating…' : evaluation.ai_summary ? 'Re-generate AI' : 'Generate AI Report'}
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard icon={<Target className="w-4 h-4 text-primary" />}      label="Completion"   value={evaluation.sprint_completion_rate !== null ? `${evaluation.sprint_completion_rate}%` : '—'} sub={`${evaluation.completed_tasks ?? 0} / ${evaluation.total_tasks ?? 0} tasks`} />
        <MetricCard icon={<Clock className="w-4 h-4 text-blue-400" />}      label="Deadline Hit" value={evaluation.deadline_hit_rate !== null ? `${evaluation.deadline_hit_rate}%` : '—'} />
        <MetricCard icon={<Zap className="w-4 h-4 text-yellow-400" />}      label="ETA Accuracy" value={evaluation.avg_eta_accuracy !== null ? `${evaluation.avg_eta_accuracy}%` : '—'} />
        <MetricCard icon={<RotateCcw className="w-4 h-4 text-orange-400" />} label="Revisions"    value={evaluation.attributable_revisions ?? '—'} sub={`${evaluation.total_revisions ?? 0} total`} highlight={(evaluation.attributable_revisions ?? 0) > 2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="space-y-4">
          {/* Performance bar */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sprint Progress</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Completion',   value: evaluation.sprint_completion_rate },
                { label: 'Deadline Hit', value: evaluation.deadline_hit_rate },
                { label: 'ETA Accuracy', value: evaluation.avg_eta_accuracy },
              ].map(m => (
                <div key={m.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-semibold tabular-nums">{m.value !== null && m.value !== undefined ? `${m.value}%` : '—'}</span>
                  </div>
                  <Progress value={m.value ?? 0} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Manual score */}
          {isManager && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Manager Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Manual Score (0–10)</Label>
                  <Input
                    type="number" min="0" max="10" step="0.5"
                    placeholder="e.g. 8.5"
                    value={manualScore}
                    onChange={e => setManualScore(e.target.value)}
                    className="h-9"
                    disabled={evaluation.is_finalized}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    placeholder="Optional manager notes..."
                    value={manualNotes}
                    onChange={e => setManualNotes(e.target.value)}
                    className="min-h-[80px] resize-none text-sm"
                    disabled={evaluation.is_finalized}
                  />
                </div>
                {!evaluation.is_finalized && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      disabled={saving}
                      onClick={() => handleSaveReview(false)}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      Save Draft
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      disabled={saving || !evaluation.ai_summary}
                      onClick={() => handleSaveReview(true)}
                      title={!evaluation.ai_summary ? 'Generate AI report first' : ''}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                      Finalize
                    </Button>
                  </div>
                )}
                {evaluation.is_finalized && evaluation.reviewed_by && (
                  <p className="text-xs text-muted-foreground">
                    Reviewed by {evaluation.reviewer?.full_name ?? '—'} on {formatDate(evaluation.reviewed_at)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Manual score display for non-managers */}
          {!isManager && evaluation.manual_score !== null && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Manager Score</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {[...Array(10)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(evaluation.manual_score) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
                    />
                  ))}
                  <span className="text-sm font-bold ml-1">{evaluation.manual_score}/10</span>
                </div>
                {evaluation.manual_notes && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{evaluation.manual_notes}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: AI Report */}
        <div className="lg:col-span-2 space-y-4">
          {evaluation.ai_summary ? (
            <>
              <AISection
                icon={<Sparkles className="w-4 h-4 text-primary" />}
                title="Overall Summary"
                content={evaluation.ai_summary}
              />
              <AISection
                icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                title="Strengths"
                content={evaluation.ai_strengths}
                accent="green"
              />
              <AISection
                icon={<AlertCircle className="w-4 h-4 text-orange-400" />}
                title="Areas of Concern"
                content={evaluation.ai_concerns}
                accent="orange"
              />
              <AISection
                icon={<Target className="w-4 h-4 text-blue-400" />}
                title="Recommendations for Next Sprint"
                content={evaluation.ai_recommendations}
                accent="blue"
              />
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">AI Report Not Yet Generated</p>
                <p className="text-xs mt-1">
                  {isManager
                    ? 'Click "Generate AI Report" to run Claude analysis on this evaluation'
                    : 'Your manager will generate the AI analysis soon'}
                </p>
                {isManager && (
                  <Button size="sm" className="mt-4 gap-1.5" onClick={handleGenerate} disabled={generating}>
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {generating ? 'Generating…' : 'Generate Now'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Linked sprint */}
          {evaluation.sprint && (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">{evaluation.sprint.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{evaluation.sprint.status}</Badge>
                  </div>
                  <Link href={`/sprints/${evaluation.sprint.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">View Sprint</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1.5">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-orange-400' : ''}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AISection({ icon, title, content, accent }: {
  icon: React.ReactNode; title: string; content: string; accent?: 'green' | 'orange' | 'blue';
}) {
  const borderColor = accent === 'green' ? 'border-l-green-500'
    : accent === 'orange' ? 'border-l-orange-500'
    : accent === 'blue'   ? 'border-l-blue-500'
    : 'border-l-primary';

  return (
    <Card className={`border-l-2 ${borderColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}
