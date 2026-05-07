import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';

interface ListProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

interface ListProductsParams {
  search?: string;
  category?: string;
  productType?: string;
  storeId?: string;
  page?: number;
  limit?: number;
}

export function useProducts(params: ListProductsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.category) searchParams.set('category', params.category);
  if (params.productType) searchParams.set('productType', params.productType);
  if (params.storeId) searchParams.set('storeId', params.storeId);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString() ? `?${searchParams}` : '';

  return useQuery<ListProductsResponse>({
    queryKey: ['products', params],
    queryFn: () => api.get<ListProductsResponse>(`/products${query}`),
  });
}

export function useFeaturedProducts() {
  return useQuery<Product[]>({
    queryKey: ['products', 'featured'],
    queryFn: () => api.get<Product[]>('/products/featured'),
  });
}

export function useProduct(slug: string) {
  return useQuery<Product>({
    queryKey: ['products', slug],
    queryFn: () => api.get<Product>(`/products/${slug}`),
    enabled: !!slug,
  });
}
