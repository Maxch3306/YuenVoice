import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Location01Icon,
  Calendar01Icon,
  LockIcon,
  Sent02Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { Translations } from '@/lib/translations';
import { useAuthStore } from '@/stores/auth-store';
import { useReport, useUpdateStatus, useAddComment } from '@/services/reports';
import type { ReportStatus, ReportType, IncidentReport, IncidentComment } from '@/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Status styles (language-independent) ───────────────────────

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const STATUS_ORDER: ReportStatus[] = ['pending', 'in_progress', 'completed'];

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildLocation(report: IncidentReport, t: Translations): string {
  const parts: string[] = [];
  if (report.location_block) parts.push(`${report.location_block}${t.common.block}`);
  if (report.location_floor) parts.push(`${report.location_floor}${t.common.floor}`);
  if (report.location_area) parts.push(report.location_area);
  return parts.join(' ') || '—';
}

function isImage(fileType: string) {
  return fileType.startsWith('image/');
}

function isMgmt(role?: string) {
  return role === 'mgmt_staff' || role === 'admin';
}

// ─── Status Timeline ────────────────────────────────────────────

function StatusTimeline({ report, t }: { report: IncidentReport; t: Translations }) {
  const currentIndex = STATUS_ORDER.indexOf(report.status);

  const STATUS_LABELS: Record<ReportStatus, string> = {
    pending: t.reportStatus.pending,
    in_progress: t.reportStatus.in_progress,
    completed: t.reportStatus.resolved,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.reportDetail.statusProgress}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {STATUS_ORDER.map((status, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;
            const isLast = index === STATUS_ORDER.length - 1;

            return (
              <div key={status} className="flex gap-3">
                {/* Dot + line */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
                      isActive
                        ? 'bg-primary'
                        : 'border-2 border-muted-foreground/30 bg-background',
                    )}
                  >
                    {isCurrent && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        'my-1 w-0.5 flex-1',
                        isActive && index < currentIndex
                          ? 'bg-primary'
                          : 'bg-muted-foreground/20',
                      )}
                      style={{ minHeight: 24 }}
                    />
                  )}
                </div>

                {/* Text */}
                <div className="pb-4">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </p>
                  {isActive && status === 'pending' && (
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(report.created_at)} — {t.reportDetail.statusPending}
                    </p>
                  )}
                  {isActive && status === 'in_progress' && (
                    <p className="text-xs text-muted-foreground">
                      {t.reportDetail.statusInProgress}
                    </p>
                  )}
                  {isActive && status === 'completed' && (
                    <p className="text-xs text-muted-foreground">
                      {t.reportDetail.statusResolved}
                    </p>
                  )}
                  {!isActive && (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Attachments Gallery ────────────────────────────────────────

function AttachmentGallery({ report, t }: { report: IncidentReport; t: Translations }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const attachments = report.attachments ?? [];

  if (attachments.length === 0) return null;

  const apiBase = import.meta.env.VITE_API_URL || '';

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.reportDetail.attachments} ({attachments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {attachments.map((att) => {
              const src = `${apiBase}/uploads/${att.file_path}`;
              if (isImage(att.file_type)) {
                return (
                  <button
                    key={att.id}
                    type="button"
                    className="aspect-square overflow-hidden rounded-md border"
                    onClick={() => setLightboxSrc(src)}
                  >
                    <img
                      src={src}
                      alt={t.reportDetail.attachments}
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              }
              return (
                <a
                  key={att.id}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex aspect-square items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground"
                >
                  {t.reportDetail.downloadAttachment}
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      <Dialog open={!!lightboxSrc} onOpenChange={() => setLightboxSrc(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{t.reportDetail.attachmentPreview}</DialogTitle>
          {lightboxSrc && (
            <img
              src={lightboxSrc}
              alt={t.reportDetail.attachments}
              className="max-h-[80vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Comments Section ───────────────────────────────────────────

function CommentsSection({ report, t }: { report: IncidentReport; t: Translations }) {
  const user = useAuthStore((s) => s.user);
  const addCommentMutation = useAddComment();
  const [commentText, setCommentText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  const comments = report.comments ?? [];
  const mgmt = isMgmt(user?.role);

  // Filter internal comments for non-mgmt users
  const visibleComments = mgmt
    ? comments
    : comments.filter((c) => !c.is_internal);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addCommentMutation.mutateAsync({
        id: report.id,
        content: commentText.trim(),
        isInternal: mgmt ? isInternalNote : undefined,
      });
      setCommentText('');
      setIsInternalNote(false);
    } catch {
      // handled by mutation
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t.reportDetail.comments} ({visibleComments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleComments.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.reportDetail.noComments}</p>
        )}

        {visibleComments.map((comment) => (
          <CommentCard key={comment.id} comment={comment} t={t} />
        ))}

        <Separator />

        {/* Add comment form */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t.reportDetail.commentPlaceholder}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <div>
              {mgmt && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={isInternalNote}
                    onCheckedChange={(checked) =>
                      setIsInternalNote(checked === true)
                    }
                  />
                  <HugeiconsIcon icon={LockIcon} className="size-3.5" />
                  {t.reportDetail.internalNote}
                </label>
              )}
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!commentText.trim() || addCommentMutation.isPending}
            >
              <HugeiconsIcon icon={Sent02Icon} className="size-4" />
              {addCommentMutation.isPending ? t.common.sending : t.common.send}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CommentCard({ comment, t }: { comment: IncidentComment; t: Translations }) {
  if (comment.is_internal) {
    return (
      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={LockIcon} className="size-3" />
          <span className="font-medium">{t.reportDetail.internalNote}</span>
          <span>&middot;</span>
          <span>{comment.author?.name ?? t.reportDetail.mgmtStaff}</span>
          <span>&middot;</span>
          <span>{formatDateTime(comment.created_at)}</span>
        </div>
        <p className="text-sm">{comment.content}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {comment.author?.name ?? t.common.anonymous}
        </span>
        <span>&middot;</span>
        <span>{formatDateTime(comment.created_at)}</span>
      </div>
      <p className="text-sm">{comment.content}</p>
    </div>
  );
}

// ─── Management Controls ────────────────────────────────────────

function MgmtControls({ report, t }: { report: IncidentReport; t: Translations }) {
  const user = useAuthStore((s) => s.user);
  const updateStatusMutation = useUpdateStatus();

  if (!isMgmt(user?.role)) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.reportDetail.mgmtActions}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {report.status === 'pending' && (
            <Button
              variant="outline"
              onClick={() =>
                updateStatusMutation.mutate({
                  id: report.id,
                  status: 'in_progress',
                })
              }
              disabled={updateStatusMutation.isPending}
            >
              {t.reportDetail.startProgress}
            </Button>
          )}
          {(report.status === 'pending' || report.status === 'in_progress') && (
            <Button
              variant="outline"
              onClick={() =>
                updateStatusMutation.mutate({
                  id: report.id,
                  status: 'completed',
                })
              }
              disabled={updateStatusMutation.isPending}
            >
              {t.reportDetail.markResolved}
            </Button>
          )}
          {report.status === 'completed' && (
            <p className="text-sm text-muted-foreground">{t.reportDetail.resolvedMessage}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { data: report, isLoading, isError } = useReport(id!);

  const TYPE_LABELS: Record<ReportType, string> = {
    repair: t.reportType.maintenance,
    complaint: t.reportType.complaint,
    inquiry: t.reportType.inquiry,
  };

  const STATUS_LABELS: Record<ReportStatus, string> = {
    pending: t.reportStatus.pending,
    in_progress: t.reportStatus.in_progress,
    completed: t.reportStatus.resolved,
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          </Button>
          <h1 className="text-xl font-bold">{t.reportDetail.title}</h1>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          {t.reportDetail.loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          <span className="sr-only">{t.common.back}</span>
        </Button>
        <h1 className="text-xl font-bold">{t.reportDetail.title}</h1>
      </div>

      {/* Report header card */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{TYPE_LABELS[report.type]}</Badge>
            <Badge className={cn('border-0', STATUS_STYLES[report.status])}>
              {STATUS_LABELS[report.status]}
            </Badge>
          </div>

          <h2 className="text-lg font-semibold">{report.title}</h2>

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Calendar01Icon} className="size-3.5" />
              {formatDate(report.created_at)} {t.reports.submitted}
            </span>
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Location01Icon} className="size-3.5" />
              {buildLocation(report, t)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Status timeline */}
      <StatusTimeline report={report} t={t} />

      {/* Description */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.reportDetail.description}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {report.description}
          </p>
        </CardContent>
      </Card>

      {/* Attachments */}
      <AttachmentGallery report={report} t={t} />

      {/* Management controls */}
      <MgmtControls report={report} t={t} />

      {/* Comments */}
      <CommentsSection report={report} t={t} />
    </div>
  );
}
