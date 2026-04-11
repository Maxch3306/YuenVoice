import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  RefreshIcon,
  Copy01Icon,
  Add01Icon,
  PencilEdit01Icon,
  Delete01Icon,
} from '@hugeicons/core-free-icons';

import {
  getFlats,
  createFlat,
  updateFlat,
  deleteFlat,
  resetFlatPassword,
} from '@/services/admin';
import type { Flat } from '@/types';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const blockOptions = ['A', 'B', 'C', 'D', 'E'];

export default function FlatManagementPage() {
  const queryClient = useQueryClient();
  const [blockFilter, setBlockFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Reset password state
  const [resetTarget, setResetTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState<{
    flat: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Add/Edit dialog state
  const [formDialog, setFormDialog] = useState<{
    mode: 'add' | 'edit';
    flat?: Flat;
  } | null>(null);
  const [formBlock, setFormBlock] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formRegOpen, setFormRegOpen] = useState(true);
  const [formError, setFormError] = useState('');

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    label: string;
    residentCount: number;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'flats', blockFilter, search, page],
    queryFn: () =>
      getFlats({
        block: blockFilter || undefined,
        search: search || undefined,
        page,
        limit: 20,
      }),
  });

  const invalidateFlats = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'flats'] });

  // ── Mutations ──

  const resetMutation = useMutation({
    mutationFn: (flatId: string) => resetFlatPassword(flatId),
    onSuccess: (result) => {
      invalidateFlats();
      if (resetTarget) {
        setNewPassword({ flat: resetTarget.label, password: result.newPassword });
      }
      setResetTarget(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createFlat({ block: formBlock, floor: formFloor, unitNumber: formUnit }),
    onSuccess: (created) => {
      invalidateFlats();
      // Show the generated password
      setNewPassword({
        flat: `${created.block}座 ${created.floor}樓 ${created.unit_number}號`,
        password: created.registration_password ?? '',
      });
      setFormDialog(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error ?? '建立失敗');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (flatId: string) =>
      updateFlat(flatId, {
        block: formBlock,
        floor: formFloor,
        unitNumber: formUnit,
        isRegistrationOpen: formRegOpen,
      }),
    onSuccess: () => {
      invalidateFlats();
      setFormDialog(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error ?? '更新失敗');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (flatId: string) => deleteFlat(flatId),
    onSuccess: () => {
      invalidateFlats();
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      setDeleteTarget(null);
      alert(err.response?.data?.error ?? '刪除失敗');
    },
  });

  // ── Helpers ──

  function openAddDialog() {
    setFormBlock('A');
    setFormFloor('1');
    setFormUnit('1');
    setFormRegOpen(true);
    setFormError('');
    setFormDialog({ mode: 'add' });
  }

  function openEditDialog(flat: Flat) {
    setFormBlock(flat.block);
    setFormFloor(flat.floor);
    setFormUnit(flat.unit_number);
    setFormRegOpen(flat.is_registration_open);
    setFormError('');
    setFormDialog({ mode: 'edit', flat });
  }

  function flatLabel(flat: { block: string; floor: string; unit_number: string }) {
    return `${flat.block}座 ${flat.floor}樓 ${flat.unit_number}號`;
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

  const flats = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">單位管理</h1>
        <Button size="sm" onClick={openAddDialog}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          <span className="ml-1">新增單位</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Select
          value={blockFilter}
          onValueChange={(v) => {
            setBlockFilter(v === '_all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="所有座" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">所有座</SelectItem>
            {blockOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {b}座
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-9"
            placeholder="搜尋單位..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
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
                <TableHead>座</TableHead>
                <TableHead>樓層</TableHead>
                <TableHead>單位</TableHead>
                <TableHead className="hidden sm:table-cell">住戶數</TableHead>
                <TableHead>註冊密碼</TableHead>
                <TableHead>註冊狀態</TableHead>
                <TableHead className="w-28">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flats.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    沒有找到單位
                  </TableCell>
                </TableRow>
              ) : (
                flats.map((flat) => (
                  <TableRow key={flat.id}>
                    <TableCell className="font-medium">{flat.block}</TableCell>
                    <TableCell>{flat.floor}</TableCell>
                    <TableCell>{flat.unit_number}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {flat.residentCount ?? 0}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                        {flat.registration_password ?? '—'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          flat.is_registration_open
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }
                      >
                        {flat.is_registration_open ? '開放' : '關閉'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="編輯"
                          onClick={() => openEditDialog(flat)}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="重設密碼"
                          onClick={() =>
                            setResetTarget({
                              id: flat.id,
                              label: flatLabel(flat),
                            })
                          }
                        >
                          <HugeiconsIcon icon={RefreshIcon} size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="刪除"
                          onClick={() =>
                            setDeleteTarget({
                              id: flat.id,
                              label: flatLabel(flat),
                              residentCount: flat.residentCount ?? 0,
                            })
                          }
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
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

      {/* ── Add / Edit Dialog ──────────────────────────────── */}
      <Dialog
        open={!!formDialog}
        onOpenChange={(open) => !open && setFormDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formDialog?.mode === 'add' ? '新增單位' : '編輯單位'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>座 (Block)</Label>
              <Input
                value={formBlock}
                onChange={(e) => setFormBlock(e.target.value)}
                placeholder="A"
              />
            </div>

            <div className="space-y-2">
              <Label>樓層 (Floor)</Label>
              <Input
                value={formFloor}
                onChange={(e) => setFormFloor(e.target.value)}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label>單位號碼 (Unit)</Label>
              <Input
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                placeholder="1"
              />
            </div>

            {formDialog?.mode === 'edit' && (
              <div className="flex items-center justify-between">
                <Label>開放註冊</Label>
                <Switch
                  checked={formRegOpen}
                  onCheckedChange={setFormRegOpen}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDialog(null)}>
              取消
            </Button>
            {formDialog?.mode === 'add' ? (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !formBlock.trim() ||
                  !formFloor.trim() ||
                  !formUnit.trim()
                }
              >
                {createMutation.isPending ? '建立中...' : '建立'}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  formDialog?.flat &&
                  updateMutation.mutate(formDialog.flat.id)
                }
                disabled={
                  updateMutation.isPending ||
                  !formBlock.trim() ||
                  !formFloor.trim() ||
                  !formUnit.trim()
                }
              >
                {updateMutation.isPending ? '儲存中...' : '儲存'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除此單位？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  單位: {deleteTarget.label}
                  <br />
                  {deleteTarget.residentCount > 0 && (
                    <span className="mt-2 block font-medium text-destructive">
                      此單位有 {deleteTarget.residentCount} 位已註冊住戶，無法刪除。
                    </span>
                  )}
                  {deleteTarget.residentCount === 0 && (
                    <span className="mt-2 block">此操作無法復原。</span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={
                deleteMutation.isPending ||
                (deleteTarget?.residentCount ?? 0) > 0
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '刪除中...' : '確定刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset Password Confirmation ────────────────────── */}
      <AlertDialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定重設此單位的註冊密碼？</AlertDialogTitle>
            <AlertDialogDescription>
              {resetTarget && (
                <>
                  單位: {resetTarget.label}
                  <br />
                  <br />
                  重設密碼不會影響已註冊的用戶
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                resetTarget && resetMutation.mutate(resetTarget.id)
              }
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? '重設中...' : '確定重設'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── New Password Display ───────────────────────────── */}
      <Dialog
        open={!!newPassword}
        onOpenChange={(open) => {
          if (!open) {
            setNewPassword(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formDialog ? '單位已建立' : '密碼已重設'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{newPassword?.flat}</p>

            <div>
              <Label className="mb-1 text-xs text-muted-foreground">
                註冊密碼
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md bg-muted px-4 py-3 font-mono text-lg tracking-widest">
                  {newPassword?.password}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    newPassword && handleCopy(newPassword.password)
                  }
                >
                  <HugeiconsIcon icon={Copy01Icon} size={18} />
                </Button>
              </div>
              {copied && (
                <p className="mt-1 text-xs text-green-600">已複製</p>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                請記下此密碼並交予相關業戶，用於註冊帳戶。
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setNewPassword(null);
                setCopied(false);
              }}
            >
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
