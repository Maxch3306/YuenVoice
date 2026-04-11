import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

import { getUsers, updateRole, updateStatus } from '@/services/admin';
import type { UserRole } from '@/types';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

const roleLabels: Record<UserRole, string> = {
  resident: '業戶',
  oc_committee: '委員',
  mgmt_staff: '管理',
  admin: '管理員',
};

const roleFilterOptions: { value: string; label: string }[] = [
  { value: '', label: '所有角色' },
  { value: 'resident', label: '業戶' },
  { value: 'oc_committee', label: '委員' },
  { value: 'mgmt_staff', label: '管理' },
  { value: 'admin', label: '管理員' },
];

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Role change confirmation dialog
  const [roleDialog, setRoleDialog] = useState<{
    userId: string;
    userName: string;
    oldRole: UserRole;
    newRole: UserRole;
  } | null>(null);

  // Status change confirmation
  const [statusDialog, setStatusDialog] = useState<{
    userId: string;
    userName: string;
    newStatus: boolean;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, roleFilter, page],
    queryFn: () =>
      getUsers({
        search: search || undefined,
        role: (roleFilter as UserRole) || undefined,
        page,
        limit: 20,
      }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setRoleDialog(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => updateStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setStatusDialog(null);
    },
  });

  const users = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-4 lg:p-6">
      <h1 className="mb-6 text-2xl font-bold">用戶管理</h1>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v === '_all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="所有角色" />
          </SelectTrigger>
          <SelectContent>
            {roleFilterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value || '_all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>電郵</TableHead>
                  <TableHead>單位</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      沒有找到用戶
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {user.flat
                          ? `${user.flat.block}-${user.flat.floor}-${user.flat.unit_number}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(newRole: string) => {
                            if (newRole !== user.role) {
                              setRoleDialog({
                                userId: user.id,
                                userName: user.name,
                                oldRole: user.role,
                                newRole: newRole as UserRole,
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.entries(roleLabels) as [
                                UserRole,
                                string,
                              ][]
                            ).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={(checked) =>
                            setStatusDialog({
                              userId: user.id,
                              userName: user.name,
                              newStatus: checked,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {users.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                沒有找到用戶
              </p>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{user.name}</p>
                    <Badge variant="outline">
                      {roleLabels[user.role]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user.email}
                  </p>
                  {user.flat && (
                    <p className="text-xs text-muted-foreground">
                      {user.flat.block}座 {user.flat.floor}樓{' '}
                      {user.flat.unit_number}號
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Select
                      value={user.role}
                      onValueChange={(newRole: string) => {
                        if (newRole !== user.role) {
                          setRoleDialog({
                            userId: user.id,
                            userName: user.name,
                            oldRole: user.role,
                            newRole: newRole as UserRole,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.entries(roleLabels) as [UserRole, string][]
                        ).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Switch
                      checked={user.is_active}
                      onCheckedChange={(checked) =>
                        setStatusDialog({
                          userId: user.id,
                          userName: user.name,
                          newStatus: checked,
                        })
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </>
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

      {/* Role Change Confirmation */}
      <AlertDialog
        open={!!roleDialog}
        onOpenChange={(open) => !open && setRoleDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定更改用戶角色？</AlertDialogTitle>
            <AlertDialogDescription>
              用戶: {roleDialog?.userName}
              <br />
              由: {roleDialog ? roleLabels[roleDialog.oldRole] : ''} →{' '}
              {roleDialog ? roleLabels[roleDialog.newRole] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (roleDialog) {
                  roleMutation.mutate({
                    userId: roleDialog.userId,
                    role: roleDialog.newRole,
                  });
                }
              }}
              disabled={roleMutation.isPending}
            >
              {roleMutation.isPending ? '更改中...' : '確定更改'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Confirmation */}
      <AlertDialog
        open={!!statusDialog}
        onOpenChange={(open) => !open && setStatusDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              確定{statusDialog?.newStatus ? '啟用' : '停用'}此用戶？
            </AlertDialogTitle>
            <AlertDialogDescription>
              用戶: {statusDialog?.userName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusDialog) {
                  statusMutation.mutate({
                    userId: statusDialog.userId,
                    isActive: statusDialog.newStatus,
                  });
                }
              }}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? '更新中...' : '確定'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
