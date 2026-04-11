import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  IncidentReport,
  IncidentAttachment,
  IncidentComment,
  ReportType,
  ReportStatus,
  PaginatedResponse,
} from '@/types';

// ─── Filter types ───────────────────────────────────────────────

export interface ReportFilters {
  status?: ReportStatus;
  type?: ReportType;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

// ─── API functions ──────────────────────────────────────────────

export async function getReports(params: ReportFilters = {}): Promise<PaginatedResponse<IncidentReport>> {
  const { data } = await api.get<PaginatedResponse<IncidentReport>>('/api/reports', { params });
  return data;
}

export async function getReport(id: string): Promise<IncidentReport> {
  const { data } = await api.get<IncidentReport>(`/api/reports/${id}`);
  return data;
}

export async function createReport(formData: FormData): Promise<IncidentReport> {
  const { data } = await api.post<IncidentReport>('/api/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateStatus(id: string, status: ReportStatus): Promise<IncidentReport> {
  const { data } = await api.patch<IncidentReport>(`/api/reports/${id}/status`, { status });
  return data;
}

export async function addComment(
  id: string,
  content: string,
  isInternal?: boolean,
): Promise<IncidentComment> {
  const { data } = await api.post<IncidentComment>(`/api/reports/${id}/comments`, {
    content,
    isInternal: isInternal ?? false,
  });
  return data;
}

export async function uploadAttachments(
  id: string,
  files: File[],
): Promise<IncidentAttachment[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const { data } = await api.post<IncidentAttachment[]>(
    `/api/reports/${id}/attachments`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

// ─── Query keys ─────────────────────────────────────────────────

export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (filters: ReportFilters) => [...reportKeys.lists(), filters] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportKeys.details(), id] as const,
};

// ─── TanStack Query hooks ───────────────────────────────────────

export function useReports(filters: ReportFilters = {}) {
  return useQuery({
    queryKey: reportKeys.list(filters),
    queryFn: () => getReports(filters),
    placeholderData: keepPreviousData,
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: reportKeys.detail(id),
    queryFn: () => getReport(id),
    enabled: !!id,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists() });
    },
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) =>
      updateStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: reportKeys.lists() });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      content,
      isInternal,
    }: {
      id: string;
      content: string;
      isInternal?: boolean;
    }) => addComment(id, content, isInternal),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.detail(variables.id) });
    },
  });
}
