import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from './api';

/**
 * Round 10 / Fix #6 — Save List (wishlist) hooks.
 *
 * useSavedIds()         — set of productIds the current user has saved
 * useToggleSaved()      — { isSaved, toggle, pending }
 * useSavedProducts()    — full list with product+store for the /account/saved page
 */

export interface SavedItem {
  savedAt: string;
  product: {
    id: string;
    slug: string;
    name: string;
    images: string[];
    price: number;
    unit: string;
    stockQty: number;
    isHalalCertified: boolean;
    category: string;
    storeId: string;
  };
  store: {
    id: string;
    slug: string;
    name: string;
    city: string;
  };
}

const SAVED_IDS_KEY = ['saves', 'ids'] as const;
const SAVED_LIST_KEY = ['saves', 'list'] as const;

export function useSavedIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: SAVED_IDS_KEY,
    queryFn: () => api.get<{ ids: string[] }>('/saves/ids').then(r => new Set(r.ids)),
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useSavedProducts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: SAVED_LIST_KEY,
    queryFn: () => api.get<{ items: SavedItem[] }>('/saves').then(r => r.items),
    enabled: !!user,
  });
}

/**
 * Returns helpers for a single product's saved state. Keeps the API
 * optimistic — toggling immediately mutates the cached id-set so the heart
 * fills in without a network round-trip.
 */
export function useToggleSaved(productId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: ids } = useSavedIds();
  const isSaved = !!productId && !!ids?.has(productId);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!productId) return;
      if (next) {
        await api.post('/saves', { productId });
      } else {
        await api.delete(`/saves/${productId}`);
      }
    },
    onMutate: async next => {
      if (!productId) return;
      await qc.cancelQueries({ queryKey: SAVED_IDS_KEY });
      const previous = qc.getQueryData<Set<string>>(SAVED_IDS_KEY);
      const updated = new Set(previous ?? []);
      if (next) updated.add(productId);
      else updated.delete(productId);
      qc.setQueryData(SAVED_IDS_KEY, updated);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(SAVED_IDS_KEY, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SAVED_IDS_KEY });
      qc.invalidateQueries({ queryKey: SAVED_LIST_KEY });
    },
  });

  return {
    isSaved,
    pending: mutation.isPending,
    isAuthenticated: !!user,
    toggle: () => mutation.mutate(!isSaved),
    setSaved: (next: boolean) => mutation.mutate(next),
  };
}
