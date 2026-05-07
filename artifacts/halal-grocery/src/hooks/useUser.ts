import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

interface Address {
  id: string;
  label?: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
}

interface LoyaltyHistory {
  points: number;
  history: Array<{
    id: string;
    points: number;
    type: string;
    description: string;
    createdAt: string;
  }>;
}

export function useProfile() {
  return useQuery<User>({
    queryKey: ['user', 'profile'],
    queryFn: () => api.get<User>('/users/profile'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<User>) => api.patch<User>('/users/profile', data),
    onSuccess: (user) => {
      qc.setQueryData(['user', 'profile'], user);
    },
  });
}

export function useAddresses() {
  return useQuery<Address[]>({
    queryKey: ['user', 'addresses'],
    queryFn: () => api.get<Address[]>('/users/addresses'),
  });
}

export function useAddAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Address, 'id'>) => api.post<Address>('/users/addresses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'addresses'] });
    },
  });
}

export function useLoyalty() {
  return useQuery<LoyaltyHistory>({
    queryKey: ['user', 'loyalty'],
    queryFn: () => api.get<LoyaltyHistory>('/users/loyalty'),
  });
}

interface StorePortalOrdersResponse {
  orders: any[];
  total: number;
  page: number;
  totalPages: number;
}

export function useStorePortalOrders(page = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  return useQuery<StorePortalOrdersResponse>({
    queryKey: ['store-portal', 'orders', page, status],
    queryFn: () => api.get<StorePortalOrdersResponse>(`/orders/store-portal/list?${params}`),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, note }: { orderId: string; status: string; note?: string }) =>
      api.patch<any>(`/orders/${orderId}/status`, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-portal', 'orders'] });
    },
  });
}

export function useStoreDashboard() {
  return useQuery({
    queryKey: ['analytics', 'store-portal'],
    queryFn: () => api.get<any>('/store-portal/dashboard'),
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['analytics', 'admin'],
    queryFn: () => api.get<any>('/admin/dashboard'),
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['analytics', 'platform'],
    queryFn: () => api.get<any>('/platform/stats'),
  });
}
