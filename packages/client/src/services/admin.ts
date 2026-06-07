import api from '@/lib/api';
import type {
  User,
  UserRole,
  Flat,
  AuditLog,
  PaginatedResponse,
} from '@/types';

// ─── Users ──────────────────────────────────────────────────────

export interface GetUsersParams {
  search?: string;
  role?: UserRole | '';
  page?: number;
  limit?: number;
}

export async function getUsers(
  params: GetUsersParams = {},
): Promise<PaginatedResponse<User>> {
  const { data } = await api.get<PaginatedResponse<User>>(
    '/api/admin/users',
    { params },
  );
  return data;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  flatId?: string;
}

export async function createUser(
  input: CreateUserInput,
): Promise<{ user: User; tempPassword: string }> {
  const { data } = await api.post<{ user: User; tempPassword: string }>(
    '/api/admin/users',
    input,
  );
  return data;
}

export async function updateRole(
  userId: string,
  role: UserRole,
): Promise<User> {
  const { data } = await api.patch<User>(
    `/api/admin/users/${userId}/role`,
    { role },
  );
  return data;
}

export async function updateStatus(
  userId: string,
  isActive: boolean,
): Promise<User> {
  const { data } = await api.patch<User>(
    `/api/admin/users/${userId}/status`,
    { isActive },
  );
  return data;
}

export async function resetUserPassword(
  userId: string,
): Promise<{ tempPassword: string }> {
  const { data } = await api.post<{ tempPassword: string }>(
    `/api/admin/users/${userId}/reset-password`,
  );
  return data;
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/api/admin/users/${userId}`);
}

export interface UserFlatSummary {
  id: string;
  block: string;
  floor: string;
  unit_number: string;
  is_primary: boolean;
  linked_at: string | null;
}

export async function getUserFlats(
  userId: string,
): Promise<UserFlatSummary[]> {
  const { data } = await api.get<{ data: UserFlatSummary[] }>(
    `/api/admin/users/${userId}/flats`,
  );
  return data.data;
}

export async function unlinkUserFlat(
  userId: string,
  flatId: string,
): Promise<void> {
  await api.delete(`/api/admin/users/${userId}/flats/${flatId}`);
}

// ─── Flats ──────────────────────────────────────────────────────

export interface GetFlatsParams {
  block?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getFlats(
  params: GetFlatsParams = {},
): Promise<PaginatedResponse<Flat>> {
  const { data } = await api.get<PaginatedResponse<Flat>>(
    '/api/admin/flats',
    { params },
  );
  return data;
}

export async function getFlatBlocks(): Promise<string[]> {
  const { data } = await api.get<string[]>('/api/admin/flats/blocks');
  return data;
}

export async function createFlat(data: {
  block: string;
  floor: string;
  unitNumber: string;
}): Promise<Flat> {
  const { data: flat } = await api.post<Flat>('/api/admin/flats', data);
  return flat;
}

export async function updateFlat(
  flatId: string,
  data: {
    block?: string;
    floor?: string;
    unitNumber?: string;
    isRegistrationOpen?: boolean;
  },
): Promise<Flat> {
  const { data: flat } = await api.patch<Flat>(
    `/api/admin/flats/${flatId}`,
    data,
  );
  return flat;
}

export async function deleteFlat(flatId: string): Promise<void> {
  await api.delete(`/api/admin/flats/${flatId}`);
}

export async function resetFlatPassword(
  flatId: string,
): Promise<{ newPassword: string }> {
  const { data } = await api.post<{ newPassword: string }>(
    `/api/admin/flats/${flatId}/reset-password`,
  );
  return data;
}

// ─── Audit Logs ─────────────────────────────────────────────────

export interface GetAuditLogsParams {
  search?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(
  params: GetAuditLogsParams = {},
): Promise<PaginatedResponse<AuditLog>> {
  const { data } = await api.get<PaginatedResponse<AuditLog>>(
    '/api/admin/audit-logs',
    { params },
  );
  return data;
}

// ─── Dashboard Stats ────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  openReports: number;
  postsThisWeek: number;
  totalDocuments: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/api/admin/stats');
  return data;
}
