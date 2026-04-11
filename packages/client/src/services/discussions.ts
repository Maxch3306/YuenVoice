import api from '@/lib/api';
import type {
  DiscussionBoard,
  DiscussionPost,
  PostComment,
  PaginatedResponse,
} from '@/types';

// ─── API Functions ──────────────────────────────────────────────

export async function getBoards(): Promise<DiscussionBoard[]> {
  const res = await api.get('/api/boards');
  const payload = res.data;
  return Array.isArray(payload) ? payload : payload.data ?? [];
}

export async function getPosts(
  boardId: string,
  params?: { page?: number; limit?: number }
): Promise<PaginatedResponse<DiscussionPost>> {
  const { data } = await api.get<PaginatedResponse<DiscussionPost>>(
    `/api/boards/${boardId}/posts`,
    { params }
  );
  return data;
}

export async function createPost(
  boardId: string,
  formData: FormData
): Promise<DiscussionPost> {
  const { data } = await api.post<{ data: DiscussionPost }>(
    `/api/boards/${boardId}/posts`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data;
}

export async function getPost(postId: string): Promise<DiscussionPost> {
  const { data } = await api.get<{ data: DiscussionPost }>(`/api/posts/${postId}`);
  return data.data;
}

export async function addComment(
  postId: string,
  content: string,
  isAnonymous?: boolean
): Promise<PostComment> {
  const { data } = await api.post<{ data: PostComment }>(`/api/posts/${postId}/comments`, {
    content,
    isAnonymous: isAnonymous ?? false,
  });
  return data.data;
}

export async function toggleReaction(
  postId: string,
  type: string = 'like'
): Promise<{ reacted: boolean; totalReactions: number }> {
  const { data } = await api.post<{ data: { reacted: boolean; totalReactions: number } }>(
    `/api/posts/${postId}/reactions`,
    { type }
  );
  return data.data;
}

export async function flagPost(
  postId: string,
  reason?: string
): Promise<void> {
  await api.post(`/api/posts/${postId}/report`, { reason });
}

export async function moderatePost(
  postId: string,
  action: string
): Promise<DiscussionPost> {
  const { data } = await api.patch<{ data: DiscussionPost }>(
    `/api/posts/${postId}/moderate`,
    { action }
  );
  return data.data;
}

// ─── TanStack Query Hooks ───────────────────────────────────────

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

export const boardKeys = {
  all: ['boards'] as const,
};

export const postKeys = {
  all: ['posts'] as const,
  list: (boardId: string) => ['posts', 'list', boardId] as const,
  detail: (postId: string) => ['posts', 'detail', postId] as const,
};

export function useBoards() {
  return useQuery({
    queryKey: boardKeys.all,
    queryFn: getBoards,
  });
}

export function usePosts(boardId: string, page = 1, limit = 15) {
  return useQuery({
    queryKey: [...postKeys.list(boardId), page, limit],
    queryFn: () => getPosts(boardId, { page, limit }),
    enabled: !!boardId,
  });
}

export function usePost(postId: string) {
  return useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => getPost(postId),
    enabled: !!postId,
  });
}

export function useCreatePost(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => createPost(boardId, formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: postKeys.list(boardId) });
    },
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { content: string; isAnonymous?: boolean }) =>
      addComment(postId, vars.content, vars.isAnonymous),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}

export function useToggleReaction(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: string) => toggleReaction(postId, type),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: postKeys.detail(postId) });
      const previous = qc.getQueryData<DiscussionPost>(postKeys.detail(postId));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(postKeys.detail(postId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}

export function useFlagPost() {
  return useMutation({
    mutationFn: (vars: { postId: string; reason?: string }) =>
      flagPost(vars.postId, vars.reason),
  });
}

export function useModeratePost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: string) => moderatePost(postId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}
