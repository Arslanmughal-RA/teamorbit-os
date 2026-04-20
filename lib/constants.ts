import type { TaskType, UserRole, TaskStatus } from '@/types/database';

export const APPROVAL_MATRIX: Record<TaskType, UserRole> = {
  dev: 'producer',
  game_art: 'producer',
  store_asset: 'aso_specialist',
  video_creative: 'ua_manager',
  producer_task: 'studio_lead',
  ua_task: 'studio_lead',
  aso_task: 'studio_lead',
};

export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['in_progress'],
  in_progress: ['submitted_for_review', 'waiting_for_assets', 'rejected_by_lead'],
  waiting_for_assets: ['in_progress', 'rejected_by_lead'],
  submitted_for_review: ['under_review', 'rejected_by_lead'],
  under_review: ['revision_requested', 'qa', 'approved', 'rejected_by_lead'],
  revision_requested: ['in_progress', 'rejected_by_lead'],
  qa: ['approved', 'revision_requested', 'rejected_by_lead'],
  approved: ['done'],
  rejected_by_lead: [],
  done: [],
};

export const DEFAULT_THRESHOLDS = {
  deadline_hit_rate: { excellent: 95, acceptable: 80, concerning: 60 },
  attributable_revisions: { excellent: 5, acceptable: 10, concerning: 15 },
  eta_accuracy: { excellent: 100, acceptable: 80, concerning: 60 },
  sprint_completion: { excellent: 90, acceptable: 75, concerning: 60 },
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  dev: 'Development',
  game_art: 'Game Art',
  store_asset: 'Store Asset',
  video_creative: 'Video Creative',
  producer_task: 'Producer Task',
  ua_task: 'UA Task',
  aso_task: 'ASO Task',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  waiting_for_assets: 'Waiting for Assets',
  submitted_for_review: 'Submitted for Review',
  under_review: 'Under Review',
  revision_requested: 'Revision Requested',
  qa: 'QA',
  rejected_by_lead: 'Rejected by Lead',
  approved: 'Approved',
  done: 'Done',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  studio_lead: 'Studio Lead',
  producer: 'Producer',
  developer: 'Developer',
  game_designer: 'Game Designer',
  post_production_artist: 'Post-Production Artist',
  creative_artist: 'Creative Artist',
  ua_manager: 'UA Manager',
  aso_specialist: 'ASO Specialist',
};

export const TIMEZONE = 'Asia/Karachi';

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
