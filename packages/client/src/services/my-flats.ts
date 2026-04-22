import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import api from '@/lib/api';

export interface MyFlat {
  id: string;
  block: string;
  floor: string;
  unit_number: string;
  is_primary: boolean;
  linked_at: string | null;
}

export interface LinkFlatPayload {
  block: string;
  floor: string;
  unitNumber: string;
  flatPassword: string;
}

const keys = {
  myFlats: ['users', 'me', 'flats'] as const,
};

export async function getMyFlats(): Promise<MyFlat[]> {
  const { data } = await api.get<{ data: MyFlat[] }>('/api/users/me/flats');
  return data.data;
}

export function useMyFlats() {
  return useQuery({
    queryKey: keys.myFlats,
    queryFn: getMyFlats,
    staleTime: 60 * 1000,
  });
}

export function useLinkFlat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LinkFlatPayload): Promise<MyFlat> => {
      const { data } = await api.post<MyFlat>('/api/users/me/flats', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.myFlats });
      // Discussion board list changes when flats change.
      qc.invalidateQueries({ queryKey: ['discussion', 'boards'] });
    },
  });
}

export function useUnlinkFlat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flatId: string): Promise<void> => {
      await api.delete(`/api/users/me/flats/${flatId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.myFlats });
      qc.invalidateQueries({ queryKey: ['discussion', 'boards'] });
    },
  });
}
