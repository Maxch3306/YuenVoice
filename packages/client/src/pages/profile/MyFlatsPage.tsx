import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Home01Icon,
  Link01Icon,
  Delete01Icon,
  Add01Icon,
} from '@hugeicons/core-free-icons';

import { useT } from '@/lib/i18n';
import { useBlocks, useFloors, useUnits } from '@/services/flats';
import {
  useMyFlats,
  useLinkFlat,
  useUnlinkFlat,
  type MyFlat,
} from '@/services/my-flats';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ApiError {
  response?: { status?: number; data?: { message?: string } };
}

function errorMessageFor(err: ApiError, t: ReturnType<typeof useT>): string {
  const status = err.response?.status;
  const msg = err.response?.data?.message ?? '';
  if (status === 409 && /primary/i.test(msg)) return t.myFlats.errorAlreadyPrimary;
  if (status === 409) return t.myFlats.errorAlreadyLinked;
  if (status === 400) return t.myFlats.errorInvalidPassword;
  return t.myFlats.errorGeneric;
}

export default function MyFlatsPage() {
  const navigate = useNavigate();
  const t = useT();

  const { data: flats, isLoading } = useMyFlats();
  const { data: blocks = [] } = useBlocks();
  const { data: floors = [] } = useFloors();

  const [block, setBlock] = useState('');
  const [floor, setFloor] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [flatPassword, setFlatPassword] = useState('');
  const [submitError, setSubmitError] = useState('');

  const { data: units = [] } = useUnits(block, floor);

  const linkMutation = useLinkFlat();
  const unlinkMutation = useUnlinkFlat();

  const primary = flats?.find((f) => f.is_primary);
  const linked = flats?.filter((f) => !f.is_primary) ?? [];

  function resetForm() {
    setBlock('');
    setFloor('');
    setUnitNumber('');
    setFlatPassword('');
    setSubmitError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!block || !floor || !unitNumber || !flatPassword) return;

    try {
      await linkMutation.mutateAsync({
        block,
        floor,
        unitNumber,
        flatPassword,
      });
      resetForm();
    } catch (err) {
      setSubmitError(errorMessageFor(err as ApiError, t));
    }
  }

  async function handleUnlink(flatId: string) {
    try {
      await unlinkMutation.mutateAsync(flatId);
    } catch {
      // swallow — page will simply not refresh
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function renderFlatCard(flat: MyFlat, isPrimary: boolean) {
    return (
      <Card key={flat.id}>
        <CardContent className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 shrink-0 text-muted-foreground">
            <HugeiconsIcon
              icon={isPrimary ? Home01Icon : Link01Icon}
              size={24}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {isPrimary && (
                <Badge variant="default">{t.myFlats.primaryBadge}</Badge>
              )}
            </div>
            <p className="text-sm font-medium">
              {t.myFlats.flatLabel(flat.block, flat.floor, flat.unit_number)}
            </p>
            {!isPrimary && flat.linked_at && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.myFlats.linkedOn(formatDate(flat.linked_at))}
              </p>
            )}
          </div>

          {!isPrimary && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t.myFlats.unlink}>
                  <HugeiconsIcon icon={Delete01Icon} size={18} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.myFlats.unlinkConfirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.myFlats.unlinkConfirmBody}
                    <br />
                    {t.myFlats.flatLabel(flat.block, flat.floor, flat.unit_number)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleUnlink(flat.id)}
                    disabled={unlinkMutation.isPending}
                  >
                    {unlinkMutation.isPending ? t.common.deleting : t.common.confirm}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    );
  }

  const canSubmit =
    !!block &&
    !!floor &&
    !!unitNumber &&
    !!flatPassword &&
    !linkMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          <span className="sr-only">{t.common.back}</span>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t.myFlats.title}</h1>
          <p className="text-sm text-muted-foreground">{t.myFlats.subtitle}</p>
        </div>
      </div>

      {/* Flat list */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </>
        ) : (
          <>
            {primary && renderFlatCard(primary, true)}
            {linked.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                {t.myFlats.emptyLinked}
              </p>
            ) : (
              linked.map((f) => renderFlatCard(f, false))
            )}
          </>
        )}
      </div>

      {/* Add unit form */}
      <Card className="mt-6">
        <CardContent className="space-y-4 p-4">
          <div>
            <h2 className="text-base font-semibold">{t.myFlats.addTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.myFlats.addSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t.common.block}</Label>
                <Select
                  value={block || undefined}
                  onValueChange={(v) => {
                    setBlock(v);
                    setFloor('');
                    setUnitNumber('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.common.floor}</Label>
                <Select
                  value={floor || undefined}
                  onValueChange={(v) => {
                    setFloor(v);
                    setUnitNumber('');
                  }}
                  disabled={!block}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {floors.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.common.unit}</Label>
                <Select
                  value={unitNumber || undefined}
                  onValueChange={setUnitNumber}
                  disabled={!block || !floor}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                {t.myFlats.passwordPlaceholder}
              </Label>
              <Input
                type="password"
                value={flatPassword}
                onChange={(e) => setFlatPassword(e.target.value)}
                placeholder={t.myFlats.passwordPlaceholder}
                aria-invalid={!!submitError}
              />
              {submitError && (
                <p className="text-destructive text-sm">{submitError}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} />
              <span className="ml-1.5">
                {linkMutation.isPending
                  ? t.myFlats.addingFlat
                  : t.myFlats.addButton}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
