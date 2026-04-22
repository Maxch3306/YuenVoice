import api from '@/lib/api';
import type {
  OcDocument,
  OcDocumentLinkType,
  OcDocumentType,
  PaginatedResponse,
} from '@/types';

export interface PublishLinkPayload {
  title: string;
  description?: string;
  type: OcDocumentType;
  year: number;
  externalUrl: string;
  linkType?: OcDocumentLinkType;
}

export interface GetDocumentsParams {
  year?: number;
  type?: string;
  page?: number;
  limit?: number;
}

export async function getDocuments(
  params: GetDocumentsParams = {},
): Promise<PaginatedResponse<OcDocument>> {
  const { data } = await api.get<PaginatedResponse<OcDocument>>(
    '/api/oc-documents',
    { params },
  );
  return data;
}

export async function getDocument(id: string): Promise<OcDocument> {
  const { data } = await api.get<OcDocument>(`/api/oc-documents/${id}`);
  return data;
}

export async function uploadDocument(
  formData: FormData,
): Promise<OcDocument> {
  const { data } = await api.post<OcDocument>('/api/oc-documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function publishLink(
  payload: PublishLinkPayload,
): Promise<OcDocument> {
  const { data } = await api.post<OcDocument>(
    '/api/oc-documents/link',
    payload,
  );
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/api/oc-documents/${id}`);
}
