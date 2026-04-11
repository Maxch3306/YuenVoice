import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

import { getUsers, updateRole, updateStatus } from '@/services/admin';
import { useT } from '@/lib/i18n';
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

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const t = useT();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const roleLabels: Record<UserRole, string> = {
    resident: t.roles.resident,
    oc_committee: t.roles.oc_committee,
    mgmt_staff: t.roles.mgmt_staff,
    admin: t.roles.admin,
  };

  const roleFilterOptions: { value: string; label: string }[] = [
    { value: '', label: t.adminUsers.allRoles },
    { value: 'resident', label: t.roles.resident },
    { value: 'oc_committee', label: t.roles.oc_committee },
    { value: 'mgmt_staff', label: t.roles.mgmt_staff },
    { value: 'admin', label: t.roles.admin },
  ];

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
      <h1 className="mb-6 text-2xl font-bold">{t.adminUsers.title}</h1>

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
            placeholder={t.adminUsers.searchPlaceholder}
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
            <SelectValue placeholder={t.adminUsers.allRoles} />
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
                  <TableHead>{t.adminUsers.colName}</TableHead>
                  <TableHead>{t.adminUsers.colEmail}</TableHead>
                  <TableHead>{t.adminUsers.colUnit}</TableHead>
                  <TableHead>{t.adminUsers.colRole}</TableHead>
                  <TableHead>{t.adminUsers.colStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {t.adminUsers.noUsers}
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
                          : '\u2014'}
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
                {t.adminUsers.noUsers}
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
                      {t.adminUsers.unitLabel(user.flat.block, user.flat.floor, user.flat.unit_number)}
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
            <AlertDialogTitle>{t.adminUsers.roleChangeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.adminUsers.roleChangeUser}: {roleDialog?.userName}
              <br />
              {t.adminUsers.roleChangeFrom}: {roleDialog ? roleLabels[roleDialog.oldRole] : ''} {t.adminUsers.roleChangeTo}{' '}
              {roleDialog ? roleLabels[roleDialog.newRole] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
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
              {roleMutation.isPending ? t.common.updating : t.common.confirm}
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
              {statusDialog ? t.adminUsers.statusChangeTitle(statusDialog.newStatus) : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.adminUsers.roleChangeUser}: {statusDialog?.userName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
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
              {statusMutation.isPending ? t.common.updating : t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
