import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useCart } from '@/contexts/CartContext';
import type { Product } from '@/lib/types';

interface Props {
  product: Product | null;
  onClose: () => void;
}

export function ProductDetailSheet({ product, onClose }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { addItem, setStoreInfo, promptStoreSwitchAndAdd, items } = useCart();
  const [selectedCut, setSelectedCut] = useState('');
  const [weightKg, setWeightKg] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [imgError, setImgError] = useState(false);

  if (!product) return null;

  const qty = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
  const isAvailable = product.isAvailable !== false && product.isActive !== false;
  const img = product.images?.[0];
  const storeSlug = product.store?.slug ?? product.storeSlug;
  const storeId = product.storeId;
  const storeName = product.store?.name ?? 'Store';
  const cuts = product.availableCuts?.length ? product.availableCuts : ['Bone-in', 'Boneless', 'Ground', 'Cubed'];
  const displayPrice = product.isFreshMeat
    ? (product.price * weightKg).toFixed(2)
    : product.price.toFixed(2);

  const handleAddToCart = () => {
    if (!isAvailable) return;
    const options = product.isFreshMeat
      ? { selectedCut, cutInstructions: instructions, weightKg }
      : undefined;
    const added = addItem(product, 1, options);
    if (added) {
      if (storeSlug) setStoreInfo(storeId, storeSlug, storeName);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } else if (storeSlug) {
      promptStoreSwitchAndAdd(product, storeId, storeSlug, storeName, 1, options);
      onClose();
    }
  };

  const handleViewStore = () => {
    onClose();
    if (storeSlug) router.push(`/store/${storeSlug}`);
  };

  const s = styles(colors);

  return (
    <Modal visible animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.card }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />

        <View style={[s.imgBox, { backgroundColor: colors.muted }]}>
          {img && !imgError ? (
            <Image source={{ uri: img }} style={s.img} resizeMode="cover" onError={() => setImgError(true)} />
          ) : (
            <View style={[s.imgPlaceholder, { backgroundColor: colors.primaryPale }]}>
              <Ionicons name="leaf" size={40} color={colors.primary} />
            </View>
          )}
          {product.isFreshMeat && (
            <View style={[s.freshBadge, { backgroundColor: '#E53935' }]}>
              <Text style={s.freshText}>FRESH MEAT</Text>
            </View>
          )}
          {!isAvailable && (
            <View style={s.outOverlay}>
              <Text style={s.outText}>Out of Stock</Text>
            </View>
          )}
        </View>

        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 20, paddingTop: 14 }}>
          <Text style={[s.name, { color: colors.foreground }]}>{product.name}</Text>

          {product.store && (
            <TouchableOpacity onPress={handleViewStore} style={s.storeRow}>
              <Ionicons name="storefront-outline" size={13} color={colors.primary} />
              <Text style={[s.storeName, { color: colors.primary }]}>{product.store.name}</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.primary} />
            </TouchableOpacity>
          )}

          <View style={s.priceRow}>
            <Text style={[s.price, { color: colors.primary }]}>
              ${displayPrice}
              {product.isFreshMeat ? ` (${product.price.toFixed(2)}/kg)` : ''}
            </Text>
            {product.category ? (
              <View style={[s.catBadge, { backgroundColor: colors.primaryPale }]}>
                <Text style={[s.catBadgeText, { color: colors.primary }]}>
                  {product.category.replace(/_/g, ' ')}
                </Text>
              </View>
            ) : null}
          </View>

          {product.description ? (
            <Text style={[s.desc, { color: colors.mutedForeground }]}>{product.description}</Text>
          ) : null}

          {product.isFreshMeat && (
            <>
              <Text style={[s.sectionLabel, { color: colors.foreground }]}>Cut</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.cutsRow}>
                {cuts.map((cut) => (
                  <TouchableOpacity
                    key={cut}
                    onPress={() => setSelectedCut(cut)}
                    style={[s.cutChip, {
                      borderColor: selectedCut === cut ? colors.primary : colors.border,
                      backgroundColor: selectedCut === cut ? colors.primaryPale : colors.muted,
                    }]}
                  >
                    <Text style={[s.cutText, { color: selectedCut === cut ? colors.primary : colors.foreground }]}>{cut}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[s.sectionLabel, { color: colors.foreground }]}>Weight (kg)</Text>
              <View style={s.weightRow}>
                <TouchableOpacity
                  onPress={() => setWeightKg(Math.max(0.5, weightKg - 0.5))}
                  style={[s.weightBtn, { backgroundColor: colors.muted }]}
                >
                  <Ionicons name="remove" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[s.weightText, { color: colors.foreground }]}>{weightKg.toFixed(1)} kg</Text>
                <TouchableOpacity
                  onPress={() => setWeightKg(weightKg + 0.5)}
                  style={[s.weightBtn, { backgroundColor: colors.muted }]}
                >
                  <Ionicons name="add" size={20} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[s.instructionsInput, {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: colors.border,
                }]}
                placeholder="Special instructions (optional)..."
                placeholderTextColor={colors.mutedForeground}
                value={instructions}
                onChangeText={setInstructions}
                multiline
              />
            </>
          )}
        </ScrollView>

        <View style={[s.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[s.viewStoreBtn, { borderColor: colors.border }]}
            onPress={handleViewStore}
          >
            <Ionicons name="storefront-outline" size={18} color={colors.foreground} />
            <Text style={[s.viewStoreBtnText, { color: colors.foreground }]}>View Store</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.addBtn, {
              backgroundColor: isAvailable ? colors.primary : colors.muted,
              flex: 1,
            }]}
            onPress={handleAddToCart}
            disabled={!isAvailable}
          >
            {qty > 0 ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color={colors.card} />
                <Text style={[s.addBtnText, { color: colors.card }]}>In Cart ({qty})</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="cart-outline"
                  size={18}
                  color={isAvailable ? colors.card : colors.mutedForeground}
                />
                <Text style={[s.addBtnText, { color: isAvailable ? colors.card : colors.mutedForeground }]}>
                  {isAvailable ? 'Add to Cart' : 'Out of Stock'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  imgBox: { height: 200, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  freshBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  freshText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  outOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  outText: { fontSize: 14, fontWeight: '800', color: '#666' },
  name: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  storeName: { fontSize: 13, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  price: { fontSize: 22, fontWeight: '800' },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  cutsRow: { marginBottom: 12 },
  cutChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  cutText: { fontSize: 13, fontWeight: '600' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  weightBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  weightText: { fontSize: 18, fontWeight: '800', minWidth: 60, textAlign: 'center' },
  instructionsInput: {
    borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 60,
  },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  viewStoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, height: 50,
  },
  viewStoreBtnText: { fontSize: 14, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, height: 50, gap: 8,
  },
  addBtnText: { fontSize: 15, fontWeight: '700' },
});
