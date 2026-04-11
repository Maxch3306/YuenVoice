import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Download01Icon, Delete01Icon } from '@hugeicons/core-free-icons';

import { getDocument, deleteDocument } from '@/services/oc';
import { useAuthStore } from '@/stores/auth-store';
import type { OcDocumentType } from '@/types';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const typeLabelMap: Record<OcDocumentType, string> = {
  meeting_minutes: '會議記錄',
  financial_statement: '財務報表',
  resolution: '決議公告',
  notice: '一般通知',
};

const typeColorMap: Record<OcDocumentType, string> = {
  meeting_minutes: 'bg-blue-100 text-blue-800 border-blue-200',
  financial_statement: 'bg-green-100 text-green-800 border-green-200',
  resolution: 'bg-amber-100 text-amber-800 border-amber-200',
  notice: 'bg-slate-100 text-slate-800 border-slate-200',
};

function isPdf(filePath: string) {
  return filePath.toLowerCase().endsWith('.pdf');
}

function isImage(filePath: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath);
}

export default function DocumentViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canDelete = user?.role === 'oc_committee' || user?.role === 'admin';

  const { data: doc, isLoading } = useQuery({
    queryKey: ['oc-document', id],
    queryFn: () => getDocument(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oc-documents'] });
      navigate('/oc');
    },
  });

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const apiBase = import.meta.env.VITE_API_URL || '';
  const fileUrl = doc ? `${apiBase}/uploads/${doc.file_path}` : '';

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Skeleton className="mb-4 h-8 w-24" />
        <Skeleton className="mb-6 h-48 w-full rounded-2xl" />
        <Skeleton className="h-[50vh] w-full rounded-2xl" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Button variant="ghost" onClick={() => navigate('/oc')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          <span className="ml-1">返回</span>
        </Button>
        <div className="mt-16 text-center text-muted-foreground">
          找不到文件
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate('/oc')}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
        <span className="ml-1">返回</span>
      </Button>

      {/* Metadata Card */}
      <Card className="mb-6">
        <CardContent className="space-y-3 px-5 py-4">
          <Badge
            variant="outline"
            className={typeColorMap[doc.type]}
          >
            {typeLabelMap[doc.type]}
          </Badge>

          <h2 className="text-xl font-bold">{doc.title}</h2>

          <div className="space-y-1 text-sm text-muted-foreground">
            {doc.publisher && (
              <p>發佈者: {doc.publisher.name}</p>
            )}
            <p>發佈日期: {formatDate(doc.created_at)}</p>
            <p>年份: {doc.year}</p>
          </div>

          {doc.description && (
            <div>
              <p className="mb-1 text-sm font-medium">描述:</p>
              <p className="text-sm text-muted-foreground">
                {doc.description}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" asChild>
              <a href={fileUrl} download>
                <HugeiconsIcon icon={Download01Icon} size={16} />
                <span className="ml-1.5">下載</span>
              </a>
            </Button>

            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <HugeiconsIcon icon={Delete01Icon} size={16} />
                    <span className="ml-1.5">刪除</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>確定刪除此文件？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作無法復原。
                      <br />
                      文件：{doc.title}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? '刪除中...' : '確定刪除'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Viewer */}
      {isPdf(doc.file_path) && (
        <div className="overflow-hidden rounded-2xl border">
          <iframe
            src={fileUrl}
            title={doc.title}
            className="h-[70vh] w-full"
          />
        </div>
      )}

      {isImage(doc.file_path) && (
        <div className="overflow-hidden rounded-2xl border">
          <img
            src={fileUrl}
            alt={doc.title}
            className="w-full object-contain"
          />
        </div>
      )}

      {!isPdf(doc.file_path) && !isImage(doc.file_path) && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border py-16 text-muted-foreground">
          <p className="text-sm">此文件格式無法在線預覽，請下載查看。</p>
        </div>
      )}
    </div>
  );
}
