import { sendDirectMessage } from './client';
import { createServiceClient } from '@/lib/supabase/server';
import type { NotificationType, NotificationChannel } from '@/types/database';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// ─── Store an in-app notification + optionally send Slack DM ──────────────────

interface NotifyPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedTaskId?: string;
  relatedSprintId?: string;
  slackUserId?: string | null;
  channel?: NotificationChannel;
}

export async function notify(payload: NotifyPayload) {
  const {
    userId, type, title, body,
    relatedTaskId, relatedSprintId,
    slackUserId, channel = 'in_app',
  } = payload;

  const service = await createServiceClient();

  // Always store in-app
  await (service.from('notifications') as any).insert({
    user_id: userId,
    type,
    channel: 'in_app',
    title,
    body,
    related_task_id: relatedTaskId ?? null,
    related_sprint_id: relatedSprintId ?? null,
    is_read: false,
    is_sent: true,
    sent_at: new Date().toISOString(),
  });

  // Send Slack if configured and user has slack_user_id
  if (channel === 'slack' && slackUserId && process.env.SLACK_BOT_TOKEN) {
    try {
      const blocks = buildBlocks({ title, body, relatedTaskId, relatedSprintId });
      await sendDirectMessage(slackUserId, blocks, `${title}: ${body}`);

      await (service.from('notifications') as any).insert({
        user_id: userId,
        type,
        channel: 'slack',
        title,
        body,
        related_task_id: relatedTaskId ?? null,
        related_sprint_id: relatedSprintId ?? null,
        is_read: false,
        is_sent: true,
        sent_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Slack notify] Failed to send DM:', err);
    }
  }
}

function buildBlocks({
  title, body, relatedTaskId, relatedSprintId,
}: { title: string; body: string; relatedTaskId?: string; relatedSprintId?: string }) {
  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*\n${body}`,
      },
    },
  ];

  const actions: any[] = [];
  if (relatedTaskId) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'View Task' },
      url: `${APP_URL}/tasks/${relatedTaskId}`,
    });
  }
  if (relatedSprintId) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'View Sprint' },
      url: `${APP_URL}/sprints/${relatedSprintId}`,
    });
  }
  if (actions.length) {
    blocks.push({ type: 'actions', elements: actions });
  }

  return blocks;
}

// ─── Pre-built notification helpers ───────────────────────────────────────────

export async function notifyTaskAssigned(
  assignee: { id: string; slack_user_id: string | null; full_name: string },
  task: { id: string; title: string; sprint_id: string | null },
  assigner: { full_name: string }
) {
  await notify({
    userId: assignee.id,
    type: 'task_assigned',
    title: 'New Task Assigned',
    body: `${assigner.full_name} assigned you "${task.title}"`,
    relatedTaskId: task.id,
    relatedSprintId: task.sprint_id ?? undefined,
    slackUserId: assignee.slack_user_id,
    channel: 'slack',
  });
}

export async function notifyRevisionRequested(
  assignee: { id: string; slack_user_id: string | null },
  task: { id: string; title: string; sprint_id: string | null },
  requester: { full_name: string },
  revisionNum: number
) {
  await notify({
    userId: assignee.id,
    type: 'revision_requested',
    title: `Revision #${revisionNum} Requested`,
    body: `${requester.full_name} requested a revision on "${task.title}"`,
    relatedTaskId: task.id,
    relatedSprintId: task.sprint_id ?? undefined,
    slackUserId: assignee.slack_user_id,
    channel: 'slack',
  });
}

export async function notifyTaskApproved(
  assignee: { id: string; slack_user_id: string | null },
  task: { id: string; title: string; sprint_id: string | null },
  approver: { full_name: string }
) {
  await notify({
    userId: assignee.id,
    type: 'task_approved',
    title: 'Task Approved',
    body: `${approver.full_name} approved "${task.title}"`,
    relatedTaskId: task.id,
    relatedSprintId: task.sprint_id ?? undefined,
    slackUserId: assignee.slack_user_id,
    channel: 'slack',
  });
}

export async function notifySubmittedForReview(
  approver: { id: string; slack_user_id: string | null },
  task: { id: string; title: string; sprint_id: string | null },
  assignee: { full_name: string }
) {
  await notify({
    userId: approver.id,
    type: 'task_submitted_for_review',
    title: 'Task Submitted for Review',
    body: `${assignee.full_name} submitted "${task.title}" for your review`,
    relatedTaskId: task.id,
    relatedSprintId: task.sprint_id ?? undefined,
    slackUserId: approver.slack_user_id,
    channel: 'slack',
  });
}

export async function notifyLeadApprovalNeeded(
  lead: { id: string; slack_user_id: string | null },
  task: { id: string; title: string; sprint_id: string | null }
) {
  await notify({
    userId: lead.id,
    type: 'lead_approval_needed',
    title: 'Approval Needed',
    body: `Task "${task.title}" is ready for your sign-off`,
    relatedTaskId: task.id,
    relatedSprintId: task.sprint_id ?? undefined,
    slackUserId: lead.slack_user_id,
    channel: 'slack',
  });
}

export async function notifyTaskOverdue(
  assignee: { id: string; slack_user_id: string | null },
  task: { id: string; title: string; deadline: string; sprint_id: string | null }
) {
  await notify({
    userId: assignee.id,
    type: 'task_overdue',
    title: 'Task Overdue',
    body: `"${task.title}" was due ${new Date(task.deadline).toLocaleDateString()} and is still open`,
    relatedTaskId: task.id,
    relatedSprintId: task.sprint_id ?? undefined,
    slackUserId: assignee.slack_user_id,
    channel: 'slack',
  });
}

export async function notifySprintStarting(
  userId: string,
  slackUserId: string | null,
  sprint: { id: string; name: string; start_date: string; end_date: string }
) {
  await notify({
    userId,
    type: 'sprint_starting',
    title: 'Sprint Starting',
    body: `${sprint.name} begins today (${new Date(sprint.start_date).toLocaleDateString()} → ${new Date(sprint.end_date).toLocaleDateString()})`,
    relatedSprintId: sprint.id,
    slackUserId,
    channel: 'slack',
  });
}

export async function notifyEvaluationReady(
  userId: string,
  slackUserId: string | null,
  sprintName: string
) {
  await notify({
    userId,
    type: 'evaluation_ready',
    title: 'Performance Evaluation Ready',
    body: `Your evaluation for ${sprintName} is now available`,
    slackUserId,
    channel: 'slack',
  });
}
