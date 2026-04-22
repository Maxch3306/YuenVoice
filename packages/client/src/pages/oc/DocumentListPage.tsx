import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  File01Icon,
  Upload01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Link01Icon,
} from '@hugeicons/core-free-icons';

import { getDocuments, uploadDocument, publishLink } from '@/services/oc';
import { useAuthStore } from '@/stores/auth-store';
import { useT } from '@/lib/i18n';
import type { OcDocumentType } from '@/types';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  meeting_livestream: 'bg-rose-100 text-rose-800 border-rose-200',
  meeting_recording: 'bg-purple-100 text-purple-800 border-purple-200',
};

function isValidHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function DocumentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canPublish =
    user?.role === 'oc_committee' ||
    user?.role === 'mgmt_staff' ||
    user?.role === 'admin';
  const t = useT();

  const typeLabelMap: Record<OcDocumentType, string> = {
    meeting_minutes: t.docType.meeting_minutes,
    financial_statement: t.docType.financial_statement,
    resolution: t.docType.resolution,
    notice: t.docType.notice,
    meeting_livestream: t.docType.meeting_livestream,
    meeting_recording: t.docType.meeting_recording,
  };

  const typeOptions: { value: string; label: string }[] = [
    { value: '', label: t.ocDocs.allTypes },
    { value: 'meeting_minutes', label: t.docType.meeting_minutes },
    { value: 'financial_statement', label: t.docType.financial_statement },
    { value: 'resolution', label: t.docType.resolution },
    { value: 'notice', label: t.docType.notice },
    { value: 'meeting_livestream', label: t.docType.meeting_livestream },
    { value: 'meeting_recording', label: t.docType.meeting_recording },
  ];

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sourceTab, setSourceTab] = useState<'file' | 'link'>('file');

  // Shared form state
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<OcDocumentType | ''>('');
  const [year, setYear] = useState(String(currentYear));
  const [description, setDescription] = useState('');

  // File tab state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link tab state
  const [externalUrl, setExternalUrl] = useState('');

  const yearParam = selectedYear === 'older' ? undefined : Number(selectedYear);

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
      resetForm();
      setUploadOpen(false);
    },
  });

  const linkMutation = useMutation({
    mutationFn: publishLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oc-documents'] });
      resetForm();
      setUploadOpen(false);
    },
  });

  function resetForm() {
    setTitle('');
    setDocType('');
    setYear(String(currentYear));
    setDescription('');
    setUploadFile(null);
    setExternalUrl('');
    setSourceTab('file');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit() {
    if (!title || !docType) return;
    if (sourceTab === 'file') {
      if (!uploadFile) return;
      const formData = new FormData();
      formData.append('title', title);
      formData.append('type', docType);
      formData.append('year', year);
      if (description) formData.append('description', description);
      formData.append('file', uploadFile);
      uploadMutation.mutate(formData);
    } else {
      if (!isValidHttpUrl(externalUrl)) return;
      linkMutation.mutate({
        title,
        description: description || undefined,
        type: docType,
        year: Number(year),
        externalUrl,
      });
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const documents = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const isPending = uploadMutation.isPending || linkMutation.isPending;
  const canSubmit =
    !!title &&
    !!docType &&
    !isPending &&
    (sourceTab === 'file'
      ? !!uploadFile
      : isValidHttpUrl(externalUrl));

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
            setTypeFilter(v === '_all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t.ocDocs.allTypes} />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value || '_all'} value={opt.value || '_all'}>
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
          {documents.map((doc) => {
            const isLink = !!doc.external_url;
            return (
              <Card
                key={doc.id}
                size="sm"
                className="cursor-pointer transition-colors hover:bg-accent/40"
                onClick={() => navigate(`/oc/${doc.id}`)}
              >
                <CardContent className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                    <HugeiconsIcon
                      icon={isLink ? Link01Icon : File01Icon}
                      size={24}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={typeColorMap[doc.type]}
                      >
                        {typeLabelMap[doc.type]}
                      </Badge>
                      {isLink && doc.link_type && (
                        <Badge variant="outline" className="text-xs">
                          {t.ocDocs.linkType[doc.link_type]}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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

      {/* Publish Button (committee / mgmt / admin) */}
      {canPublish && (
        <Button
          className="mt-6 w-full"
          onClick={() => setUploadOpen(true)}
        >
          <HugeiconsIcon icon={Upload01Icon} size={18} />
          <span className="ml-2">{t.ocDocs.upload}</span>
        </Button>
      )}

      {/* Publish Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.ocDocs.uploadTitle}</DialogTitle>
          </DialogHeader>

          <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as 'file' | 'link')}>
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                {t.ocDocs.sourceTabFile}
              </TabsTrigger>
              <TabsTrigger value="link" className="flex-1">
                {t.ocDocs.sourceTabLink}
              </TabsTrigger>
            </TabsList>

            {/* Shared fields */}
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="doc-title">{t.ocDocs.docTitle}</Label>
                <Input
                  id="doc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.ocDocs.docTitlePlaceholder}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.ocDocs.docType}</Label>
                <Select
                  value={docType}
                  onValueChange={(v) => setDocType(v as OcDocumentType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.ocDocs.docTypePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting_minutes">{t.docType.meeting_minutes}</SelectItem>
                    <SelectItem value="financial_statement">{t.docType.financial_statement}</SelectItem>
                    <SelectItem value="resolution">{t.docType.resolution}</SelectItem>
                    <SelectItem value="notice">{t.docType.notice}</SelectItem>
                    <SelectItem value="meeting_livestream">{t.docType.meeting_livestream}</SelectItem>
                    <SelectItem value="meeting_recording">{t.docType.meeting_recording}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.ocDocs.year}</Label>
                <Select value={year} onValueChange={setYear}>
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.ocDocs.descriptionPlaceholder}
                  rows={3}
                />
              </div>
            </div>

            {/* File tab */}
            <TabsContent value="file" className="mt-4 space-y-1.5">
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
            </TabsContent>

            {/* Link tab */}
            <TabsContent value="link" className="mt-4 space-y-1.5">
              <Label htmlFor="doc-url">{t.ocDocs.externalUrl}</Label>
              <Input
                id="doc-url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder={t.ocDocs.externalUrlPlaceholder}
                aria-invalid={!!externalUrl && !isValidHttpUrl(externalUrl)}
              />
              {!!externalUrl && !isValidHttpUrl(externalUrl) && (
                <p className="text-destructive text-xs">
                  {t.ocDocs.externalUrlInvalid}
                </p>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">{t.common.cancel}</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isPending
                ? t.common.uploading
                : sourceTab === 'file'
                  ? t.ocDocs.upload
                  : t.ocDocs.publishLink}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
