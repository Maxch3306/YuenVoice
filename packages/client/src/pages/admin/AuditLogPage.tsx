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

const actionOptions: { value: string; label: string }[] = [
  { value: '', label: '所有操作' },
  { value: 'role_update', label: '角色更新' },
  { value: 'status_update', label: '狀態更新' },
  { value: 'password_reset', label: '密碼重設' },
  { value: 'document_delete', label: '文件刪除' },
  { value: 'post_manage', label: '帖文管理' },
];

const entityTypeOptions: { value: string; label: string }[] = [
  { value: '', label: '所有類型' },
  { value: 'User', label: 'User' },
  { value: 'Report', label: 'Report' },
  { value: 'Flat', label: 'Flat' },
  { value: 'Post', label: 'Post' },
  { value: 'Document', label: 'Document' },
];

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
      <h1 className="mb-6 text-2xl font-bold">審計日誌</h1>

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
              placeholder="搜尋用戶..."
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
              <SelectValue placeholder="所有操作" />
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
              <SelectValue placeholder="所有類型" />
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
            placeholder="開始日期"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            className="w-full sm:w-40"
            placeholder="結束日期"
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
                <TableHead>時間</TableHead>
                <TableHead>用戶</TableHead>
                <TableHead>操作</TableHead>
                <TableHead className="hidden sm:table-cell">類型</TableHead>
                <TableHead className="w-16">詳情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    沒有找到日誌
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
                        {log.user?.name ?? '—'}
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
                              類型: {log.entity_type} | ID: {log.entity_id}
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
