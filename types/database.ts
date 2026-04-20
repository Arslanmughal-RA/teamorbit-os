export type UserRole =
  | 'studio_lead'
  | 'producer'
  | 'developer'
  | 'game_designer'
  | 'post_production_artist'
  | 'creative_artist'
  | 'ua_manager'
  | 'aso_specialist';

export type TaskStatus =
  | 'backlog'
  | 'in_progress'
  | 'waiting_for_assets'
  | 'submitted_for_review'
  | 'under_review'
  | 'revision_requested'
  | 'qa'
  | 'rejected_by_lead'
  | 'approved'
  | 'done';

export type TaskType =
  | 'dev'
  | 'game_art'
  | 'store_asset'
  | 'video_creative'
  | 'producer_task'
  | 'ua_task'
  | 'aso_task';

export type AccountabilityTag =
  | 'employee'
  | 'approver'
  | 'studio_lead'
  | 'external';

export type RevisionReason =
  | 'quality_issue'
  | 'brief_unclear'
  | 'scope_changed'
  | 'creative_direction_change'
  | 'technical_issue'
  | 'doesnt_match_reference'
  | 'performance_issue';

export type DeadlineMissReason =
  | 'underestimated_complexity'
  | 'blocked_by_dependency'
  | 'scope_expanded'
  | 'pulled_to_urgent_task'
  | 'personal_sick_day'
  | 'tool_environment_issue';

export type LeadRejectionReason =
  | 'strategic_pivot'
  | 'quality_below_standard'
  | 'conflicts_with_priority'
  | 'market_data_invalidated';

export type SprintStatus = 'planning' | 'active' | 'completed' | 'cancelled';

export type NotificationType =
  | 'task_assigned'
  | 'task_submitted_for_review'
  | 'revision_requested'
  | 'task_approved'
  | 'task_overdue'
  | 'sprint_starting'
  | 'sprint_ending'
  | 'morning_brief'
  | 'end_of_day_digest'
  | 'evaluation_ready'
  | 'lead_approval_needed';

export type NotificationChannel = 'slack' | 'email' | 'in_app';

export type PerformanceTier = 'excellent' | 'acceptable' | 'concerning';

// ============================================================
// TABLE TYPES
// ============================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  slack_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pod {
  id: string;
  name: string;
  description: string | null;
  is_studio_wide: boolean;
  created_at: string;
}

export interface PodMember {
  id: string;
  pod_id: string;
  user_id: string;
  joined_at: string;
}

export interface Sprint {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SprintPod {
  id: string;
  sprint_id: string;
  pod_id: string;
}

export interface Task {
  id: string;
  sprint_id: string | null;
  pod_id: string | null;
  title: string;
  description: string | null;
  task_type: TaskType;
  status: TaskStatus;
  assigned_to: string;
  created_by: string;
  approver_id: string | null;
  eta_hours: number | null;
  eta_set_at: string | null;
  deadline: string | null;
  started_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  done_at: string | null;
  revision_count: number;
  attributable_revision_count: number;
  work_link: string | null;
  blocker_description: string | null;
  priority: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  changed_by: string;
  notes: string | null;
  changed_at: string;
}

export interface Revision {
  id: string;
  task_id: string;
  requested_by: string;
  reason: RevisionReason;
  accountability: AccountabilityTag;
  notes: string;
  revision_number: number;
  created_at: string;
}

export interface LeadRejection {
  id: string;
  task_id: string;
  rejected_by: string;
  reason: LeadRejectionReason;
  notes: string;
  created_at: string;
}

export interface DeadlineMiss {
  id: string;
  task_id: string;
  logged_by: string;
  reason: DeadlineMissReason;
  accountability: AccountabilityTag;
  notes: string | null;
  original_eta_hours: number | null;
  actual_hours: number | null;
  confirmed_by_producer: boolean;
  created_at: string;
}

export interface TechnicalNote {
  id: string;
  task_id: string;
  author_id: string;
  note: string;
  is_blocking: boolean;
  created_at: string;
}

export interface Evaluation {
  id: string;
  user_id: string;
  sprint_id: string | null;
  period_start: string;
  period_end: string;
  total_tasks: number;
  completed_tasks: number;
  deadline_hit_rate: number | null;
  total_revisions: number;
  attributable_revisions: number;
  avg_eta_accuracy: number | null;
  sprint_completion_rate: number | null;
  performance_tier: PerformanceTier | null;
  ai_summary: string | null;
  ai_strengths: string | null;
  ai_concerns: string | null;
  ai_recommendations: string | null;
  manual_score: number | null;
  manual_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  related_task_id: string | null;
  related_sprint_id: string | null;
  is_read: boolean;
  is_sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface Settings {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

// ============================================================
// SUPABASE DATABASE TYPE
// ============================================================

export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User>; Relationships: [] };
      pods: { Row: Pod; Insert: Partial<Pod>; Update: Partial<Pod>; Relationships: [] };
      pod_members: { Row: PodMember; Insert: Partial<PodMember>; Update: Partial<PodMember>; Relationships: [] };
      sprints: { Row: Sprint; Insert: Partial<Sprint>; Update: Partial<Sprint>; Relationships: [] };
      sprint_pods: { Row: SprintPod; Insert: Partial<SprintPod>; Update: Partial<SprintPod>; Relationships: [] };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task>; Relationships: [] };
      task_status_history: { Row: TaskStatusHistory; Insert: Partial<TaskStatusHistory>; Update: Partial<TaskStatusHistory>; Relationships: [] };
      revisions: { Row: Revision; Insert: Partial<Revision>; Update: Partial<Revision>; Relationships: [] };
      lead_rejections: { Row: LeadRejection; Insert: Partial<LeadRejection>; Update: Partial<LeadRejection>; Relationships: [] };
      deadline_misses: { Row: DeadlineMiss; Insert: Partial<DeadlineMiss>; Update: Partial<DeadlineMiss>; Relationships: [] };
      technical_notes: { Row: TechnicalNote; Insert: Partial<TechnicalNote>; Update: Partial<TechnicalNote>; Relationships: [] };
      evaluations: { Row: Evaluation; Insert: Partial<Evaluation>; Update: Partial<Evaluation>; Relationships: [] };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification>; Relationships: [] };
      settings: { Row: Settings; Insert: Partial<Settings>; Update: Partial<Settings>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
