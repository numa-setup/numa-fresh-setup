import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Order, PromoValidation } from '@/lib/types';

interface ListOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
}

export function useOrders(status?: string, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', String(page));

  return useQuery<ListOrdersResponse>({
    queryKey: ['orders', status, page],
    queryFn: () => api.get<ListOrdersResponse>(`/orders?${params}`),
  });
}

export function useOrder(orderId: string) {
  return useQuery<Order>({
    queryKey: ['orders', orderId],
    queryFn: () => api.get<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
  });
}

interface CreateOrderPayload {
  storeId: string;
  orderType: string;
  items: Array<{
    productId: string;
    quantity: number;
    meatCutType?: string;
    meatCutInstructions?: string;
    customerNote?: string;
    weightKg?: number;
  }>;
  promoCode?: string;
  loyaltyPointsToUse?: number;
  tip?: number;
  specialInstructions?: string;
  pickupSlotId?: string;
  addressId?: string;
  vehicleInfo?: { make?: string; model?: string; color?: string };
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderPayload) => api.post<Order>('/orders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      api.post<Order>(`/orders/${orderId}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useValidatePromo() {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) =>
      api.post<PromoValidation>('/orders/validate-promo', { code, subtotal }),
  });
}
