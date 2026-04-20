import type { PerformanceTier } from '@/types/database';
import { DEFAULT_THRESHOLDS } from '@/lib/constants';

export interface TaskMetricsInput {
  id: string;
  status: string;
  deadline: string | null;
  done_at: string | null;
  eta_hours: number | null;
  started_at: string | null;
  revision_count: number;
  attributable_revision_count: number;
  task_type: string;
}

export interface RevisionInput {
  accountability: string;
  reason: string;
}

export interface DeadlineMissInput {
  accountability: string;
  reason: string;
  original_eta_hours: number | null;
  actual_hours: number | null;
}

export interface CalculatedMetrics {
  total_tasks: number;
  completed_tasks: number;
  deadline_hit_rate: number | null;
  total_revisions: number;
  attributable_revisions: number;
  avg_eta_accuracy: number | null;
  sprint_completion_rate: number | null;
  performance_tier: PerformanceTier | null;
  // Extra context for AI prompt
  task_type_breakdown: Record<string, number>;
  in_progress_tasks: number;
  revision_reasons: string[];
  deadline_miss_reasons: string[];
}

export function calculateMetrics(
  tasks: TaskMetricsInput[],
  revisions: RevisionInput[],
  deadlineMisses: DeadlineMissInput[]
): CalculatedMetrics {
  const total = tasks.length;
  const completed = tasks.filter(t => ['done', 'approved'].includes(t.status)).length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;

  // Deadline hit rate
  const tasksWithDeadline = tasks.filter(t => t.deadline && (t.done_at || ['done', 'approved'].includes(t.status)));
  const hitDeadline = tasksWithDeadline.filter(t => {
    if (!t.done_at || !t.deadline) return false;
    return new Date(t.done_at) <= new Date(t.deadline);
  }).length;
  const deadlineHitRate = tasksWithDeadline.length > 0
    ? Math.round((hitDeadline / tasksWithDeadline.length) * 100)
    : null;

  // ETA accuracy — compare eta_hours vs actual hours worked
  const tasksWithEta = tasks.filter(t =>
    t.eta_hours && t.started_at && t.done_at
  );
  let avgEtaAccuracy: number | null = null;
  if (tasksWithEta.length > 0) {
    const accuracies = tasksWithEta.map(t => {
      const actual = (new Date(t.done_at!).getTime() - new Date(t.started_at!).getTime()) / 3_600_000;
      const accuracy = Math.min(100, Math.round((t.eta_hours! / actual) * 100));
      return accuracy;
    });
    avgEtaAccuracy = Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length);
  }

  // Sprint completion rate
  const sprintCompletionRate = total > 0 ? Math.round((completed / total) * 100) : null;

  // Revision metrics
  const totalRevisions = tasks.reduce((s, t) => s + (t.revision_count ?? 0), 0);
  const attributableRevisions = tasks.reduce((s, t) => s + (t.attributable_revision_count ?? 0), 0);

  // Task type breakdown
  const taskTypeBreakdown: Record<string, number> = {};
  for (const t of tasks) {
    taskTypeBreakdown[t.task_type] = (taskTypeBreakdown[t.task_type] ?? 0) + 1;
  }

  // Performance tier — weighted scoring
  let tier: PerformanceTier | null = null;
  if (total > 0) {
    const t = DEFAULT_THRESHOLDS;
    let score = 0;
    let factors = 0;

    if (deadlineHitRate !== null) {
      score += deadlineHitRate >= t.deadline_hit_rate.excellent ? 2
        : deadlineHitRate >= t.deadline_hit_rate.acceptable ? 1 : 0;
      factors++;
    }
    if (sprintCompletionRate !== null) {
      score += sprintCompletionRate >= t.sprint_completion.excellent ? 2
        : sprintCompletionRate >= t.sprint_completion.acceptable ? 1 : 0;
      factors++;
    }
    if (total > 0) {
      const revPerTask = attributableRevisions / total;
      score += revPerTask <= t.attributable_revisions.excellent / 100 ? 2
        : revPerTask <= t.attributable_revisions.acceptable / 100 ? 1 : 0;
      factors++;
    }
    if (avgEtaAccuracy !== null) {
      score += avgEtaAccuracy >= t.eta_accuracy.excellent ? 2
        : avgEtaAccuracy >= t.eta_accuracy.acceptable ? 1 : 0;
      factors++;
    }

    if (factors > 0) {
      const avg = score / factors;
      tier = avg >= 1.6 ? 'excellent' : avg >= 0.8 ? 'acceptable' : 'concerning';
    }
  }

  return {
    total_tasks: total,
    completed_tasks: completed,
    in_progress_tasks: inProgress,
    deadline_hit_rate: deadlineHitRate,
    total_revisions: totalRevisions,
    attributable_revisions: attributableRevisions,
    avg_eta_accuracy: avgEtaAccuracy,
    sprint_completion_rate: sprintCompletionRate,
    performance_tier: tier,
    task_type_breakdown: taskTypeBreakdown,
    revision_reasons: revisions.map(r => r.reason),
    deadline_miss_reasons: deadlineMisses.map(d => d.reason),
  };
}
