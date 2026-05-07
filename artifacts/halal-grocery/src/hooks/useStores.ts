import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Store, Product, Review, PickupSlot } from '@/lib/types';

interface ListStoresResponse {
  stores: Store[];
  total: number;
  page: number;
  totalPages: number;
}

interface ListStoresParams {
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useStores(params: ListStoresParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.city) searchParams.set('city', params.city);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString() ? `?${searchParams}` : '';

  return useQuery<ListStoresResponse>({
    queryKey: ['stores', params],
    queryFn: () => api.get<ListStoresResponse>(`/stores${query}`),
  });
}

export function useFeaturedStores() {
  return useQuery<Store[]>({
    queryKey: ['stores', 'featured'],
    queryFn: () => api.get<Store[]>('/stores/featured'),
  });
}

export function useStore(slug: string) {
  return useQuery<Store>({
    queryKey: ['stores', slug],
    queryFn: () => api.get<Store>(`/stores/${slug}`),
    enabled: !!slug,
  });
}

interface StoreProductsParams {
  category?: string;
  search?: string;
  productType?: string;
  page?: number;
  limit?: number;
}

interface StoreProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export function useStoreProducts(storeSlug: string, params: StoreProductsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.search) searchParams.set('search', params.search);
  if (params.productType) searchParams.set('productType', params.productType);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString() ? `?${searchParams}` : '';

  return useQuery<StoreProductsResponse>({
    queryKey: ['stores', storeSlug, 'products', params],
    queryFn: () => api.get<StoreProductsResponse>(`/stores/${storeSlug}/products${query}`),
    enabled: !!storeSlug,
  });
}

interface StoreReviewsResponse {
  reviews: Review[];
  total: number;
  averageRating: number;
  ratingBreakdown: Record<string, number>;
}

export function useStoreReviews(storeSlug: string, page = 1) {
  return useQuery<StoreReviewsResponse>({
    queryKey: ['stores', storeSlug, 'reviews', page],
    queryFn: () => api.get<StoreReviewsResponse>(`/stores/${storeSlug}/reviews?page=${page}`),
    enabled: !!storeSlug,
  });
}

export function usePickupSlots(storeSlug: string) {
  return useQuery<PickupSlot[]>({
    queryKey: ['stores', storeSlug, 'pickup-slots'],
    queryFn: () => api.get<PickupSlot[]>(`/stores/${storeSlug}/pickup-slots`),
    enabled: !!storeSlug,
  });
}
