import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoards } from '@/services/discussions';
import { useT } from '@/lib/i18n';
import type { Translations } from '@/lib/translations';
import type { DiscussionBoard } from '@/types';

function scopeLabel(board: DiscussionBoard, t: Pick<Translations, 'boards'>): string {
  if (board.scope_type === 'estate') return t.boards.allEstate;
  if (board.scope_type === 'block') return board.scope_block ? t.boards.blockTarget(board.scope_block) : t.boards.allEstate;
  return board.scope_floor && board.scope_block ? t.boards.floorTarget(board.scope_block, board.scope_floor) : t.boards.allEstate;
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
  const t = useT();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-2xl font-bold">{t.boards.title}</h1>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground">
          {t.boards.loadError}
        </p>
      )}

      {boards && boards.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.boards.empty}</p>
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
                    {scopeLabel(board, t)}
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
