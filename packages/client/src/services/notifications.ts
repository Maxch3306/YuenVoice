import api from '@/lib/api';
import type {
  Notification,
  NotificationCategory,
  NotificationTarget,
  UserNotification,
  PaginatedResponse,
} from '@/types';

export interface GetNotificationsParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface SendNotificationPayload {
  title: string;
  body: string;
  category: NotificationCategory;
  targetType: NotificationTarget;
  targetBlock?: string;
  targetFloor?: string;
}

export async function sendNotification(
  payload: SendNotificationPayload,
): Promise<Notification & { targetCount: number }> {
  const { data } = await api.post<Notification & { targetCount: number }>(
    '/api/notifications',
    payload,
  );
  return data;
}

export async function getNotificationById(id: string): Promise<Notification> {
  const { data } = await api.get<Notification>(`/api/notifications/${id}`);
  return data;
}

export async function resendNotification(
  id: string,
  overrides?: { title?: string; body?: string },
): Promise<{ id: string; targetCount: number }> {
  const { data } = await api.post<{ id: string; targetCount: number }>(
    `/api/notifications/${id}/resend`,
    overrides ?? {},
  );
  return data;
}

export async function getNotifications(
  params: GetNotificationsParams = {},
): Promise<PaginatedResponse<UserNotification>> {
  const { data } = await api.get<PaginatedResponse<UserNotification>>(
    '/api/notifications',
    { params },
  );
  return data;
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch('/api/notifications/read-all');
}

export async function subscribePush(
  subscription: PushSubscriptionJSON,
): Promise<void> {
  await api.post('/api/push/subscribe', subscription);
}

export async function unsubscribePush(endpoint?: string): Promise<void> {
  await api.delete('/api/push/subscribe', { data: endpoint ? { endpoint } : undefined });
}
