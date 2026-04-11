// ─── User & Auth ────────────────────────────────────────────────

export type UserRole = 'resident' | 'oc_committee' | 'mgmt_staff' | 'admin';

export interface User {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  flat_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  flat?: Flat;
}

export interface Flat {
  id: string;
  block: string;
  floor: string;
  unit_number: string;
  registration_password: string | null;
  is_registration_open: boolean;
  created_at: string;
  updated_at: string;
  residentCount?: number;
}

// ─── Incident Reports ───────────────────────────────────────────

export type ReportType = 'repair' | 'complaint' | 'inquiry';

export type ReportStatus = 'pending' | 'in_progress' | 'completed';

export type ReportPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IncidentReport {
  id: string;
  reporter_id: string;
  type: ReportType;
  title: string;
  description: string;
  location_block: string | null;
  location_floor: string | null;
  location_area: string | null;
  status: ReportStatus;
  priority: ReportPriority | null;
  created_at: string;
  updated_at: string;
  reporter?: User;
  attachments?: IncidentAttachment[];
  comments?: IncidentComment[];
}

export interface IncidentAttachment {
  id: string;
  report_id: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface IncidentComment {
  id: string;
  report_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: User;
}

// ─── Discussion ─────────────────────────────────────────────────

export type BoardScope = 'estate' | 'block' | 'floor';

export interface DiscussionBoard {
  id: string;
  name: string;
  scope_type: BoardScope;
  scope_block: string | null;
  scope_floor: string | null;
  created_at: string;
  postCount?: number;
  latestPost?: { title: string; created_at: string };
}

export interface DiscussionPost {
  id: string;
  board_id: string;
  author_id: string;
  title: string;
  body: string;
  is_anonymous: boolean;
  is_hidden: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: { id: string | null; name: string };
  images?: PostImage[];
  comments?: PostComment[];
  reactions?: PostReaction[];
  reactionCount?: number;
  commentCount?: number;
  userReacted?: boolean;
}

export interface PostImage {
  id: string;
  post_id: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  author?: { id: string | null; name: string };
}

export type ReactionType = 'like';

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  type: ReactionType;
  created_at: string;
}

// ─── OC Documents ───────────────────────────────────────────────

export type OcDocumentType =
  | 'meeting_minutes'
  | 'financial_statement'
  | 'resolution'
  | 'notice';

export interface OcDocument {
  id: string;
  publisher_id: string;
  type: OcDocumentType;
  title: string;
  description: string | null;
  file_path: string;
  year: number;
  created_at: string;
  updated_at: string;
  publisher?: User;
}

// ─── Notifications ──────────────────────────────────────────────

export type NotificationCategory = 'urgent' | 'general' | 'event';

export type NotificationTarget = 'all' | 'block' | 'floor';

export interface Notification {
  id: string;
  sender_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  target_type: NotificationTarget;
  target_block: string | null;
  target_floor: string | null;
  created_at: string;
  updated_at: string;
  sender?: User;
}

export interface UserNotification {
  id: string;
  notification_id: string;
  user_id: string;
  is_read: boolean;
  read_at: string | null;
  notification?: Notification;
}

// ─── Audit Log ──────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user?: User;
}

// ─── API Helpers ────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
