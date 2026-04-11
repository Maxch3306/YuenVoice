import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { File01Icon, Upload01Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

import { getDocuments, uploadDocument } from '@/services/oc';
import { useAuthStore } from '@/stores/auth-store';
import { useT } from '@/lib/i18n';
import type { OcDocumentType } from '@/types';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const currentYear = new Date().getFullYear();
const yearTabs = [currentYear, currentYear - 1, currentYear - 2, 'older'] as const;

const typeColorMap: Record<OcDocumentType, string> = {
  meeting_minutes: 'bg-blue-100 text-blue-800 border-blue-200',
  financial_statement: 'bg-green-100 text-green-800 border-green-200',
  resolution: 'bg-amber-100 text-amber-800 border-amber-200',
  notice: 'bg-slate-100 text-slate-800 border-slate-200',
};

export default function DocumentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canUpload = user?.role === 'oc_committee' || user?.role === 'admin';
  const t = useT();

  const typeLabelMap: Record<OcDocumentType, string> = {
    meeting_minutes: t.docType.meeting_minutes,
    financial_statement: t.docType.financial_statement,
    resolution: t.docType.resolution,
    notice: t.docType.notice,
  };

  const typeOptions: { value: string; label: string }[] = [
    { value: '', label: t.ocDocs.allTypes },
    { value: 'meeting_minutes', label: t.docType.meeting_minutes },
    { value: 'financial_statement', label: t.docType.financial_statement },
    { value: 'resolution', label: t.docType.resolution },
    { value: 'notice', label: t.docType.notice },
  ];

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<OcDocumentType | ''>('');
  const [uploadYear, setUploadYear] = useState(String(currentYear));
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const yearParam =
    selectedYear === 'older'
      ? undefined
      : Number(selectedYear);

  const { data, isLoading } = useQuery({
    queryKey: ['oc-documents', selectedYear, typeFilter, page],
    queryFn: () =>
      getDocuments({
        year: yearParam,
        type: typeFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => uploadDocument(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oc-documents'] });
      resetUploadForm();
      setUploadOpen(false);
    },
  });

  function resetUploadForm() {
    setUploadTitle('');
    setUploadType('');
    setUploadYear(String(currentYear));
    setUploadDescription('');
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleUpload() {
    if (!uploadTitle || !uploadType || !uploadFile) return;
    const formData = new FormData();
    formData.append('title', uploadTitle);
    formData.append('type', uploadType);
    formData.append('year', uploadYear);
    if (uploadDescription) formData.append('description', uploadDescription);
    formData.append('file', uploadFile);
    uploadMutation.mutate(formData);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const documents = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-2xl font-bold">{t.ocDocs.title}</h1>

      {/* Year Tabs */}
      <Tabs
        value={selectedYear}
        onValueChange={(v) => {
          setSelectedYear(v);
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList className="w-full">
          {yearTabs.map((y) => (
            <TabsTrigger key={y} value={String(y)} className="flex-1">
              {y === 'older' ? t.ocDocs.earlier : y}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Type Filter */}
      <div className="mb-6">
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t.ocDocs.allTypes} />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value || '_all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <HugeiconsIcon icon={File01Icon} size={48} className="opacity-40" />
          <p className="text-sm">{t.ocDocs.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              size="sm"
              className="cursor-pointer transition-colors hover:bg-accent/40"
              onClick={() => navigate(`/oc/${doc.id}`)}
            >
              <CardContent className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 shrink-0 text-muted-foreground">
                  <HugeiconsIcon icon={File01Icon} size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={typeColorMap[doc.type]}
                    >
                      {typeLabelMap[doc.type]}
                    </Badge>
                  </div>
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(doc.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
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

      {/* Upload Button (OC/Admin) */}
      {canUpload && (
        <Button
          className="mt-6 w-full"
          onClick={() => setUploadOpen(true)}
        >
          <HugeiconsIcon icon={Upload01Icon} size={18} />
          <span className="ml-2">{t.ocDocs.upload}</span>
        </Button>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.ocDocs.uploadTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">{t.ocDocs.docTitle}</Label>
              <Input
                id="doc-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder={t.ocDocs.docTitlePlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.ocDocs.docType}</Label>
              <Select
                value={uploadType}
                onValueChange={(v) => setUploadType(v as OcDocumentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.ocDocs.docTypePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting_minutes">{t.docType.meeting_minutes}</SelectItem>
                  <SelectItem value="financial_statement">{t.docType.financial_statement}</SelectItem>
                  <SelectItem value="resolution">{t.docType.resolution}</SelectItem>
                  <SelectItem value="notice">{t.docType.notice}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.ocDocs.year}</Label>
              <Select value={uploadYear} onValueChange={setUploadYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(
                    (y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-desc">{t.ocDocs.description}</Label>
              <Textarea
                id="doc-desc"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder={t.ocDocs.descriptionPlaceholder}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.ocDocs.file}</Label>
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <HugeiconsIcon
                  icon={Upload01Icon}
                  size={24}
                  className="mb-2 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  {t.ocDocs.filePlaceholder}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.ocDocs.fileHint}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
              {uploadFile && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {uploadFile.name}{' '}
                  {(uploadFile.size / (1024 * 1024)).toFixed(1)}MB
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">{t.common.cancel}</Button>
            </DialogClose>
            <Button
              onClick={handleUpload}
              disabled={
                !uploadTitle || !uploadType || !uploadFile || uploadMutation.isPending
              }
            >
              {uploadMutation.isPending ? t.common.uploading : t.ocDocs.upload}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
