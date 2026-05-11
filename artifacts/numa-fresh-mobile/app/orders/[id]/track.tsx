import { ComponentProps, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const STATUS_STEPS: Array<{ key: string; label: string; icon: IoniconName }> = [
  { key: 'PENDING', label: 'Order Placed', icon: 'receipt-outline' },
  { key: 'STORE_CONFIRMED', label: 'Store Confirmed', icon: 'checkmark-circle-outline' },
  { key: 'IN_PREPARATION', label: 'Being Prepared', icon: 'construct-outline' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', icon: 'bag-check-outline' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: 'bicycle-outline' },
  { key: 'COMPLETED', label: 'Completed', icon: 'checkmark-done-circle-outline' },
];

function getStepIndex(status: string) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function RatingModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const colors = useColors();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const qc = useQueryClient();

  const submitRating = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/rate`, { rating, review }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['order', orderId] }); onClose(); },
  });

  return (
    <View style={[rm.container, { backgroundColor: colors.card }]}>
      <Text style={[rm.title, { color: colors.foreground }]}>Rate Your Order</Text>
      <View style={rm.stars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity key={s} onPress={() => setRating(s)}>
            <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={36} color={s <= rating ? '#F59E0B' : colors.border} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[rm.submitBtn, { backgroundColor: colors.primary }]}
        onPress={() => submitRating.mutate()}
        disabled={submitRating.isPending}
      >
        {submitRating.isPending ? (
          <ActivityIndicator color={colors.card} />
        ) : (
          <Text style={[rm.submitText, { color: colors.card }]}>Submit Rating</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose}>
        <Text style={[rm.skipText, { color: colors.mutedForeground }]}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const rm = StyleSheet.create({
  container: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  stars: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  submitBtn: { borderRadius: 14, height: 52, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  submitText: { fontSize: 16, fontWeight: '700' },
  skipText: { fontSize: 14 },
});

export default function OrderTrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showRating, setShowRating] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const imHere = useMutation({
    mutationFn: () => api.post(`/orders/${id}/im-here`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Notified!', 'The store has been notified that you are here.');
    },
  });

  useEffect(() => {
    if (order?.status === 'COMPLETED') setShowRating(true);
  }, [order?.status]);

  const st = styles(colors);

  if (isLoading && !order) {
    return <View style={st.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!order) {
    return <View style={st.loading}><Text style={{ color: colors.foreground }}>Order not found</Text></View>;
  }

  const currentStep = getStepIndex(order.status);
  const isCurbside = order.orderType === 'CURBSIDE_PICKUP';
  const isReady = order.status === 'READY_FOR_PICKUP';
  const isCompleted = order.status === 'COMPLETED';
  const total = order.finalTotal ?? order.estimatedTotal ?? 0;
  const showQR = isReady || order.status === 'STORE_CONFIRMED' || order.status === 'IN_PREPARATION';
  const qrValue = order.orderNumber ?? order.id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 16 }}>

        {/* Order header */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[st.orderNum, { color: colors.foreground }]}>Order #{order.orderNumber}</Text>
          {order.store && (
            <Text style={[st.storeName, { color: colors.mutedForeground }]}>From {order.store.name}</Text>
          )}
          <Text style={[st.total, { color: colors.primary }]}>${total.toFixed(2)}</Text>
        </View>

        {/* Status timeline */}
        {!isCompleted && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[st.sectionTitle, { color: colors.foreground }]}>Order Status</Text>
            {STATUS_STEPS.slice(0, order.orderType === 'STORE_DELIVERY' ? 6 : 5).map((step, index) => {
              const isActive = index === currentStep;
              const isDone = index < currentStep;
              return (
                <View key={step.key} style={st.timelineRow}>
                  <View style={[st.timelineDot, {
                    backgroundColor: isDone ? colors.primary : isActive ? colors.primary : colors.muted,
                    borderColor: isActive ? colors.primary : 'transparent',
                  }]}>
                    {isDone ? (
                      <Ionicons name="checkmark" size={12} color={colors.card} />
                    ) : (
                      <Ionicons name={step.icon} size={12} color={isActive ? colors.card : colors.mutedForeground} />
                    )}
                  </View>
                  {index < 4 && <View style={[st.timelineLine, { backgroundColor: isDone ? colors.primary : colors.border }]} />}
                  <Text style={[st.timelineLabel, {
                    color: isActive || isDone ? colors.foreground : colors.mutedForeground,
                    fontWeight: isActive ? '800' : '500',
                  }]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Completed state */}
        {isCompleted && (
          <View style={[st.card, { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}>
            <Ionicons name="checkmark-done-circle" size={48} color={colors.card} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={[st.completedTitle, { color: colors.card }]}>Order Complete!</Text>
            <Text style={[st.completedSub, { color: 'rgba(255,255,255,0.8)' }]}>Thank you for choosing Numa Fresh</Text>
          </View>
        )}

        {/* QR Code */}
        {showQR && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
            <Text style={[st.sectionTitle, { color: colors.foreground }]}>Pickup QR Code</Text>
            <View style={[st.qrBox, { backgroundColor: '#fff', borderColor: colors.border }]}>
              <QRCode
                value={qrValue}
                size={160}
                color="#1a1a1a"
                backgroundColor="#ffffff"
              />
            </View>
            <Text style={[st.qrOrderNum, { color: colors.foreground }]}>#{order.orderNumber}</Text>
            <Text style={[st.qrNote, { color: colors.mutedForeground }]}>Show this to the store associate</Text>
          </View>
        )}

        {/* Order items */}
        {order.items && order.items.length > 0 && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[st.sectionTitle, { color: colors.foreground }]}>Items</Text>
            {order.items.map((item) => (
              <View key={item.id} style={st.itemRow}>
                <Text style={[st.itemQty, { color: colors.mutedForeground }]}>×{item.quantity}</Text>
                <Text style={[st.itemName, { color: colors.foreground, flex: 1 }]}>{item.name}</Text>
                <Text style={[st.itemPrice, { color: colors.mutedForeground }]}>${(item.totalPrice ?? (item.unitPrice ?? item.price) * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={[st.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) }]}>
        {isCurbside && isReady && (
          <TouchableOpacity
            style={[st.imHereBtn, { backgroundColor: colors.gold }]}
            onPress={() => imHere.mutate()}
            disabled={imHere.isPending}
            activeOpacity={0.85}
          >
            <Ionicons name="car-outline" size={20} color={colors.primaryDarker} />
            <Text style={[st.imHereText, { color: colors.primaryDarker }]}>I'm Here!</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[st.detailsBtn, { borderColor: colors.border }]}
          onPress={() => router.push(`/orders/${order.id}`)}
        >
          <Text style={[st.detailsBtnText, { color: colors.foreground }]}>Order Details</Text>
        </TouchableOpacity>
      </View>

      {/* Rating modal */}
      {showRating && (
        <View style={st.modalBackdrop}>
          <View style={[st.modalContent, { backgroundColor: colors.card }]}>
            <RatingModal orderId={order.id} onClose={() => setShowRating(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  orderNum: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  storeName: { fontSize: 14, marginBottom: 4 },
  total: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 16 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  timelineLine: { position: 'absolute', left: 12, top: 28, width: 2, height: 14 },
  timelineLabel: { fontSize: 14 },
  completedTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  completedSub: { fontSize: 14, textAlign: 'center' },
  qrBox: {
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  qrOrderNum: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  qrNote: { fontSize: 13, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  itemQty: { fontSize: 13, fontWeight: '700', minWidth: 24 },
  itemName: { fontSize: 13 },
  itemPrice: { fontSize: 13, fontWeight: '600' },
  bottomBar: { flexDirection: 'row', padding: 16, borderTopWidth: 1, gap: 12 },
  imHereBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, height: 52, gap: 8,
  },
  imHereText: { fontSize: 16, fontWeight: '800' },
  detailsBtn: { flex: 1, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  detailsBtnText: { fontSize: 15, fontWeight: '600' },
  modalBackdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
