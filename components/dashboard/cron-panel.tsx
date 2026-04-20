'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CronJob {
  id: string;
  label: string;
  description: string;
  path: string;
  schedule: string;
  scheduleHuman: string;
}

const CRON_JOBS: CronJob[] = [
  {
    id: 'morning-brief',
    label: 'Morning Brief',
    description: 'Sends each team member a personalised daily summary of their open tasks, overdue items and deadlines.',
    path: '/api/cron/morning-brief',
    schedule: '10 4 * * *',
    scheduleHuman: 'Daily at 9:10 AM PKT',
  },
  {
    id: 'eod-digest',
    label: 'End of Day Digest',
    description: 'Sends a summary of what was completed today and upcoming deadlines for the next 2 days.',
    path: '/api/cron/end-of-day-digest',
    schedule: '0 14 * * *',
    scheduleHuman: 'Daily at 7:00 PM PKT',
  },
  {
    id: 'sprint-end',
    label: 'Sprint End & Evaluations',
    description: 'Auto-completes sprints past their end date, moves unfinished tasks to backlog, and seeds evaluation stubs.',
    path: '/api/cron/sprint-end-evaluations',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
  },
  {
    id: 'overdue-check',
    label: 'Overdue Task Check',
    description: 'Scans for tasks past their deadline and notifies assignees and managers. Throttled to once per 22 hours per task.',
    path: '/api/cron/overdue-check',
    schedule: '0 */2 * * *',
    scheduleHuman: 'Every 2 hours',
  },
];

type RunStatus = 'idle' | 'running' | 'success' | 'error';

export function CronPanel() {
  const [statuses, setStatuses] = useState<Record<string, RunStatus>>({});
  const [results, setResults] = useState<Record<string, any>>({});

  async function runJob(job: CronJob) {
    setStatuses(prev => ({ ...prev, [job.id]: 'running' }));
    setResults(prev => ({ ...prev, [job.id]: null }));

    try {
      const res = await fetch(job.path, {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_DEV_SECRET ?? 'dev-cron-secret-change-in-production'}` },
      });
      const json = await res.json();

      if (!res.ok) {
        setStatuses(prev => ({ ...prev, [job.id]: 'error' }));
        setResults(prev => ({ ...prev, [job.id]: json.error ?? json }));
        toast.error(`${job.label} failed`);
      } else {
        setStatuses(prev => ({ ...prev, [job.id]: 'success' }));
        setResults(prev => ({ ...prev, [job.id]: json.data }));
        toast.success(`${job.label} ran successfully`);
      }
    } catch (err: any) {
      setStatuses(prev => ({ ...prev, [job.id]: 'error' }));
      setResults(prev => ({ ...prev, [job.id]: { message: err.message } }));
      toast.error(`${job.label} failed: ${err.message}`);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Scheduled Jobs</CardTitle>
        <p className="text-xs text-muted-foreground">
          Manually trigger cron jobs for testing. In production these run automatically via Vercel Cron.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {CRON_JOBS.map(job => {
          const status = statuses[job.id] ?? 'idle';
          const result = results[job.id];

          return (
            <div key={job.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{job.label}</p>
                    <StatusBadge status={status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{job.description}</p>
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{job.scheduleHuman}</span>
                    <span className="font-mono bg-muted px-1 py-0.5 rounded">{job.schedule}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0 h-8 text-xs"
                  disabled={status === 'running'}
                  onClick={() => runJob(job)}
                >
                  {status === 'running' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {status === 'running' ? 'Running…' : 'Run Now'}
                </Button>
              </div>

              {result && (
                <div className={`text-xs rounded-md px-3 py-2 font-mono ${
                  status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                }`}>
                  {JSON.stringify(result, null, 0)}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === 'idle') return null;
  if (status === 'running') return (
    <Badge variant="secondary" className="text-[10px] gap-1">
      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Running
    </Badge>
  );
  if (status === 'success') return (
    <Badge className="text-[10px] gap-1 bg-green-500/15 text-green-400 border-0">
      <CheckCircle2 className="w-2.5 h-2.5" /> Done
    </Badge>
  );
  return (
    <Badge variant="destructive" className="text-[10px] gap-1">
      <XCircle className="w-2.5 h-2.5" /> Error
    </Badge>
  );
}
