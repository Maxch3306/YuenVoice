import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  Add01Icon,
  Copy01Icon,
  MoreVerticalIcon,
  LockPasswordIcon,
  Building01Icon,
  Notification01Icon,
  Delete01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

import {
  createUser,
  getUsers,
  updateRole,
  updateStatus,
  resetUserPassword,
  deleteUser,
  getUserFlats,
  unlinkUserFlat,
  type UserFlatSummary,
} from '@/services/admin';
import { sendNotification } from '@/services/notifications';
import { useT } from '@/lib/i18n';
import type { NotificationCategory, UserRole } from '@/types';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

  // Create-user dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('mgmt_staff');
  const [formError, setFormError] = useState('');

  // One-time password reveal after successful creation
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{
    name: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset password confirmation
  const [resetDialog, setResetDialog] = useState<{
    userId: string;
    userName: string;
    email: string;
  } | null>(null);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{
    userId: string;
    userName: string;
  } | null>(null);

  // Manage-flats dialog
  const [flatsDialog, setFlatsDialog] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [unlinkConfirm, setUnlinkConfirm] = useState<UserFlatSummary | null>(
    null,
  );

  // Send-reminder dialog
  const [reminderDialog, setReminderDialog] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderBody, setReminderBody] = useState('');
  const [reminderCategory, setReminderCategory] =
    useState<NotificationCategory>('general');

  function openCreateDialog() {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('mgmt_staff');
    setFormError('');
    setCreateOpen(true);
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

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

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || undefined,
        role: formRole,
      }),
    onSuccess: ({ user, tempPassword }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setCreateOpen(false);
      setTempPasswordDialog({
        name: user.name,
        email: user.email,
        tempPassword,
      });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setFormError(axiosErr.response?.data?.error ?? '建立失敗');
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

  function reportError(err: unknown, fallback: string) {
    const axiosErr = err as { response?: { data?: { error?: string } } };
    toast.error(axiosErr.response?.data?.error ?? fallback);
  }

  const resetMutation = useMutation({
    mutationFn: (userId: string) => resetUserPassword(userId),
    onSuccess: ({ tempPassword }) => {
      const target = resetDialog;
      setResetDialog(null);
      if (target) {
        setTempPasswordDialog({
          name: target.userName,
          email: target.email,
          tempPassword,
        });
      }
    },
    onError: (err) => reportError(err, t.adminUsers.deleteError),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setDeleteDialog(null);
      toast.success(t.adminUsers.deleteSuccess);
    },
    onError: (err) => reportError(err, t.adminUsers.deleteError),
  });

  const flatsQuery = useQuery({
    queryKey: ['admin', 'user-flats', flatsDialog?.userId],
    queryFn: () => getUserFlats(flatsDialog!.userId),
    enabled: !!flatsDialog,
  });

  const unlinkMutation = useMutation({
    mutationFn: (flatId: string) =>
      unlinkUserFlat(flatsDialog!.userId, flatId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user-flats', flatsDialog?.userId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setUnlinkConfirm(null);
      toast.success(t.adminUsers.unlinkSuccess);
    },
    onError: (err) => reportError(err, t.adminUsers.deleteError),
  });

  const reminderMutation = useMutation({
    mutationFn: () =>
      sendNotification({
        title: reminderTitle.trim(),
        body: reminderBody.trim(),
        category: reminderCategory,
        targetType: 'user',
        targetUserId: reminderDialog!.userId,
      }),
    onSuccess: () => {
      setReminderDialog(null);
      toast.success(t.adminUsers.reminderSent);
    },
    onError: (err) => reportError(err, t.adminUsers.reminderError),
  });

  function openReminder(userId: string, userName: string) {
    setReminderTitle('');
    setReminderBody('');
    setReminderCategory('general');
    setReminderDialog({ userId, userName });
  }

  function renderActions(userId: string, userName: string, email: string) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t.adminUsers.actionsLabel}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openReminder(userId, userName)}>
            <HugeiconsIcon icon={Notification01Icon} size={16} />
            <span className="ml-2">{t.adminUsers.sendReminder}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setFlatsDialog({ userId, userName })}
          >
            <HugeiconsIcon icon={Building01Icon} size={16} />
            <span className="ml-2">{t.adminUsers.manageFlats}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setResetDialog({ userId, userName, email })}
          >
            <HugeiconsIcon icon={LockPasswordIcon} size={16} />
            <span className="ml-2">{t.adminUsers.resetPassword}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteDialog({ userId, userName })}
          >
            <HugeiconsIcon icon={Delete01Icon} size={16} />
            <span className="ml-2">{t.adminUsers.deleteUser}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const users = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.adminUsers.title}</h1>
        <Button size="sm" onClick={openCreateDialog}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          <span className="ml-1">{t.adminUsers.addUser}</span>
        </Button>
      </div>

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
                  <TableHead className="w-12 text-right">
                    {t.adminUsers.colActions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
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
                      <TableCell className="text-right">
                        {renderActions(user.id, user.name, user.email)}
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
                    <div className="flex items-center gap-1">
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
                      {renderActions(user.id, user.name, user.email)}
                    </div>
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

      {/* Create User Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.adminUsers.createTitle}</DialogTitle>
            <DialogDescription>{t.adminUsers.createHint}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="create-user-name">{t.adminUsers.nameLabel}</Label>
              <Input
                id="create-user-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-user-email">{t.adminUsers.emailLabel}</Label>
              <Input
                id="create-user-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-user-phone">{t.adminUsers.phoneLabel}</Label>
              <Input
                id="create-user-phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.adminUsers.roleSelectLabel}</Label>
              <Select
                value={formRole}
                onValueChange={(v) => setFormRole(v as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['mgmt_staff', 'oc_committee', 'admin'] as UserRole[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {roleLabels[value]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !formName.trim() ||
                !formEmail.trim()
              }
            >
              {createMutation.isPending ? t.common.creating : t.adminUsers.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp password reveal (one-time) */}
      <Dialog
        open={!!tempPasswordDialog}
        onOpenChange={(open) => {
          if (!open) {
            setTempPasswordDialog(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.adminUsers.userCreated}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tempPasswordDialog?.name} · {tempPasswordDialog?.email}
            </p>

            <div>
              <Label className="mb-1 text-xs text-muted-foreground">
                {t.adminUsers.tempPasswordLabel}
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md bg-muted px-4 py-3 font-mono text-lg tracking-widest">
                  {tempPasswordDialog?.tempPassword}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    tempPasswordDialog &&
                    handleCopy(tempPasswordDialog.tempPassword)
                  }
                >
                  <HugeiconsIcon icon={Copy01Icon} size={18} />
                </Button>
              </div>
              {copied && (
                <p className="mt-1 text-xs text-green-600">
                  {t.common.copiedToClipboard}
                </p>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                {t.adminUsers.tempPasswordNote}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setTempPasswordDialog(null);
                setCopied(false);
              }}
            >
              {t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Reset Password Confirmation */}
      <AlertDialog
        open={!!resetDialog}
        onOpenChange={(open) => !open && setResetDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.adminUsers.resetPasswordTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.adminUsers.roleChangeUser}: {resetDialog?.userName}
              <br />
              {t.adminUsers.resetPasswordBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                resetDialog && resetMutation.mutate(resetDialog.userId)
              }
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending
                ? t.common.updating
                : t.adminUsers.resetPassword}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation */}
      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.adminUsers.deleteUserTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.adminUsers.roleChangeUser}: {deleteDialog?.userName}
              <br />
              {t.adminUsers.deleteUserBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteDialog && deleteMutation.mutate(deleteDialog.userId)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t.common.deleting
                : t.adminUsers.deleteUser}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Flats Dialog */}
      <Dialog
        open={!!flatsDialog}
        onOpenChange={(open) => {
          if (!open) {
            setFlatsDialog(null);
            setUnlinkConfirm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.adminUsers.manageFlatsTitle}</DialogTitle>
            <DialogDescription>{flatsDialog?.userName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {flatsQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (flatsQuery.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t.adminUsers.noFlats}
              </p>
            ) : (
              (flatsQuery.data ?? []).map((flat) => (
                <div
                  key={flat.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {t.adminUsers.unitLabel(
                        flat.block,
                        flat.floor,
                        flat.unit_number,
                      )}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {flat.is_primary
                        ? t.adminUsers.primaryFlat
                        : t.adminUsers.linkedFlat}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t.adminUsers.unlinkFlat}
                    onClick={() => setUnlinkConfirm(flat)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={18} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFlatsDialog(null)}>
              {t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Flat Confirmation */}
      <AlertDialog
        open={!!unlinkConfirm}
        onOpenChange={(open) => !open && setUnlinkConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.adminUsers.unlinkFlatTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.adminUsers.unlinkFlatBody}
              {unlinkConfirm && (
                <>
                  <br />
                  {t.adminUsers.unitLabel(
                    unlinkConfirm.block,
                    unlinkConfirm.floor,
                    unlinkConfirm.unit_number,
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                unlinkConfirm && unlinkMutation.mutate(unlinkConfirm.id)
              }
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending
                ? t.common.deleting
                : t.adminUsers.unlinkFlat}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Reminder Dialog */}
      <Dialog
        open={!!reminderDialog}
        onOpenChange={(open) => !open && setReminderDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.adminUsers.sendReminderTitle}</DialogTitle>
            <DialogDescription>{reminderDialog?.userName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reminder-title">
                {t.adminUsers.reminderTitleLabel}
              </Label>
              <Input
                id="reminder-title"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-body">
                {t.adminUsers.reminderBodyLabel}
              </Label>
              <Textarea
                id="reminder-body"
                rows={4}
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.adminUsers.reminderCategoryLabel}</Label>
              <Select
                value={reminderCategory}
                onValueChange={(v) =>
                  setReminderCategory(v as NotificationCategory)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">
                    {t.compose.categoryGeneral}
                  </SelectItem>
                  <SelectItem value="urgent">
                    {t.compose.categoryUrgent}
                  </SelectItem>
                  <SelectItem value="event">
                    {t.compose.categoryEvent}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReminderDialog(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => reminderMutation.mutate()}
              disabled={
                reminderMutation.isPending ||
                !reminderTitle.trim() ||
                !reminderBody.trim()
              }
            >
              {reminderMutation.isPending
                ? t.compose.sending
                : t.adminUsers.sendReminderAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
