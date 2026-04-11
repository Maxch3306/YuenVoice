import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Cancel01Icon, Image01Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useCreateReport } from '@/services/reports';
import { useBlocks, useFloors } from '@/services/flats';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Constants ──────────────────────────────────────────────────

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Component ──────────────────────────────────────────────────

export default function CreateReportPage() {
  const navigate = useNavigate();
  const t = useT();
  const createReport = useCreateReport();
  const { data: BLOCKS = [] } = useBlocks();
  const { data: FLOORS = [] } = useFloors();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [block, setBlock] = useState('');
  const [floor, setFloor] = useState('');
  const [area, setArea] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── File handling ──────────────────────────────────────────

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const incoming = Array.from(newFiles);
      const validFiles: File[] = [];

      for (const file of incoming) {
        if (files.length + validFiles.length >= MAX_FILES) break;
        if (file.size > MAX_FILE_SIZE) continue;
        if (!file.type.startsWith('image/')) continue;
        validFiles.push(file);
      }

      if (validFiles.length === 0) return;

      const newPreviews = validFiles.map((f) => URL.createObjectURL(f));
      setFiles((prev) => [...prev, ...validFiles]);
      setPreviews((prev) => [...prev, ...newPreviews]);
    },
    [files.length],
  );

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  }

  // ─── Validation ─────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = t.createReport.titleRequired;
    if (!type) newErrors.type = t.createReport.typePlaceholder;
    if (!description.trim()) newErrors.description = t.createReport.descriptionRequired;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── Submit ─────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('type', type);
    formData.append('description', description.trim());
    if (block) formData.append('locationBlock', block);
    if (floor) formData.append('locationFloor', floor);
    if (area.trim()) formData.append('locationArea', area.trim());
    files.forEach((file) => formData.append('attachments', file));

    try {
      const report = await createReport.mutateAsync(formData);
      navigate(`/reports/${report.id}`, { replace: true });
    } catch {
      // Error handled by TanStack Query
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          <span className="sr-only">{t.common.back}</span>
        </Button>
        <h1 className="text-xl font-bold">{t.createReport.title}</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">{t.createReport.fieldTitle}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={t.createReport.titlePlaceholder}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>{t.createReport.type}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger aria-invalid={!!errors.type}>
                  <SelectValue placeholder={t.createReport.typePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repair">{t.reportType.maintenance}</SelectItem>
                  <SelectItem value="complaint">{t.reportType.complaint}</SelectItem>
                  <SelectItem value="inquiry">{t.reportType.inquiry}</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">{t.createReport.description}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder={t.createReport.descriptionPlaceholder}
                aria-invalid={!!errors.description}
              />
              <p className="text-right text-xs text-muted-foreground">
                {description.length}/5000
              </p>
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label>{t.createReport.location}</Label>
              <div className="flex gap-2">
                <Select value={block} onValueChange={setBlock}>
                  <SelectTrigger className="w-1/2">
                    <SelectValue placeholder={t.common.block} />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCKS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}{t.common.block}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={floor} onValueChange={setFloor}>
                  <SelectTrigger className="w-1/2">
                    <SelectValue placeholder={t.common.floor} />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOORS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}{t.common.floor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder={t.createReport.locationDetail}
              />
            </div>

            {/* Photo upload */}
            <div className="space-y-1.5">
              <Label>{t.createReport.attachments}</Label>
              <div
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50',
                  files.length >= MAX_FILES && 'pointer-events-none opacity-50',
                )}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <HugeiconsIcon
                  icon={Image01Icon}
                  className="mb-2 size-8 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  {t.createReport.attachmentsHint}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.createReport.attachmentsLimit(MAX_FILES)}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Thumbnails */}
              {previews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {previews.map((src, i) => (
                    <div
                      key={src}
                      className="relative h-20 w-20 overflow-hidden rounded-md border"
                    >
                      <img
                        src={src}
                        alt={t.createReport.attachmentLabel(i + 1)}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={createReport.isPending}
            >
              {createReport.isPending ? t.common.submitting : t.createReport.submit}
            </Button>

            {createReport.isError && (
              <p className="text-center text-sm text-destructive">
                {t.createReport.submitError}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
