import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PinIcon,
  FavouriteIcon,
  Comment01Icon,
  Image01Icon,
  PlusSignIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePosts, useBoards } from '@/services/discussions';
import type { DiscussionPost } from '@/types';

const POSTS_PER_PAGE = 15;

function excerpt(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function authorDisplay(post: DiscussionPost): {
  name: string;
  isAnon: boolean;
} {
  if (post.is_anonymous) return { name: '匿名業戶', isAnon: true };
  return { name: post.author?.name ?? '用戶', isAnon: false };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function PostCard({ post }: { post: DiscussionPost }) {
  const navigate = useNavigate();
  const { name, isAnon } = authorDisplay(post);
  const reactionCount = (post as any).reactionCount ?? post.reactions?.length ?? 0;
  const commentCount = (post as any).commentCount ?? post.comments?.length ?? 0;
  const imageCount = (post as any).imageCount ?? post.images?.length ?? 0;

  return (
    <Card
      size="sm"
      className={`cursor-pointer transition-colors hover:bg-accent/5 ${post.is_pinned ? 'border-accent bg-accent/5' : ''}`}
      onClick={() => navigate(`/discussion/post/${post.id}`)}
    >
      <CardContent>
        {post.is_pinned && (
          <div className="mb-1 flex items-center gap-1 text-xs text-primary">
            <HugeiconsIcon icon={PinIcon} size={14} />
            <span>置頂</span>
          </div>
        )}

        <h3 className="mb-1 font-medium leading-snug">{post.title}</h3>

        <p className="mb-2 line-clamp-2 break-words text-sm text-muted-foreground">
          {(post as any).bodyExcerpt ?? excerpt(post.body)}
        </p>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <span className={isAnon ? 'italic' : ''}>{name}</span>
            {' \u00b7 '}
            {formatDate(post.created_at)}
          </span>
          <span className="flex items-center gap-3">
            {imageCount > 0 && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Image01Icon} size={14} />
                {imageCount}
              </span>
            )}
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={FavouriteIcon} size={14} />
              {reactionCount}
            </span>
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Comment01Icon} size={14} />
              {commentCount}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PostListPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data: boards } = useBoards();
  const board = boards?.find((b) => b.id === boardId);

  const {
    data: postsData,
    isLoading,
    isError,
  } = usePosts(boardId ?? '', page, POSTS_PER_PAGE);

  const posts = postsData?.data ?? [];
  const meta = postsData?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // Sort pinned posts first
  const sorted = [...posts].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return 0;
  });

  return (
    <div className="relative mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate('/discussion')}
          aria-label="返回討論區"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{board?.name ?? '帖文列表'}</h1>
          {board && (
            <Badge variant="secondary" className="mt-1">
              {board.scope_type === 'estate'
                ? '全屋苑'
                : board.scope_block ?? board.scope_floor ?? ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-muted-foreground">
          無法載入帖文，請稍後再試。
        </p>
      )}

      {/* Empty */}
      {!isLoading && !isError && posts.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          暫無帖文
        </p>
      )}

      {/* Posts */}
      {sorted.length > 0 && (
        <div className="flex flex-col gap-3">
          {sorted.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
      )}

      {/* FAB */}
      <Button
        className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:bottom-6"
        size="icon-lg"
        onClick={() => navigate(`/discussion/${boardId}/new`)}
        aria-label="發佈新帖文"
      >
        <HugeiconsIcon icon={PlusSignIcon} size={24} />
      </Button>
    </div>
  );
}
