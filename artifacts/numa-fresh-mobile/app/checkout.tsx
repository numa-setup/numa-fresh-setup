import { ComponentProps, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import type { PickupSlot, ServerError } from '@/lib/types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type OrderType = 'PICKUP' | 'CURBSIDE' | 'DELIVERY';

const STEPS = [
  { id: 1, label: 'Order Type' },
  { id: 2, label: 'Pickup Slot' },
  { id: 3, label: 'Promo & Pay' },
  { id: 4, label: 'Review' },
];

const ORDER_TYPES: Array<{ type: OrderType; icon: IoniconName; label: string; desc: string; fee: number }> = [
  { type: 'PICKUP', icon: 'bag-outline', label: 'Express Pickup', desc: 'Walk in and pick up in ~25 min', fee: 0 },
  { type: 'CURBSIDE', icon: 'car-outline', label: 'Curbside', desc: 'We bring it to your vehicle', fee: 1.49 },
  { type: 'DELIVERY', icon: 'bicycle-outline', label: 'Delivery', desc: 'Delivered to your door', fee: 4.99 },
];

const TIP_OPTIONS = [0, 1, 2, 3, 5];
const POINTS_PER_DOLLAR = 100;
const POINT_VALUE_CENTS = 1;

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { items, storeId, storeSlug, storeName, subtotal, clearCart } = useCart();

  const [step, setStep] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>('PICKUP');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoValid, setPromoValid] = useState<{ discountAmount: number; message: string } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [tip, setTip] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  const { data: slotsData } = useQuery({
    queryKey: ['slots', storeSlug],
    queryFn: () => api.get<PickupSlot[]>(`/slots/${storeSlug}`),
    enabled: !!storeSlug && step === 2,
  });
  const slots = slotsData || [];

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get<{ points: number; pointsValue: number; tier: string }>('/users/loyalty'),
    enabled: !!user,
  });
  const availablePoints = loyaltyData?.points ?? 0;

  const convenienceFee = 2.99;
  const deliveryFee = orderType === 'DELIVERY' ? 4.99 : 0;
  const curbsideFee = orderType === 'CURBSIDE' ? 1.49 : 0;
  const promoDiscount = promoValid?.discountAmount ?? 0;

  const baseTotal = subtotal + convenienceFee + deliveryFee + curbsideFee + tip - promoDiscount;
  const maxPointsUsable = Math.min(availablePoints, Math.floor(baseTotal * POINTS_PER_DOLLAR));
  const loyaltyDiscount = usePoints ? maxPointsUsable * (POINT_VALUE_CENTS / 100) : 0;
  const total = Math.max(0, baseTotal - loyaltyDiscount);

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    setPromoError('');
    try {
      const result = await api.post<{ valid: boolean; discountAmount: number; message: string }>(
        '/orders/promo/validate',
        { code: promoCode, orderTotal: subtotal },
      );
      if (result.valid) {
        setPromoValid({ discountAmount: result.discountAmount, message: result.message });
      } else {
        setPromoError(result.message || 'Invalid promo code');
        setPromoValid(null);
      }
    } catch {
      setPromoError('Could not validate promo code');
      setPromoValid(null);
    } finally {
      setValidatingPromo(false);
    }
  };

  const placeOrder = useMutation({
    mutationFn: () => {
      const dbOrderType =
        orderType === 'PICKUP' ? 'EXPRESS_PICKUP' : orderType === 'CURBSIDE' ? 'CURBSIDE_PICKUP' : 'STORE_DELIVERY';
      return api.post<{ id: string; orderNumber: string }>('/orders', {
        storeId,
        orderType: dbOrderType,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          meatCutType: i.selectedCut,
          meatCutInstructions: i.cutInstructions,
          weightKg: i.weightKg,
        })),
        pickupSlotId: selectedSlot ?? undefined,
        tip,
        promoCode: promoCode || undefined,
        loyaltyPointsToUse: usePoints ? maxPointsUsable : 0,
        specialInstructions:
          [notes, orderType === 'DELIVERY' && deliveryAddress ? `Delivery: ${deliveryAddress}` : '']
            .filter(Boolean)
            .join(' | ') || undefined,
      });
    },
    onSuccess: (order) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      router.replace(`/orders/${order.id}/track`);
    },
    onError: (err: ServerError) => {
      Alert.alert('Order Failed', err?.response?.data?.message ?? err.message ?? 'Please try again.');
    },
  });

  const st = styles(colors);

  const slotsByDate = slots.reduce<Record<string, PickupSlot[]>>((acc, slot) => {
    const d = new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!acc[d]) acc[d] = [];
    acc[d].push(slot);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Progress */}
      <View style={[st.progressBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {STEPS.filter((s) => s.id <= 4).map((s, i) => (
          <View key={s.id} style={st.progressStep}>
            <View style={[st.progressDot, {
              backgroundColor: step >= s.id ? colors.primary : colors.muted,
              borderColor: step >= s.id ? colors.primary : colors.border,
            }]}>
              {step > s.id ? (
                <Ionicons name="checkmark" size={12} color={colors.card} />
              ) : (
                <Text style={[st.progressNum, { color: step === s.id ? colors.card : colors.mutedForeground }]}>{s.id}</Text>
              )}
            </View>
            <Text style={[st.progressLabel, { color: step >= s.id ? colors.primary : colors.mutedForeground }]}>{s.label}</Text>
            {i < 3 && <View style={[st.progressLine, { backgroundColor: step > s.id ? colors.primary : colors.border }]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>

        {/* Step 1: Order Type */}
        {step === 1 && (
          <View>
            <Text style={[st.stepTitle, { color: colors.foreground }]}>How would you like your order?</Text>
            {ORDER_TYPES.map((opt) => (
              <TouchableOpacity
                key={opt.type}
                style={[st.optionCard, {
                  backgroundColor: colors.card, borderColor: orderType === opt.type ? colors.primary : colors.border,
                  borderWidth: orderType === opt.type ? 2 : 1,
                }]}
                onPress={() => setOrderType(opt.type)}
                activeOpacity={0.85}
              >
                <View style={[st.optionIcon, { backgroundColor: orderType === opt.type ? colors.primary : colors.muted }]}>
                  <Ionicons name={opt.icon} size={22} color={orderType === opt.type ? colors.card : colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.optionLabel, { color: colors.foreground }]}>{opt.label}</Text>
                  <Text style={[st.optionDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                  {opt.fee > 0 && <Text style={[st.optionFee, { color: colors.mutedForeground }]}>+${opt.fee.toFixed(2)}</Text>}
                </View>
                {orderType === opt.type && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
              </TouchableOpacity>
            ))}

            {orderType === 'DELIVERY' && (
              <View style={[st.addressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[st.addressLabel, { color: colors.foreground }]}>Delivery Address</Text>
                <TextInput
                  style={[st.addressInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Street, City, Province, Postal Code"
                  placeholderTextColor={colors.mutedForeground}
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  multiline
                />
              </View>
            )}
          </View>
        )}

        {/* Step 2: Pickup Slot */}
        {step === 2 && (
          <View>
            <Text style={[st.stepTitle, { color: colors.foreground }]}>Choose a Pickup Slot</Text>
            <TouchableOpacity
              style={[st.skipBtn, { borderColor: colors.border }]}
              onPress={() => { setSelectedSlot(null); setStep(3); }}
            >
              <Text style={[st.skipText, { color: colors.mutedForeground }]}>Skip - Express Pickup (ASAP)</Text>
            </TouchableOpacity>

            {Object.entries(slotsByDate).map(([date, dateSlots]) => (
              <View key={date} style={{ marginBottom: 20 }}>
                <Text style={[st.dateLabel, { color: colors.foreground }]}>{date}</Text>
                <View style={st.slotsGrid}>
                  {dateSlots.map((slot) => {
                    const available = slot.availableCapacity > 0;
                    const isSelected = selectedSlot === slot.id;
                    const timeLabel = slot.endTime
                      ? `${slot.startTime}–${slot.endTime}`
                      : slot.startTime;
                    return (
                      <TouchableOpacity
                        key={slot.id}
                        disabled={!available}
                        onPress={() => setSelectedSlot(slot.id)}
                        style={[st.slotChip, {
                          backgroundColor: isSelected ? colors.primary : available ? colors.card : colors.muted,
                          borderColor: isSelected ? colors.primary : colors.border,
                          opacity: available ? 1 : 0.5,
                        }]}
                      >
                        <Text style={[st.slotTime, { color: isSelected ? colors.card : colors.foreground }]}>{timeLabel}</Text>
                        <Text style={[st.slotCap, { color: isSelected ? 'rgba(255,255,255,0.7)' : colors.mutedForeground }]}>
                          {slot.availableCapacity} left
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Step 3: Promo, Loyalty & Tip */}
        {step === 3 && (
          <View>
            <Text style={[st.stepTitle, { color: colors.foreground }]}>Promo & Payment</Text>

            {/* Promo code */}
            <View style={[st.promoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.promoLabel, { color: colors.foreground }]}>Promo Code</Text>
              <View style={st.promoRow}>
                <TextInput
                  style={[st.promoInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Enter code..."
                  placeholderTextColor={colors.mutedForeground}
                  value={promoCode}
                  onChangeText={(t) => { setPromoCode(t.toUpperCase()); setPromoValid(null); setPromoError(''); }}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[st.promoBtn, { backgroundColor: colors.primary }]}
                  onPress={validatePromo}
                  disabled={validatingPromo || !promoCode.trim()}
                >
                  {validatingPromo ? (
                    <ActivityIndicator size="small" color={colors.card} />
                  ) : (
                    <Text style={[st.promoBtnText, { color: colors.card }]}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {promoValid && <Text style={[st.promoSuccess, { color: colors.primary }]}>{promoValid.message} (-${promoValid.discountAmount.toFixed(2)})</Text>}
              {promoError ? <Text style={[st.promoError, { color: colors.destructive }]}>{promoError}</Text> : null}
            </View>

            {/* Loyalty points */}
            {user && availablePoints > 0 && (
              <View style={[st.loyaltyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={st.loyaltyRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="diamond" size={16} color={colors.gold} />
                      <Text style={[st.loyaltyTitle, { color: colors.foreground }]}>Loyalty Points</Text>
                    </View>
                    <Text style={[st.loyaltySub, { color: colors.mutedForeground }]}>
                      {availablePoints} pts available — save ${(maxPointsUsable * POINT_VALUE_CENTS / 100).toFixed(2)}
                    </Text>
                  </View>
                  <Switch
                    value={usePoints}
                    onValueChange={setUsePoints}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.card}
                  />
                </View>
                {usePoints && (
                  <View style={[st.loyaltyBadge, { backgroundColor: colors.primaryPale }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    <Text style={[st.loyaltyBadgeText, { color: colors.primary }]}>
                      Using {maxPointsUsable} pts · -${loyaltyDiscount.toFixed(2)} off
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Tip */}
            <View style={[st.tipCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.tipLabel, { color: colors.foreground }]}>Tip for the store</Text>
              <View style={st.tipRow}>
                {TIP_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTip(t)}
                    style={[st.tipChip, { backgroundColor: tip === t ? colors.primary : colors.muted, borderColor: tip === t ? colors.primary : colors.border }]}
                  >
                    <Text style={[st.tipText, { color: tip === t ? colors.card : colors.foreground }]}>
                      {t === 0 ? 'None' : `$${t}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Special instructions */}
            <View style={[st.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.notesLabel, { color: colors.foreground }]}>Special Instructions</Text>
              <TextInput
                style={[st.notesInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Any notes for the store..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View>
            <Text style={[st.stepTitle, { color: colors.foreground }]}>Review Your Order</Text>

            <View style={[st.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.reviewSection, { color: colors.foreground }]}>From {storeName}</Text>
              {items.map((item) => (
                <View key={item.product.id} style={st.reviewItem}>
                  <Text style={[st.reviewItemName, { color: colors.foreground }]} numberOfLines={1}>{item.product.name}</Text>
                  <Text style={[st.reviewItemPrice, { color: colors.mutedForeground }]}>×{item.quantity} ${(item.product.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
            </View>

            <View style={[st.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[st.reviewSection, { color: colors.foreground }]}>Summary</Text>
              {[
                { label: 'Subtotal', value: `$${subtotal.toFixed(2)}` },
                { label: 'Convenience Fee', value: `$${convenienceFee.toFixed(2)}` },
                ...(deliveryFee > 0 ? [{ label: 'Delivery Fee', value: `$${deliveryFee.toFixed(2)}` }] : []),
                ...(curbsideFee > 0 ? [{ label: 'Curbside Fee', value: `$${curbsideFee.toFixed(2)}` }] : []),
                ...(tip > 0 ? [{ label: 'Tip', value: `$${tip.toFixed(2)}` }] : []),
                ...(promoDiscount > 0 ? [{ label: 'Promo Discount', value: `-$${promoDiscount.toFixed(2)}` }] : []),
                ...(loyaltyDiscount > 0 ? [{ label: `Points Redeemed (${maxPointsUsable} pts)`, value: `-$${loyaltyDiscount.toFixed(2)}` }] : []),
              ].map(({ label, value }) => (
                <View key={label} style={st.reviewItem}>
                  <Text style={[st.reviewItemName, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[st.reviewItemPrice, { color: colors.mutedForeground }]}>{value}</Text>
                </View>
              ))}
              <View style={[st.totalDivider, { backgroundColor: colors.border }]} />
              <View style={st.reviewItem}>
                <Text style={[st.reviewTotalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={[st.reviewTotalValue, { color: colors.primary }]}>${total.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={[st.paymentNote, { color: colors.mutedForeground }]}>
              Payment will be collected at pickup/delivery. Cash or card accepted at the store.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={[st.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) }]}>
        {step > 1 && (
          <TouchableOpacity style={[st.backStepBtn, { borderColor: colors.border }]} onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
        )}
        {step < 4 ? (
          <TouchableOpacity
            style={[st.nextBtn, { backgroundColor: colors.primary, flex: step > 1 ? 1 : undefined }]}
            onPress={() => {
              if (step === 1 && orderType === 'DELIVERY' && !deliveryAddress.trim()) {
                Alert.alert('Address Required', 'Please enter your delivery address.');
                return;
              }
              setStep(step + 1);
            }}
            activeOpacity={0.85}
          >
            <Text style={[st.nextBtnText, { color: colors.card }]}>
              {step === 3 ? 'Review Order' : 'Continue'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.card} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[st.nextBtn, { backgroundColor: colors.primary, flex: 1 }]}
            onPress={() => placeOrder.mutate()}
            disabled={placeOrder.isPending}
            activeOpacity={0.85}
          >
            {placeOrder.isPending ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.card} />
                <Text style={[st.nextBtnText, { color: colors.card }]}>Place Order</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  progressBar: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, justifyContent: 'space-between' },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  progressNum: { fontSize: 11, fontWeight: '800' },
  progressLabel: { fontSize: 11, fontWeight: '600' },
  progressLine: { width: 20, height: 2, marginHorizontal: 2 },
  stepTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  optionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 12, gap: 14 },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  optionDesc: { fontSize: 13, marginBottom: 2 },
  optionFee: { fontSize: 12 },
  addressCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8 },
  addressLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  addressInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 52 },
  skipBtn: { borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', marginBottom: 20 },
  skipText: { fontSize: 14 },
  dateLabel: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 90, alignItems: 'center' },
  slotTime: { fontSize: 14, fontWeight: '700' },
  slotCap: { fontSize: 11, marginTop: 2 },
  promoCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  promoLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  promoRow: { flexDirection: 'row', gap: 10 },
  promoInput: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, height: 48 },
  promoBtn: { paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', height: 48 },
  promoBtnText: { fontSize: 14, fontWeight: '700' },
  promoSuccess: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  promoError: { fontSize: 13, marginTop: 8 },
  loyaltyCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  loyaltyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loyaltyTitle: { fontSize: 14, fontWeight: '700' },
  loyaltySub: { fontSize: 12 },
  loyaltyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10, alignSelf: 'flex-start',
  },
  loyaltyBadgeText: { fontSize: 12, fontWeight: '700' },
  tipCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  tipLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  tipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tipChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  tipText: { fontSize: 14, fontWeight: '600' },
  notesCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  notesLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  notesInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 70 },
  reviewCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  reviewSection: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  reviewItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewItemName: { fontSize: 14, flex: 1 },
  reviewItemPrice: { fontSize: 14, fontWeight: '600' },
  totalDivider: { height: 1, marginVertical: 8 },
  reviewTotalLabel: { fontSize: 16, fontWeight: '800' },
  reviewTotalValue: { fontSize: 20, fontWeight: '800' },
  paymentNote: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  bottomBar: { flexDirection: 'row', padding: 16, borderTopWidth: 1, gap: 12 },
  backStepBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, height: 52, gap: 8 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
});
