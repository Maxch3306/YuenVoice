import api from '@/lib/api';
import type { UserNotification, PaginatedResponse } from '@/types';

export interface GetNotificationsParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
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
