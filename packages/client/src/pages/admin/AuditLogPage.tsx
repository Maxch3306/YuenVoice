import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons';

import { getAuditLogs } from '@/services/admin';
import { useT } from '@/lib/i18n';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

export default function AuditLogPage() {
  const t = useT();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const actionOptions: { value: string; label: string }[] = [
    { value: '', label: t.adminAudit.allActions },
    { value: 'role_update', label: t.adminAudit.actions.role_change },
    { value: 'status_update', label: t.adminAudit.actions.status_change },
    { value: 'password_reset', label: t.adminAudit.actions.password_reset },
    { value: 'document_delete', label: t.adminAudit.actions.document_delete },
    { value: 'post_manage', label: t.adminAudit.actions.post_moderate },
  ];

  const entityTypeOptions: { value: string; label: string }[] = [
    { value: '', label: t.adminAudit.allTypes },
    { value: 'User', label: t.adminAudit.entityTypes.User },
    { value: 'Report', label: t.adminAudit.entityTypes.Report },
    { value: 'Flat', label: t.adminAudit.entityTypes.Flat },
    { value: 'Post', label: t.adminAudit.entityTypes.Post },
    { value: 'Document', label: t.adminAudit.entityTypes.Document },
  ];

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin',
      'audit-logs',
      search,
      actionFilter,
      entityTypeFilter,
      startDate,
      endDate,
      page,
    ],
    queryFn: () =>
      getAuditLogs({
        search: search || undefined,
        action: actionFilter || undefined,
        entityType: entityTypeFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 20,
      }),
  });

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const logs = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-4 lg:p-6">
      <h1 className="mb-6 text-2xl font-bold">{t.adminAudit.title}</h1>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              placeholder={t.adminAudit.searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v === '_all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder={t.adminAudit.allActions} />
            </SelectTrigger>
            <SelectContent>
              {actionOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || '_all'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={entityTypeFilter}
            onValueChange={(v) => {
              setEntityTypeFilter(v === '_all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder={t.adminAudit.allTypes} />
            </SelectTrigger>
            <SelectContent>
              {entityTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || '_all'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="w-full sm:w-40"
            placeholder={t.adminAudit.startDate}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            className="w-full sm:w-40"
            placeholder={t.adminAudit.endDate}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.adminAudit.colTime}</TableHead>
                <TableHead>{t.adminAudit.colUser}</TableHead>
                <TableHead>{t.adminAudit.colAction}</TableHead>
                <TableHead className="hidden sm:table-cell">{t.adminAudit.colType}</TableHead>
                <TableHead className="w-16">{t.adminAudit.colDetails}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t.adminAudit.noLogs}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <>
                    <TableRow
                      key={log.id}
                      className="cursor-pointer"
                      onClick={() => toggleRow(log.id)}
                    >
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatTimestamp(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.user?.name ?? '\u2014'}
                      </TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {log.entity_type}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <HugeiconsIcon
                            icon={
                              expandedRows.has(log.id)
                                ? ArrowUp01Icon
                                : ArrowDown01Icon
                            }
                            size={14}
                          />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(log.id) && (
                      <TableRow key={`${log.id}-detail`}>
                        <TableCell colSpan={5} className="bg-muted/50 p-0">
                          <div className="px-4 py-3">
                            <p className="mb-1 text-xs text-muted-foreground sm:hidden">
                              {t.adminAudit.colType}: {log.entity_type} | ID: {log.entity_id}
                            </p>
                            <p className="mb-1 hidden text-xs text-muted-foreground sm:block">
                              Entity ID: {log.entity_id}
                            </p>
                            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
