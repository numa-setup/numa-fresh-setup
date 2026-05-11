import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Pending', color: '#92400E', bgColor: '#FEF3C7' },
  STORE_CONFIRMED: { label: 'Confirmed', color: '#1E40AF', bgColor: '#DBEAFE' },
  IN_PREPARATION: { label: 'Preparing', color: '#5B21B6', bgColor: '#EDE9FE' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', color: '#065F46', bgColor: '#D1FAE5' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: '#065F46', bgColor: '#D1FAE5' },
  COMPLETED: { label: 'Completed', color: '#065F46', bgColor: '#D1FAE5' },
  CANCELLED: { label: 'Cancelled', color: '#991B1B', bgColor: '#FEE2E2' },
  REFUNDED: { label: 'Refunded', color: '#374151', bgColor: '#F3F4F6' },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: !!id,
  });

  const st = styles(colors);
  const statusCfg = order ? (STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING) : null;

  if (isLoading) {
    return (
      <View style={st.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={st.loading}>
        <Text style={[{ color: colors.foreground }]}>Order not found.</Text>
      </View>
    );
  }

  const total = order.finalTotal ?? order.estimatedTotal ?? 0;

  return (
    <ScrollView
      style={[st.container]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 16 }}
    >
      {/* Status card */}
      <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={st.cardHeader}>
          <View>
            <Text style={[st.orderNum, { color: colors.foreground }]}>#{order.orderNumber}</Text>
            <Text style={[st.orderDate, { color: colors.mutedForeground }]}>
              {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {statusCfg && (
            <View style={[st.badge, { backgroundColor: statusCfg.bgColor }]}>
              <Text style={[st.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          )}
        </View>

        {order.store && (
          <Text style={[st.storeName, { color: colors.mutedForeground }]}>
            From <Text style={{ fontWeight: '700', color: colors.foreground }}>{order.store.name}</Text>
          </Text>
        )}

        {/* Track button */}
        {order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
          <TouchableOpacity
            style={[st.trackBtn, { backgroundColor: colors.primaryPale, borderColor: colors.primary }]}
            onPress={() => router.push(`/orders/${order.id}/track`)}
          >
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
            <Text style={[st.trackBtnText, { color: colors.primary }]}>Track Order</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Items */}
      <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Items</Text>
        {order.items?.map((item) => (
          <View key={item.id} style={[st.itemRow, { borderBottomColor: colors.border }]}>
            <Text style={[st.itemName, { color: colors.foreground }]}>{item.name}</Text>
            <Text style={[st.itemQty, { color: colors.mutedForeground }]}>×{item.quantity}</Text>
            <Text style={[st.itemPrice, { color: colors.foreground }]}>${(item.totalPrice ?? (item.unitPrice ?? item.price) * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        <View style={[st.totalRow]}>
          <Text style={[st.totalLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[st.totalValue, { color: colors.primary }]}>${total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Status timeline */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[st.sectionTitle, { color: colors.foreground }]}>Status Timeline</Text>
          {order.statusHistory.map((event, index) => {
            const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.PENDING;
            return (
              <View key={index} style={st.timelineItem}>
                <View style={[st.timelineDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.timelineStatus, { color: colors.foreground }]}>{cfg.label}</Text>
                  <Text style={[st.timelineDate, { color: colors.mutedForeground }]}>
                    {new Date(event.createdAt).toLocaleString()}
                  </Text>
                  {event.note && <Text style={[st.timelineNote, { color: colors.mutedForeground }]}>{event.note}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderNum: { fontSize: 18, fontWeight: '800' },
  orderDate: { fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  storeName: { fontSize: 14, marginBottom: 12 },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, borderWidth: 1.5, height: 44,
  },
  trackBtnText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  itemName: { flex: 1, fontSize: 14 },
  itemQty: { fontSize: 14, marginRight: 12 },
  itemPrice: { fontSize: 14, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineStatus: { fontSize: 14, fontWeight: '700' },
  timelineDate: { fontSize: 12, marginTop: 2 },
  timelineNote: { fontSize: 12, marginTop: 2 },
});
