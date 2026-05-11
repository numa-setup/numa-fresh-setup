import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Order } from '@/lib/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  PENDING: { label: 'Pending', color: '#92400E', bgColor: '#FEF3C7', icon: 'time-outline' },
  STORE_CONFIRMED: { label: 'Confirmed', color: '#1E40AF', bgColor: '#DBEAFE', icon: 'checkmark-circle-outline' },
  IN_PREPARATION: { label: 'Preparing', color: '#5B21B6', bgColor: '#EDE9FE', icon: 'construct-outline' },
  READY_FOR_PICKUP: { label: 'Ready!', color: '#065F46', bgColor: '#D1FAE5', icon: 'bag-check-outline' },
  OUT_FOR_DELIVERY: { label: 'On the Way', color: '#065F46', bgColor: '#D1FAE5', icon: 'bicycle-outline' },
  COMPLETED: { label: 'Completed', color: '#065F46', bgColor: '#D1FAE5', icon: 'checkmark-done-outline' },
  CANCELLED: { label: 'Cancelled', color: '#991B1B', bgColor: '#FEE2E2', icon: 'close-circle-outline' },
  REFUNDED: { label: 'Refunded', color: '#374151', bgColor: '#F3F4F6', icon: 'return-down-back-outline' },
};

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
];

function OrderCard({ order }: { order: Order }) {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

  const cancel = useMutation({
    mutationFn: () => api.post(`/orders/${order.id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const total = order.finalTotal ?? order.estimatedTotal ?? 0;
  const date = new Date(order.createdAt);

  return (
    <TouchableOpacity
      style={[oc.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/orders/${order.id}`)}
      activeOpacity={0.88}
    >
      <View style={oc.top}>
        <View>
          <Text style={[oc.orderNum, { color: colors.foreground }]}>#{order.orderNumber}</Text>
          <Text style={[oc.date, { color: colors.mutedForeground }]}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[oc.badge, { backgroundColor: st.bgColor }]}>
          <Text style={[oc.badgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      {order.store && (
        <Text style={[oc.storeName, { color: colors.mutedForeground }]}>
          From <Text style={{ fontWeight: '700', color: colors.foreground }}>{order.store.name}</Text>
        </Text>
      )}

      <Text style={[oc.items, { color: colors.mutedForeground }]} numberOfLines={1}>
        {order.items?.slice(0, 3).map((i, idx) => `${idx > 0 ? ', ' : ''}${i.name} ×${i.quantity}`).join('')}
        {order.items?.length > 3 ? ` +${order.items.length - 3} more` : ''}
      </Text>

      <View style={oc.bottom}>
        <Text style={[oc.total, { color: colors.foreground }]}>${total.toFixed(2)}</Text>
        <View style={oc.actions}>
          {(order.status === 'PENDING' || order.status === 'STORE_CONFIRMED') && (
            <TouchableOpacity
              style={[oc.actionBtn, { borderColor: colors.destructive }]}
              onPress={(e) => { e.stopPropagation(); cancel.mutate(); }}
              disabled={cancel.isPending}
            >
              <Text style={[oc.actionBtnText, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          {order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
            <TouchableOpacity
              style={[oc.actionBtn, { borderColor: colors.primary }]}
              onPress={(e) => { e.stopPropagation(); router.push(`/orders/${order.id}/track`); }}
            >
              <Text style={[oc.actionBtnText, { color: colors.primary }]}>Track</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const oc = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, padding: 16,
    marginHorizontal: 16, marginBottom: 10,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderNum: { fontSize: 15, fontWeight: '800' },
  date: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  storeName: { fontSize: 13, marginBottom: 6 },
  items: { fontSize: 13, marginBottom: 10 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 17, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  const ACTIVE_STATUSES = new Set([
    'PENDING', 'STORE_CONFIRMED', 'IN_PREPARATION',
    'REPLACEMENT_HANDLING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY',
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<{ orders: Order[] }>('/orders', { limit: '100' }),
    enabled: !!user,
  });

  const allOrders = data?.orders || [];
  const orders = (() => {
    switch (activeTab) {
      case 'active':
        return allOrders.filter((o) => ACTIVE_STATUSES.has(o.status));
      case 'completed':
        return allOrders.filter((o) => o.status === 'COMPLETED' || o.status === 'REFUNDED');
      case 'cancelled':
        return allOrders.filter((o) => o.status === 'CANCELLED');
      default:
        return allOrders;
    }
  })();

  const st = styles(colors);

  if (!user) {
    return (
      <View style={st.authPrompt}>
        <Ionicons name="receipt-outline" size={64} color={colors.mutedForeground} />
        <Text style={[st.authTitle, { color: colors.foreground }]}>Sign In to View Orders</Text>
        <Text style={[st.authSub, { color: colors.mutedForeground }]}>Track your orders and reorder your favorites.</Text>
      </View>
    );
  }

  return (
    <View style={[st.container]}>
      {/* Tab bar */}
      <View style={[st.tabBar, { paddingTop: Platform.OS === 'web' ? insets.top + 20 : 8 }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[st.tabItem, activeTab === tab.id && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
          >
            <Text style={[st.tabText, { color: activeTab === tab.id ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={st.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={st.empty}>
          <Ionicons name="receipt-outline" size={48} color={colors.mutedForeground} />
          <Text style={[st.emptyTitle, { color: colors.foreground }]}>No Orders</Text>
          <Text style={[st.emptySub, { color: colors.mutedForeground }]}>You haven't placed any orders yet.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  tabBar: {
    flexDirection: 'row', backgroundColor: c.background,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center' },
  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  authTitle: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  authSub: { fontSize: 14, textAlign: 'center' },
});
