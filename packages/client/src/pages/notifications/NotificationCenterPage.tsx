import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Notification01Icon,
  Notification03Icon,
  Sent02Icon,
  Edit02Icon,
  Repeat01Icon,
} from '@hugeicons/core-free-icons';

import {
  getNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
  resendNotification,
  subscribePush,
} from '@/services/notifications';
import { isPushSupported, requestPushPermission, subscribeToPush } from '@/lib/push';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { useT } from '@/lib/i18n';
import type { NotificationCategory, UserNotification } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const categoryStyleMap: Record<NotificationCategory, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  general: 'bg-blue-100 text-blue-800 border-blue-200',
  event: 'bg-green-100 text-green-800 border-green-200',
};

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storeMarkAsRead = useNotificationStore((s) => s.markAsRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const user = useAuthStore((s) => s.user);
  const canCompose = user?.role === 'mgmt_staff' || user?.role === 'admin';
  const t = useT();

  // Resend dialog state — one dialog shared across list items.
  const [resendTarget, setResendTarget] = useState<{
    id: string
    title: string
  } | null>(null);
  const [resendTitleOverride, setResendTitleOverride] = useState('');
  const [resendBodyOverride, setResendBodyOverride] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendSuccess, setResendSuccess] = useState<number | null>(null);

  const categoryConfig: Record<
    NotificationCategory,
    { label: string; className: string }
  > = {
    urgent: { label: t.notifCategory.urgent, className: categoryStyleMap.urgent },
    general: { label: t.notifCategory.general, className: categoryStyleMap.general },
    event: { label: t.notifCategory.event, className: categoryStyleMap.event },
  };

  function relativeTime(dateStr: string): string {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t.time.justNow;
    if (minutes < 60) return t.time.minutesAgo(minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t.time.hoursAgo(hours);
    const days = Math.floor(hours / 24);
    if (days < 30) return t.time.daysAgo(days);
    const months = Math.floor(days / 30);
    return t.time.monthsAgo(months);
  }

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pushStatus, setPushStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'sending' | 'sent' | 'unsupported' | 'denied' | 'error'>('idle');
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    if (!isPushSupported()) {
      setPushStatus('unsupported');
    }
  }, []);

  async function handleTestPush() {
    setPushError('');
    try {
      // Step 1: Request permission + subscribe
      setPushStatus('subscribing');
      const granted = await requestPushPermission();
      if (!granted) {
        setPushStatus('denied');
        setPushError(t.notifications.permissionHint);
        return;
      }

      // Fetch VAPID public key from server
      let vapidKey: string;
      try {
        const res = await api.get<{ key: string }>('/api/push/vapid-key');
        vapidKey = res.data.key;
      } catch {
        setPushStatus('error');
        setPushError(t.notifications.vapidError);
        return;
      }

      const subscription = await subscribeToPush(vapidKey);
      await subscribePush(subscription.toJSON() as any);

      // Step 2: Send test push
      setPushStatus('sending');
      const res = await api.post('/api/push/test');
      if (res.status === 200) {
        setPushStatus('sent');
        setTimeout(() => setPushStatus('subscribed'), 3000);
      }
    } catch (err: any) {
      setPushStatus('error');
      setPushError(err?.response?.data?.error ?? err?.message ?? t.notifications.testFailed);
    }
  }

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

  const resendMutation = useMutation({
    mutationFn: async (args: {
      id: string
      title?: string
      body?: string
    }) => resendNotification(args.id, { title: args.title, body: args.body }),
    onSuccess: (result) => {
      setResendSuccess(result.targetCount);
      setResendError('');
      // Auto-close after a short confirmation.
      setTimeout(() => {
        setResendTarget(null);
        setResendTitleOverride('');
        setResendBodyOverride('');
        setResendSuccess(null);
      }, 1500);
    },
    onError: () => {
      setResendError(t.notifications.resendFailed);
    },
  });

  function openResend(id: string, title: string) {
    setResendTarget({ id, title });
    setResendTitleOverride('');
    setResendBodyOverride('');
    setResendError('');
    setResendSuccess(null);
  }

  function confirmResend() {
    if (!resendTarget) return;
    resendMutation.mutate({
      id: resendTarget.id,
      title: resendTitleOverride.trim() || undefined,
      body: resendBodyOverride.trim() || undefined,
    });
  }

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.notifications.title}</h1>
        {canCompose && (
          <Button onClick={() => navigate('/notifications/compose')}>
            <HugeiconsIcon icon={Sent02Icon} size={16} />
            <span className="ml-1.5">{t.notifications.compose}</span>
          </Button>
        )}
      </div>

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
            {t.notifications.unreadOnly}
          </Label>
        </div>

        <Button
          variant="link"
          size="sm"
          className="text-sm"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          {t.notifications.markAllRead}
        </Button>
      </div>

      {/* Push test */}
      <div className="mb-4 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Notification03Icon} size={18} className="text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">{t.notifications.pushNotifications}</span>
          {pushStatus === 'unsupported' ? (
            <span className="text-xs text-muted-foreground">{t.notifications.browserNotSupported}</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestPush}
              disabled={pushStatus === 'subscribing' || pushStatus === 'sending'}
            >
              {pushStatus === 'subscribing' && t.notifications.subscribing}
              {pushStatus === 'sending' && t.notifications.testSending}
              {pushStatus === 'sent' && t.notifications.testSent}
              {(pushStatus === 'idle' || pushStatus === 'subscribed' || pushStatus === 'denied' || pushStatus === 'error') && t.notifications.testPush}
            </Button>
          )}
        </div>
        {pushError && (
          <p className="mt-2 text-xs text-destructive">{pushError}</p>
        )}
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
          <p className="text-sm">{t.notifications.empty}</p>
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
                      {notif?.sender?.name ?? t.adminDashboard.system}
                      {' \u00B7 '}
                      {notif ? relativeTime(notif.created_at) : ''}
                    </p>

                    {/* Mgmt/admin actions — reminder via new notification OR re-push original */}
                    {canCompose && notif && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/notifications/compose?fromId=${notif.id}`);
                          }}
                        >
                          <HugeiconsIcon icon={Edit02Icon} size={14} />
                          <span className="ml-1">{t.notifications.remind}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openResend(notif.id, notif.title);
                          }}
                        >
                          <HugeiconsIcon icon={Repeat01Icon} size={14} />
                          <span className="ml-1">{t.notifications.resend}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Re-push dialog — mgmt/admin only */}
      <AlertDialog
        open={!!resendTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResendTarget(null);
            setResendTitleOverride('');
            setResendBodyOverride('');
            setResendError('');
            setResendSuccess(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.notifications.resendConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.notifications.resendConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">
              {t.notifications.resendOptionalPrefix}
            </Label>
            <Input
              value={resendTitleOverride}
              onChange={(e) => setResendTitleOverride(e.target.value)}
              placeholder={resendTarget?.title ?? ''}
              maxLength={200}
            />
            <Textarea
              value={resendBodyOverride}
              onChange={(e) => setResendBodyOverride(e.target.value)}
              rows={3}
              maxLength={2000}
            />
            {resendError && (
              <p className="text-sm text-destructive">{resendError}</p>
            )}
            {resendSuccess !== null && (
              <p className="text-sm text-primary">
                {t.notifications.resent} ({t.compose.sentCount(resendSuccess)})
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmResend}
              disabled={resendMutation.isPending}
            >
              {resendMutation.isPending ? t.common.sending : t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Load More */}
      {hasMore && (
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => setPage((p) => p + 1)}
        >
          {t.common.loadMore}
        </Button>
      )}
    </div>
  );
}
