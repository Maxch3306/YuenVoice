import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Location01Icon, Calendar01Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { Translations } from '@/lib/translations';
import { useReports, type ReportFilters } from '@/services/reports';
import type { ReportStatus, ReportType, IncidentReport } from '@/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Status styles (language-independent) ──────────────────────

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

// ─── Helper ─────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function buildLocation(report: IncidentReport, t: Translations): string {
  const parts: string[] = [];
  if (report.location_block) parts.push(`${report.location_block}${t.common.block}`);
  if (report.location_floor) parts.push(`${report.location_floor}${t.common.floor}`);
  if (report.location_area) parts.push(report.location_area);
  return parts.join(' ') || '—';
}

// ─── Component ──────────────────────────────────────────────────

export default function ReportListPage() {
  const navigate = useNavigate();
  const t = useT();

  const STATUS_LABELS: Record<ReportStatus, string> = {
    pending: t.reportStatus.pending,
    in_progress: t.reportStatus.in_progress,
    completed: t.reportStatus.resolved,
  };

  const TYPE_LABELS: Record<ReportType, string> = {
    repair: t.reportType.maintenance,
    complaint: t.reportType.complaint,
    inquiry: t.reportType.inquiry,
  };

  const STATUS_TABS: Array<{ value: string; label: string }> = [
    { value: 'all', label: t.common.all },
    { value: 'pending', label: t.reportStatus.pending },
    { value: 'in_progress', label: t.reportStatus.in_progress },
    { value: 'completed', label: t.reportStatus.resolved },
  ];

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const filters: ReportFilters = {
    page,
    limit: 10,
    ...(statusFilter !== 'all' && { status: statusFilter as ReportStatus }),
    ...(typeFilter !== 'all' && { type: typeFilter as ReportType }),
  };

  const { data, isLoading, isError } = useReports(filters);

  const reports = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // Reset page when filters change
  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      {/* Page title */}
      <h1 className="text-2xl font-bold">{t.reports.title}</h1>

      {/* Status filter tabs */}
      <Tabs value={statusFilter} onValueChange={handleStatusChange}>
        <TabsList className="w-full">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Type filter */}
      <div className="flex gap-2">
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t.reports.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.reports.allTypes}</SelectItem>
            <SelectItem value="repair">{t.reportType.maintenance}</SelectItem>
            <SelectItem value="complaint">{t.reportType.complaint}</SelectItem>
            <SelectItem value="inquiry">{t.reportType.inquiry}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-3/4" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="py-12 text-center text-muted-foreground">
          {t.reports.loadError}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && reports.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">{t.reports.empty}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.reports.emptyHint}
          </p>
        </div>
      )}

      {/* Report cards */}
      {!isLoading && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="cursor-pointer transition-shadow hover:shadow-sm"
              onClick={() => navigate(`/reports/${report.id}`)}
            >
              <CardContent className="space-y-2 p-4">
                {/* Type badge */}
                <Badge variant="outline">{TYPE_LABELS[report.type]}</Badge>

                {/* Title */}
                <p className="line-clamp-2 font-medium">{report.title}</p>

                {/* Location + date + status */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Location01Icon} className="size-3.5" />
                      {buildLocation(report, t)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Calendar01Icon} className="size-3.5" />
                      {formatDate(report.created_at)}
                    </span>
                  </div>
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_STYLES[report.status],
                    )}
                  >
                    {STATUS_LABELS[report.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            &larr;
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              // Show first, last, and pages near current
              return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
            })
            .map((p, idx, arr) => {
              const items: React.ReactNode[] = [];
              // Insert ellipsis if gap
              if (idx > 0 && p - arr[idx - 1] > 1) {
                items.push(
                  <span key={`ellipsis-${p}`} className="px-1 text-muted-foreground">
                    ...
                  </span>,
                );
              }
              items.push(
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>,
              );
              return items;
            })}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            &rarr;
          </Button>
        </div>
      )}

      {/* FAB */}
      <Button
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
        onClick={() => navigate('/reports/new')}
      >
        <HugeiconsIcon icon={Add01Icon} className="size-6" />
        <span className="sr-only">{t.reports.newReport}</span>
      </Button>
    </div>
  );
}
