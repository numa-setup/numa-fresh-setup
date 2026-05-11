import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { LoyaltyData } from '@/lib/types';

const TIP_OPTIONS = [0, 1, 2, 3, 5];

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { items, storeName, updateQuantity, removeItem, subtotal, itemCount, clearCart } = useCart();

  const [selectedTip, setSelectedTip] = useState(0);
  const [useLoyalty, setUseLoyalty] = useState(false);

  const { data: loyaltyData } = useQuery<LoyaltyData>({
    queryKey: ['loyalty'],
    queryFn: () => api.get<LoyaltyData>('/users/loyalty'),
    enabled: !!user,
  });

  const loyaltyPoints = loyaltyData?.points ?? 0;
  const loyaltyDiscount = useLoyalty ? Math.min(loyaltyPoints * 0.01, subtotal) : 0;
  const convenienceFee = 2.99;
  const total = subtotal + convenienceFee + selectedTip - loyaltyDiscount;

  const st = styles(colors);

  if (itemCount === 0) {
    return (
      <View style={[st.empty, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="cart-outline" size={64} color={colors.mutedForeground} />
        <Text style={[st.emptyTitle, { color: colors.foreground }]}>Your Cart is Empty</Text>
        <Text style={[st.emptySub, { color: colors.mutedForeground }]}>Add items from a halal store to get started.</Text>
        <TouchableOpacity style={[st.browseBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace('/(tabs)/stores')}>
          <Text style={[st.browseBtnText, { color: colors.card }]}>Browse Stores</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Store info */}
        {storeName && (
          <View style={[st.storeBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[st.storeIcon, { backgroundColor: colors.primary }]}>
              <Text style={st.storeIconText}>{storeName[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.storeName, { color: colors.foreground }]}>{storeName}</Text>
              <Text style={[st.storeItems, { color: colors.mutedForeground }]}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: clearCart },
              ])}
            >
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        )}

        {/* Items */}
        <View style={[st.itemsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {items.map((item, index) => {
            const img = item.product.images?.[0];
            return (
              <View
                key={item.product.id}
                style={[st.itemRow, index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <View style={[st.itemImg, { backgroundColor: colors.muted }]}>
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Ionicons name="leaf" size={18} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.itemName, { color: colors.foreground }]} numberOfLines={2}>{item.product.name}</Text>
                  {item.selectedCut && (
                    <Text style={[st.itemCut, { color: colors.primary }]}>Cut: {item.selectedCut}</Text>
                  )}
                  <Text style={[st.itemPrice, { color: colors.mutedForeground }]}>${item.product.price.toFixed(2)}</Text>
                </View>
                <View style={st.qtyControls}>
                  <TouchableOpacity onPress={() => updateQuantity(item.product.id, item.quantity - 1)} style={[st.qtyBtn, { borderColor: colors.border }]}>
                    <Ionicons name="remove" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                  <Text style={[st.qtyText, { color: colors.foreground }]}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item.product.id, item.quantity + 1)} style={[st.qtyBtn, { borderColor: colors.border }]}>
                    <Ionicons name="add" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Tip selection */}
        <View style={[st.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[st.cardTitle, { color: colors.foreground }]}>Add a Tip</Text>
          <Text style={[st.cardSub, { color: colors.mutedForeground }]}>Support your store's hard-working staff</Text>
          <View style={st.tipRow}>
            {TIP_OPTIONS.map((tip) => (
              <TouchableOpacity
                key={tip}
                onPress={() => setSelectedTip(tip)}
                style={[
                  st.tipBtn,
                  selectedTip === tip
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text style={[st.tipText, { color: selectedTip === tip ? colors.card : colors.foreground }]}>
                  {tip === 0 ? 'No tip' : `$${tip}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Loyalty points */}
        {user && loyaltyPoints > 0 && (
          <TouchableOpacity
            style={[st.sectionCard, { backgroundColor: colors.card, borderColor: useLoyalty ? colors.primary : colors.border }]}
            onPress={() => setUseLoyalty(!useLoyalty)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="star" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={[st.cardTitle, { color: colors.foreground }]}>Loyalty Points</Text>
                <Text style={[st.cardSub, { color: colors.mutedForeground }]}>
                  {loyaltyPoints.toLocaleString()} pts available — save ${(loyaltyPoints * 0.01).toFixed(2)}
                </Text>
              </View>
              <View style={[st.toggle, useLoyalty ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}>
                <View style={[st.toggleKnob, useLoyalty ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Fee breakdown */}
        <View style={[st.feeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[st.feeTitle, { color: colors.foreground }]}>Order Summary</Text>
          <View style={st.feeRow}>
            <Text style={[st.feeLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
            <Text style={[st.feeValue, { color: colors.foreground }]}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={st.feeRow}>
            <Text style={[st.feeLabel, { color: colors.mutedForeground }]}>Convenience Fee</Text>
            <Text style={[st.feeValue, { color: colors.foreground }]}>${convenienceFee.toFixed(2)}</Text>
          </View>
          {selectedTip > 0 && (
            <View style={st.feeRow}>
              <Text style={[st.feeLabel, { color: colors.mutedForeground }]}>Tip</Text>
              <Text style={[st.feeValue, { color: colors.foreground }]}>${selectedTip.toFixed(2)}</Text>
            </View>
          )}
          {useLoyalty && loyaltyDiscount > 0 && (
            <View style={st.feeRow}>
              <Text style={[st.feeLabel, { color: colors.primary }]}>Loyalty Discount</Text>
              <Text style={[st.feeValue, { color: colors.primary }]}>-${loyaltyDiscount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[st.feeDivider, { backgroundColor: colors.border }]} />
          <View style={st.feeRow}>
            <Text style={[st.feeLabelBold, { color: colors.foreground }]}>Total</Text>
            <Text style={[st.feeTotalValue, { color: colors.primary }]}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom checkout bar */}
      <View style={[st.checkoutBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) }]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
          <Text style={[st.totalAmount, { color: colors.foreground }]}>${total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[st.checkoutBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (!user) { router.push('/(auth)/login'); return; }
            router.push('/checkout');
          }}
          activeOpacity={0.85}
        >
          <Text style={[st.checkoutText, { color: colors.card }]}>Proceed to Checkout</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.card} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 32, gap: 12, backgroundColor: c.background },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: 'center' },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, marginTop: 8 },
  browseBtnText: { fontSize: 15, fontWeight: '700' },
  storeBar: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14,
    marginBottom: 12, borderWidth: 1, gap: 12,
  },
  storeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  storeIconText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  storeName: { fontSize: 15, fontWeight: '700' },
  storeItems: { fontSize: 12, marginTop: 2 },
  itemsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  itemImg: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemCut: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  itemPrice: { fontSize: 13 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 15, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  sectionCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 12, marginBottom: 12 },
  tipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tipText: { fontSize: 13, fontWeight: '700' },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  feeCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  feeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel: { fontSize: 14 },
  feeValue: { fontSize: 14, fontWeight: '600' },
  feeDivider: { height: 1, marginVertical: 4 },
  feeLabelBold: { fontSize: 15, fontWeight: '800' },
  feeTotalValue: { fontSize: 18, fontWeight: '800' },
  checkoutBar: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderTopWidth: 1, gap: 16,
  },
  totalLabel: { fontSize: 12 },
  totalAmount: { fontSize: 18, fontWeight: '800' },
  checkoutBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, height: 52, gap: 8,
  },
  checkoutText: { fontSize: 16, fontWeight: '700' },
});
