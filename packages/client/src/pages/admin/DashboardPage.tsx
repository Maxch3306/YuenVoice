import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserGroupIcon,
  ClipboardIcon,
  BubbleChatIcon,
  File01Icon,
} from '@hugeicons/core-free-icons';

import { getDashboardStats, getAuditLogs } from '@/services/admin';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const statCards = [
  { key: 'totalUsers' as const, label: '註冊用戶', icon: UserGroupIcon },
  { key: 'openReports' as const, label: '待處理報告', icon: ClipboardIcon },
  { key: 'postsThisWeek' as const, label: '本週帖文', icon: BubbleChatIcon },
  { key: 'totalDocuments' as const, label: '法團文件', icon: File01Icon },
];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getDashboardStats,
  });

  const { data: recentLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', 'recent'],
    queryFn: () => getAuditLogs({ limit: 10, page: 1 }),
  });

  return (
    <div className="p-4 lg:p-6">
      <h1 className="mb-6 text-2xl font-bold">管理儀表板</h1>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key} size="sm">
            <CardContent className="flex flex-col items-start px-5 py-4">
              {statsLoading ? (
                <>
                  <Skeleton className="mb-2 h-6 w-6 rounded" />
                  <Skeleton className="mb-1 h-8 w-16" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <HugeiconsIcon
                    icon={card.icon}
                    size={24}
                    className="mb-2 text-muted-foreground"
                  />
                  <p className="text-3xl font-bold">
                    {stats?.[card.key] ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {card.label}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
          用戶管理
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/flats')}>
          單位管理
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/audit-logs')}>
          審計日誌
        </Button>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">近期活動</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !recentLogs?.data.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暫無近期活動
            </p>
          ) : (
            <div className="divide-y">
              {recentLogs.data.map((log) => (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm">
                    <span className="font-medium">
                      {log.user?.name ?? '系統'}
                    </span>
                    {' '}
                    {log.action}
                    {' '}
                    <span className="text-muted-foreground">
                      ({log.entity_type})
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relativeTime(log.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
