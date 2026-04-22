import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Sent02Icon } from '@hugeicons/core-free-icons';

import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/stores/auth-store';
import { useBlocks, useFloors } from '@/services/flats';
import {
  getNotificationById,
  sendNotification,
  type SendNotificationPayload,
} from '@/services/notifications';
import type {
  Notification,
  NotificationCategory,
  NotificationTarget,
} from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Inner form component — takes prefill as a prop and uses lazy useState
 * initializers. Parent re-mounts it via key= when the prefill id changes so
 * we never need to sync state via useEffect.
 */
function ComposeForm({ prefill }: { prefill: Notification | null }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: blocks = [] } = useBlocks();
  const { data: floors = [] } = useFloors();

  const [title, setTitle] = useState(prefill?.title ?? '');
  const [body, setBody] = useState(prefill?.body ?? '');
  const [category, setCategory] = useState<NotificationCategory>(
    prefill?.category ?? 'general',
  );
  const [targetType, setTargetType] = useState<NotificationTarget>(
    prefill?.target_type ?? 'all',
  );
  const [targetBlock, setTargetBlock] = useState(prefill?.target_block ?? '');
  const [targetFloor, setTargetFloor] = useState(prefill?.target_floor ?? '');
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const sendMutation = useMutation({
    mutationFn: (payload: SendNotificationPayload) => sendNotification(payload),
    onSuccess: (result) => {
      setSuccessCount(result.targetCount);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      setError(t.compose.sendError);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessCount(null);

    if (!title.trim() || !body.trim()) {
      setError(t.compose.validationRequired);
      return;
    }
    if (targetType === 'block' && !targetBlock) {
      setError(t.compose.validationRequired);
      return;
    }
    if (targetType === 'floor' && (!targetBlock || !targetFloor)) {
      setError(t.compose.validationRequired);
      return;
    }

    sendMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      category,
      targetType,
      targetBlock: targetType !== 'all' ? targetBlock : undefined,
      targetFloor: targetType === 'floor' ? targetFloor : undefined,
    });
  }

  return (
    <>
      {prefill && (
        <Alert className="mb-4">
          <AlertDescription>
            {t.compose.fromNotification} <strong>{prefill.title}</strong>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label>{t.compose.category}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as NotificationCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">{t.compose.categoryUrgent}</SelectItem>
                  <SelectItem value="general">{t.compose.categoryGeneral}</SelectItem>
                  <SelectItem value="event">{t.compose.categoryEvent}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.compose.target}</Label>
              <Select
                value={targetType}
                onValueChange={(v) => {
                  setTargetType(v as NotificationTarget);
                  if (v === 'all') {
                    setTargetBlock('');
                    setTargetFloor('');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.compose.targetAll}</SelectItem>
                  <SelectItem value="block">{t.compose.targetBlock}</SelectItem>
                  <SelectItem value="floor">{t.compose.targetFloor}</SelectItem>
                </SelectContent>
              </Select>

              {(targetType === 'block' || targetType === 'floor') && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Select value={targetBlock} onValueChange={setTargetBlock}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.compose.block} />
                    </SelectTrigger>
                    <SelectContent>
                      {blocks.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {targetType === 'floor' && (
                    <Select
                      value={targetFloor}
                      onValueChange={setTargetFloor}
                      disabled={!targetBlock}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.compose.floor} />
                      </SelectTrigger>
                      <SelectContent>
                        {floors.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-title">{t.compose.notifTitle}</Label>
              <Input
                id="notif-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={t.compose.notifTitlePlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-body">{t.compose.notifBody}</Label>
              <Textarea
                id="notif-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={t.compose.notifBodyPlaceholder}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successCount !== null && (
              <Alert>
                <AlertDescription>
                  {t.compose.sentCount(successCount)}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={sendMutation.isPending}
            >
              <HugeiconsIcon icon={Sent02Icon} size={18} />
              <span className="ml-2">
                {sendMutation.isPending ? t.compose.sending : t.compose.send}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

export default function ComposeNotificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = useT();
  const user = useAuthStore((s) => s.user);

  const fromId = searchParams.get('fromId');

  // Pre-fill from an existing notification when ?fromId=... is present.
  const { data: prefill, isLoading } = useQuery({
    queryKey: ['notification', fromId],
    queryFn: () => getNotificationById(fromId!),
    enabled: !!fromId,
  });

  if (user && user.role !== 'mgmt_staff' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          <span className="sr-only">{t.common.back}</span>
        </Button>
        <h1 className="text-xl font-bold">{t.compose.title}</h1>
      </div>

      {fromId && isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        // Remount the form when prefill identity changes so useState lazy
        // initializers pick up the new values.
        <ComposeForm
          key={prefill?.id ?? 'blank'}
          prefill={prefill ?? null}
        />
      )}
    </div>
  );
}
