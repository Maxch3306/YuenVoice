import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoards } from '@/services/discussions';
import type { DiscussionBoard } from '@/types';

function scopeLabel(board: DiscussionBoard): string {
  if (board.scope_type === 'estate') return '全屋苑';
  if (board.scope_type === 'block') return board.scope_block ?? '座';
  return board.scope_floor ?? '樓層';
}

function scopeVariant(
  scope: DiscussionBoard['scope_type']
): 'default' | 'secondary' | 'outline' {
  if (scope === 'estate') return 'default';
  if (scope === 'block') return 'secondary';
  return 'outline';
}

export default function BoardListPage() {
  const navigate = useNavigate();
  const { data: boards, isLoading, isError } = useBoards();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-2xl font-bold">討論區</h1>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground">
          無法載入討論板，請稍後再試。
        </p>
      )}

      {boards && boards.length === 0 && (
        <p className="text-sm text-muted-foreground">暫無討論板</p>
      )}

      {boards && boards.length > 0 && (
        <div className="flex flex-col gap-3">
          {boards.map((board) => (
            <Card
              key={board.id}
              size="sm"
              className="cursor-pointer transition-colors hover:bg-accent/5"
              onClick={() => navigate(`/discussion/${board.id}`)}
            >
              <CardContent className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <Badge variant={scopeVariant(board.scope_type)} className="mb-2">
                    {scopeLabel(board)}
                  </Badge>
                  <h3 className="font-medium">{board.name}</h3>
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={20}
                  className="shrink-0 text-muted-foreground"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
