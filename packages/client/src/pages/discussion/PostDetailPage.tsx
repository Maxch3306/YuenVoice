import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PinIcon,
  FavouriteIcon,
  Flag01Icon,
  Delete01Icon,
  ViewOffIcon,
  SentIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  usePost,
  useToggleReaction,
  useAddComment,
  useFlagPost,
  useModeratePost,
} from '@/services/discussions';
import { useAuthStore } from '@/stores/auth-store';
import { useT } from '@/lib/i18n';
import type { DiscussionPost, PostComment as TPostComment } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function AuthorName({
  isAnonymous,
  name,
}: {
  isAnonymous: boolean;
  name?: string;
}) {
  const t = useT();
  if (isAnonymous) {
    return <span className="italic text-muted-foreground">{t.common.anonymous}</span>;
  }
  return <span>{name ?? t.common.user}</span>;
}

// ─── Image Lightbox ─────────────────────────────────────────────

function ImageLightbox({
  images,
  open,
  initialIndex,
  onClose,
}: {
  images: { id: string; file_path: string }[];
  open: boolean;
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const t = useT();

  // Sync index when lightbox opens with a different image
  if (open && index !== initialIndex && initialIndex >= 0) {
    // This is intentional — we reset on open
  }

  const current = images[index];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-4 bg-background/95 p-2 sm:p-6">
        <DialogTitle className="sr-only">{t.postDetail.imageViewer}</DialogTitle>
        <img
          src={`/uploads/${current.file_path}`}
          alt=""
          className="max-h-[75vh] max-w-full rounded-lg object-contain"
        />
        {images.length > 1 && (
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={index <= 0}
              onClick={() => setIndex((i) => i - 1)}
              aria-label={t.postDetail.prevImage}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
            </Button>
            <span className="text-sm text-muted-foreground">
              {index + 1} / {images.length}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={index >= images.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              aria-label={t.postDetail.nextImage}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Flag Dialog ────────────────────────────────────────────────

function FlagButton({ postId }: { postId: string }) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const flag = useFlagPost();
  const t = useT();

  async function handleFlag() {
    await flag.mutateAsync({ postId, reason: reason.trim() || undefined });
    setReason('');
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <HugeiconsIcon icon={Flag01Icon} size={16} />
          {t.postDetail.flag}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.postDetail.flagTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.postDetail.flagPlaceholder}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder={t.postDetail.flagPlaceholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleFlag}
            disabled={flag.isPending}
          >
            {flag.isPending ? t.common.submitting : t.postDetail.flagSubmit}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Comment Item ───────────────────────────────────────────────

function CommentItem({ comment }: { comment: TPostComment }) {
  return (
    <div className="py-3">
      <div className="mb-1 flex items-center gap-2 text-sm">
        <AuthorName
          isAnonymous={comment.is_anonymous}
          name={comment.author?.name}
        />
        <span className="text-muted-foreground">&middot;</span>
        <span className="text-xs text-muted-foreground">
          {formatDateShort(comment.created_at)}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{comment.content}</p>
    </div>
  );
}

// ─── Add Comment Form ───────────────────────────────────────────

function AddCommentForm({ postId }: { postId: string }) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const addComment = useAddComment(postId);
  const t = useT();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await addComment.mutateAsync({
      content: content.trim(),
      isAnonymous,
    });
    setContent('');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <Textarea
        placeholder={t.postDetail.commentPlaceholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="comment-anon"
            checked={isAnonymous}
            onCheckedChange={setIsAnonymous}
          />
          <Label
            htmlFor="comment-anon"
            className="cursor-pointer text-xs text-muted-foreground"
          >
            {t.postDetail.anonymousComment}
          </Label>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || addComment.isPending}
        >
          <HugeiconsIcon icon={SentIcon} size={16} />
          {addComment.isPending ? t.common.sending : t.common.send}
        </Button>
      </div>
    </form>
  );
}

// ─── Moderation Controls ────────────────────────────────────────

function ModerationControls({
  post,
  postId,
}: {
  post: DiscussionPost;
  postId: string;
}) {
  const moderate = useModeratePost(postId);
  const t = useT();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={moderate.isPending}
        onClick={() => moderate.mutate(post.is_pinned ? 'unpin' : 'pin')}
      >
        <HugeiconsIcon icon={PinIcon} size={16} />
        {post.is_pinned ? t.postDetail.unpin : t.postDetail.pin}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={ViewOffIcon} size={16} />
            {t.postDetail.hidePost}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.postDetail.hideTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.postDetail.hideMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => moderate.mutate('hide')}
              disabled={moderate.isPending}
            >
              {t.postDetail.hideConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <HugeiconsIcon icon={Delete01Icon} size={16} />
            {t.common.delete}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.postDetail.deletePost}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.postDetail.deleteMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => moderate.mutate('delete')}
              disabled={moderate.isPending}
            >
              {t.postDetail.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: post, isLoading, isError } = usePost(postId ?? '');
  const toggleReaction = useToggleReaction(postId ?? '');
  const t = useT();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isMgmt = user?.role === 'mgmt_staff' || user?.role === 'admin';

  const reactions = post?.reactions ?? [];
  const reactionCount = reactions.length;
  const userReacted = reactions.some((r) => r.user_id === user?.id);
  const comments = post?.comments ?? [];
  const images = post?.images ?? [];

  function handleLike() {
    if (!postId) return;
    toggleReaction.mutate('like');
  }

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  // Loading
  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-2 h-6 w-72" />
        <Skeleton className="mb-6 h-4 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Error
  if (isError || !post) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t.postDetail.back}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t.postDetail.loadError}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Back */}
      <div className="mb-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/discussion/${post.board_id}`)}
          aria-label={t.postDetail.back}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
        </Button>
        <span className="text-sm text-muted-foreground">{t.postDetail.title}</span>
      </div>

      {/* Post Header */}
      <div className="mb-4">
        {post.is_pinned && (
          <Badge variant="secondary" className="mb-2">
            <HugeiconsIcon icon={PinIcon} size={12} />
            {t.common.pinned}
          </Badge>
        )}
        <h2 className="mb-2 text-xl font-bold leading-snug">{post.title}</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AuthorName
            isAnonymous={post.is_anonymous}
            name={post.author?.name}
          />
          <span>&middot;</span>
          <span>{formatDateTime(post.created_at)}</span>
        </div>
      </div>

      {/* Post Body */}
      <div className="mb-6 break-words font-sans text-base leading-relaxed whitespace-pre-wrap">
        {post.body}
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => openLightbox(i)}
              className="overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img
                src={`/uploads/${img.file_path}`}
                alt=""
                className="aspect-square w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <ImageLightbox
        images={images}
        open={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Actions */}
      <div className="mb-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          disabled={toggleReaction.isPending}
          className={userReacted ? 'text-primary' : 'text-muted-foreground'}
        >
          <HugeiconsIcon icon={FavouriteIcon} size={18} />
          {t.postDetail.like} ({reactionCount})
        </Button>

        <FlagButton postId={post.id} />
      </div>

      {/* Moderation */}
      {isMgmt && (
        <>
          <Separator className="mb-4" />
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t.postDetail.mgmtActions}
            </p>
            <ModerationControls post={post} postId={post.id} />
          </div>
        </>
      )}

      {/* Comments */}
      <Separator className="mb-4" />
      <h3 className="mb-2 text-base font-medium">
        {t.postDetail.comments} ({comments.length})
      </h3>

      {comments.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">{t.postDetail.noComments}</p>
      )}

      <div className="divide-y divide-border">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {/* Add Comment */}
      <AddCommentForm postId={post.id} />
    </div>
  );
}
