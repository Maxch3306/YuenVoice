import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Notification01Icon } from '@hugeicons/core-free-icons';

import {
  getNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
} from '@/services/notifications';
import { useNotificationStore } from '@/stores/notification-store';
import type { NotificationCategory, UserNotification } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const categoryConfig: Record<
  NotificationCategory,
  { label: string; className: string }
> = {
  urgent: { label: '緊急', className: 'bg-red-100 text-red-800 border-red-200' },
  general: { label: '一般', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  event: { label: '活動', className: 'bg-green-100 text-green-800 border-green-200' },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  return `${months} 個月前`;
}

export default function NotificationCenterPage() {
  const queryClient = useQueryClient();
  const storeMarkAsRead = useNotificationStore((s) => s.markAsRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', unreadOnly, page],
    queryFn: () =>
      getNotifications({ unreadOnly, page, limit: 20 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markAsReadApi(id),
    onSuccess: (_data, id) => {
      storeMarkAsRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllAsReadApi(),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  function handleNotificationClick(notification: UserNotification) {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    // If the notification has a related entity, could navigate to it.
    // For now we just mark as read.
  }

  const notifications = data?.data ?? [];
  const meta = data?.meta;
  const hasMore = meta ? page < meta.totalPages : false;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-2xl font-bold">通知中心</h1>

      {/* Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="unread-filter"
            checked={unreadOnly}
            onCheckedChange={(checked) => {
              setUnreadOnly(!!checked);
              setPage(1);
            }}
          />
          <Label htmlFor="unread-filter" className="cursor-pointer text-sm">
            只顯示未讀
          </Label>
        </div>

        <Button
          variant="link"
          size="sm"
          className="text-sm"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          全部標為已讀
        </Button>
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <HugeiconsIcon
            icon={Notification01Icon}
            size={48}
            className="opacity-40"
          />
          <p className="text-sm">暫無通知</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((item) => {
            const notif = item.notification;
            const category = notif?.category ?? 'general';
            const config = categoryConfig[category];

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    handleNotificationClick(item);
                }}
                className={cn(
                  'cursor-pointer rounded-xl px-4 py-3 transition-colors',
                  item.is_read
                    ? 'bg-card text-muted-foreground'
                    : 'border-l-4 border-primary bg-accent/30',
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  {!item.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}

                  <div className="min-w-0 flex-1">
                    {/* Category badge */}
                    <Badge
                      variant="outline"
                      className={cn('mb-1', config.className)}
                    >
                      {config.label}
                    </Badge>

                    {/* Title */}
                    <p
                      className={cn(
                        'text-sm',
                        item.is_read ? 'font-normal' : 'font-medium',
                      )}
                    >
                      {notif?.title}
                    </p>

                    {/* Body preview */}
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {notif?.body}
                    </p>

                    {/* Sender + Time */}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {notif?.sender?.name ?? '系統'}
                      {' \u00B7 '}
                      {notif ? relativeTime(notif.created_at) : ''}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => setPage((p) => p + 1)}
        >
          載入更多
        </Button>
      )}
    </div>
  );
}
