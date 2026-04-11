import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export async function getBlocks(): Promise<string[]> {
  const { data } = await api.get<string[]>('/api/flats/blocks');
  return data;
}

export async function getFloors(): Promise<string[]> {
  const { data } = await api.get<string[]>('/api/flats/floors');
  return data;
}

export async function getUnits(block?: string, floor?: string): Promise<string[]> {
  const params: Record<string, string> = {};
  if (block) params.block = block;
  if (floor) params.floor = floor;
  const { data } = await api.get<string[]>('/api/flats/units', { params });
  return data;
}

export const flatKeys = {
  blocks: ['flats', 'blocks'] as const,
  floors: ['flats', 'floors'] as const,
  units: (block?: string, floor?: string) => ['flats', 'units', block, floor] as const,
};

export function useBlocks() {
  return useQuery({
    queryKey: flatKeys.blocks,
    queryFn: getBlocks,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFloors() {
  return useQuery({
    queryKey: flatKeys.floors,
    queryFn: getFloors,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnits(block?: string, floor?: string) {
  return useQuery({
    queryKey: flatKeys.units(block, floor),
    queryFn: () => getUnits(block, floor),
    enabled: !!block && !!floor,
    staleTime: 5 * 60 * 1000,
  });
}
