import { anthropic, CLAUDE_MODEL } from '@/lib/claude/client';
import type { CalculatedMetrics } from './calculate-metrics';
import { TASK_TYPE_LABELS, ROLE_LABELS } from '@/lib/constants';
import type { UserRole, TaskType } from '@/types/database';

export interface AIReport {
  summary: string;
  strengths: string;
  concerns: string;
  recommendations: string;
}

export async function generateEvaluationReport(
  user: { full_name: string; role: UserRole },
  sprint: { name: string; start_date: string; end_date: string },
  metrics: CalculatedMetrics
): Promise<AIReport> {
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  const taskTypeLines = Object.entries(metrics.task_type_breakdown)
    .map(([type, count]) => `  - ${TASK_TYPE_LABELS[type as TaskType] ?? type}: ${count}`)
    .join('\n');

  const revisionReasonsSummary = metrics.revision_reasons.length > 0
    ? [...new Set(metrics.revision_reasons)].map(r => r.replace(/_/g, ' ')).join(', ')
    : 'none';

  const deadlineMissReasonsSummary = metrics.deadline_miss_reasons.length > 0
    ? [...new Set(metrics.deadline_miss_reasons)].map(r => r.replace(/_/g, ' ')).join(', ')
    : 'none';

  const prompt = `You are a performance review assistant for a mobile game studio called TeamOrbit. You are generating a sprint performance evaluation for a team member. Be direct, constructive, and specific. Use professional tone. Avoid generic platitudes.

## Team Member
- Name: ${user.full_name}
- Role: ${roleLabel}

## Sprint
- Name: ${sprint.name}
- Period: ${new Date(sprint.start_date).toLocaleDateString('en', { month: 'long', day: 'numeric' })} – ${new Date(sprint.end_date).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}

## Performance Metrics
- Total tasks assigned: ${metrics.total_tasks}
- Tasks completed (done/approved): ${metrics.completed_tasks}
- Sprint completion rate: ${metrics.sprint_completion_rate !== null ? `${metrics.sprint_completion_rate}%` : 'N/A'}
- Deadline hit rate: ${metrics.deadline_hit_rate !== null ? `${metrics.deadline_hit_rate}%` : 'N/A'}
- Average ETA accuracy: ${metrics.avg_eta_accuracy !== null ? `${metrics.avg_eta_accuracy}%` : 'N/A'}
- Total revisions received: ${metrics.total_revisions}
- Attributable revisions (employee accountability): ${metrics.attributable_revisions}
- Overall performance tier: ${metrics.performance_tier ?? 'N/A'}

## Task Type Breakdown
${taskTypeLines || '  - No tasks'}

## Revision Reasons
${revisionReasonsSummary}

## Deadline Miss Reasons
${deadlineMissReasonsSummary}

---

Generate a JSON response with exactly these four fields. Each field should be 2–4 sentences. Be specific to the data — don't invent details not supported by the numbers.

{
  "summary": "Overall sprint performance summary paragraph",
  "strengths": "Key strengths demonstrated this sprint, citing specific metrics",
  "concerns": "Areas of concern or underperformance, with specific metrics. If all metrics are strong, state that no significant concerns were identified.",
  "recommendations": "Concrete, actionable recommendations for next sprint"
}

Respond with valid JSON only — no markdown, no explanation outside the JSON.`;

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = message.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  // Extract JSON — handle possible markdown code fences
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude returned unexpected format: ${rawText.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as AIReport;

  if (!parsed.summary || !parsed.strengths || !parsed.concerns || !parsed.recommendations) {
    throw new Error('Claude response missing required fields');
  }

  return parsed;
}
