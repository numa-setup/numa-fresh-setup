import { ComponentProps, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, Platform, Dimensions, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import type { Store, Product } from '@/lib/types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
const { width } = Dimensions.get('window');

function MeatCustomizer({ product, onClose, storeId, storeSlug, storeName }: {
  product: Product; onClose: () => void;
  storeId: string; storeSlug: string; storeName: string;
}) {
  const colors = useColors();
  const { addItem, setStoreInfo, promptStoreSwitchAndAdd } = useCart();
  const [selectedCut, setSelectedCut] = useState('');
  const [instructions, setInstructions] = useState('');
  const [weightKg, setWeightKg] = useState(1);
  const cuts = product.availableCuts || ['Bone-in', 'Boneless', 'Ground', 'Cubed', 'Whole'];

  const handleAdd = () => {
    const options = { selectedCut, cutInstructions: instructions, weightKg };
    const added = addItem(product, 1, options);
    if (!added) {
      promptStoreSwitchAndAdd(product, storeId, storeSlug, storeName, 1, options);
      onClose();
      return;
    }
    setStoreInfo(storeId, storeSlug, storeName);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <View style={[mc.container, { backgroundColor: colors.card }]}>
      <View style={[mc.handle, { backgroundColor: colors.border }]} />
      <Text style={[mc.title, { color: colors.foreground }]}>Customize Your Cut</Text>
      <Text style={[mc.subtitle, { color: colors.mutedForeground }]}>{product.name}</Text>

      <Text style={[mc.sectionLabel, { color: colors.foreground }]}>Cut</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mc.cutsRow}>
        {cuts.map((cut) => (
          <TouchableOpacity
            key={cut}
            onPress={() => setSelectedCut(cut)}
            style={[mc.cutChip, { borderColor: selectedCut === cut ? colors.primary : colors.border, backgroundColor: selectedCut === cut ? colors.primaryPale : colors.muted }]}
          >
            <Text style={[mc.cutText, { color: selectedCut === cut ? colors.primary : colors.foreground }]}>{cut}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[mc.sectionLabel, { color: colors.foreground }]}>Weight (kg)</Text>
      <View style={mc.weightRow}>
        <TouchableOpacity onPress={() => setWeightKg(Math.max(0.5, weightKg - 0.5))} style={[mc.weightBtn, { backgroundColor: colors.muted }]}>
          <Ionicons name="remove" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[mc.weightText, { color: colors.foreground }]}>{weightKg.toFixed(1)} kg</Text>
        <TouchableOpacity onPress={() => setWeightKg(weightKg + 0.5)} style={[mc.weightBtn, { backgroundColor: colors.muted }]}>
          <Ionicons name="add" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <Text style={[mc.sectionLabel, { color: colors.foreground }]}>Special Instructions</Text>
      <TextInput
        style={[mc.instructionsInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        placeholder="e.g. Remove skin, extra lean..."
        placeholderTextColor={colors.mutedForeground}
        value={instructions}
        onChangeText={setInstructions}
        multiline
        numberOfLines={2}
      />

      <View style={mc.total}>
        <Text style={[mc.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
        <Text style={[mc.totalAmount, { color: colors.primary }]}>${(product.price * weightKg).toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={[mc.addBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}>
        <Ionicons name="cart-outline" size={20} color={colors.card} />
        <Text style={[mc.addBtnText, { color: colors.card }]}>Add to Cart</Text>
      </TouchableOpacity>
    </View>
  );
}

const mc = StyleSheet.create({
  container: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  cutsRow: { marginBottom: 16 },
  cutChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  cutText: { fontSize: 13, fontWeight: '600' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  weightBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  weightText: { fontSize: 18, fontWeight: '800', minWidth: 60, textAlign: 'center' },
  instructionsInput: {
    borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, marginBottom: 16, minHeight: 60,
  },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalLabel: { fontSize: 14 },
  totalAmount: { fontSize: 22, fontWeight: '800' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, height: 52, gap: 10,
  },
  addBtnText: { fontSize: 16, fontWeight: '700' },
});

function ProductCard({ product, storeId, storeSlug, storeName, onMeatPress }: {
  product: Product; storeId: string; storeSlug: string; storeName: string;
  onMeatPress: (p: Product) => void;
}) {
  const colors = useColors();
  const { addItem, updateQuantity, items, setStoreInfo, promptStoreSwitchAndAdd } = useCart();
  const [imgError, setImgError] = useState(false);
  const qty = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
  const img = product.images?.[0];
  const isAvailable = product.isAvailable !== false && product.isActive !== false;

  const handleAdd = () => {
    if (product.isFreshMeat) { onMeatPress(product); return; }
    const added = addItem(product, 1);
    if (!added) {
      promptStoreSwitchAndAdd(product, storeId, storeSlug, storeName, 1);
      return;
    }
    setStoreInfo(storeId, storeSlug, storeName);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addMoreIcon: IoniconName = product.isFreshMeat ? 'cut-outline' : 'add';

  return (
    <View style={[pc.card, { backgroundColor: colors.card, borderColor: qty > 0 ? colors.primary : colors.border }]}>
      <View style={[pc.imgBox, { backgroundColor: colors.muted }]}>
        {img && !imgError ? (
          <Image source={{ uri: img }} style={pc.img} resizeMode="cover" onError={() => setImgError(true)} />
        ) : (
          <View style={[pc.imgPlaceholder, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="leaf" size={22} color={colors.primary} />
          </View>
        )}
        {!isAvailable && (
          <View style={pc.unavailableOverlay}>
            <Text style={pc.unavailableText}>Out of Stock</Text>
          </View>
        )}
        {product.isFreshMeat && (
          <View style={[pc.freshBadge, { backgroundColor: '#E53935' }]}>
            <Text style={pc.freshText}>FRESH</Text>
          </View>
        )}
      </View>
      <View style={pc.info}>
        <Text style={[pc.name, { color: colors.foreground }]} numberOfLines={2}>{product.name}</Text>
        <Text style={[pc.price, { color: colors.primary }]}>
          ${product.price.toFixed(2)}{product.isFreshMeat ? '/kg' : ''}
        </Text>
        {qty === 0 ? (
          <TouchableOpacity
            style={[pc.addBtn, { backgroundColor: isAvailable ? colors.primary : colors.muted }]}
            onPress={handleAdd}
            disabled={!isAvailable}
          >
            <Ionicons name={addMoreIcon} size={18} color={isAvailable ? colors.card : colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <View style={[pc.qtyRow, { backgroundColor: colors.primary }]}>
            <TouchableOpacity onPress={() => updateQuantity(product.id, qty - 1)} style={pc.qtyBtn}>
              <Ionicons name="remove" size={14} color={colors.card} />
            </TouchableOpacity>
            <Text style={[pc.qtyText, { color: colors.card }]}>{qty}</Text>
            <TouchableOpacity onPress={() => handleAdd()} style={pc.qtyBtn}>
              <Ionicons name="add" size={14} color={colors.card} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: { width: (width - 48) / 2, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  imgBox: { height: 110, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  unavailableOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  unavailableText: { fontSize: 12, fontWeight: '700', color: '#666' },
  freshBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  freshText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  info: { padding: 10 },
  name: { fontSize: 13, fontWeight: '600', marginBottom: 4, lineHeight: 18 },
  price: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, overflow: 'hidden', alignSelf: 'flex-end' },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 13, fontWeight: '800', minWidth: 20, textAlign: 'center' },
});

export default function StoreDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [bannerError, setBannerError] = useState(false);
  const [meatProduct, setMeatProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState('');

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store', slug],
    queryFn: () => api.get<Store>(`/stores/${slug}`),
    enabled: !!slug,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['store-products', slug],
    queryFn: () => api.get<{ products: Product[] }>(`/stores/${slug}/products?limit=100`),
    enabled: !!slug,
  });
  const products = productsData?.products || [];

  const categories = [...new Set(products.map((p) => p.category))];
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const st = styles(colors);

  if (storeLoading) {
    return (
      <View style={[st.loadingContainer, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Loading store...</Text>
      </View>
    );
  }

  if (!store) {
    return (
      <View style={[st.loadingContainer, { paddingTop: insets.top + 60 }]}>
        <Ionicons name="storefront-outline" size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', marginTop: 12 }}>Store not found</Text>
      </View>
    );
  }

  const bannerImg = store.banner || store.cardImage;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[st.bannerContainer, { paddingTop: insets.top }]}>
        {bannerImg && !bannerError ? (
          <Image source={{ uri: bannerImg }} style={st.bannerImg} resizeMode="cover" onError={() => setBannerError(true)} />
        ) : (
          <View style={[st.bannerImg, { backgroundColor: colors.primaryDarker }]} />
        )}
        <View style={st.bannerOverlay} />
        <TouchableOpacity style={[st.backBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={st.bannerInfo}>
          <Text style={st.bannerName}>{store.name}</Text>
          <Text style={st.bannerCity}>{store.city}{store.province ? `, ${store.province}` : ''}</Text>
          {store.rating != null && (
            <View style={st.ratingRow}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={st.ratingText}>{store.rating.toFixed(1)}</Text>
              {store.totalRatings != null && <Text style={st.ratingCount}>({store.totalRatings})</Text>}
            </View>
          )}
        </View>
      </View>

      <View style={[st.infoRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {store.avgPrepTimeMinutes != null && (
          <View style={st.chip}>
            <Ionicons name="time-outline" size={13} color={colors.primary} />
            <Text style={[st.chipText, { color: colors.primary }]}>~{store.avgPrepTimeMinutes}m</Text>
          </View>
        )}
        {store.pickupAvailable && (
          <View style={[st.chip, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="bag-outline" size={13} color={colors.primaryDark} />
            <Text style={[st.chipText, { color: colors.primaryDark }]}>Pickup</Text>
          </View>
        )}
        {store.deliveryAvailable && (
          <View style={[st.chip, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="bicycle-outline" size={13} color={colors.primaryDark} />
            <Text style={[st.chipText, { color: colors.primaryDark }]}>Delivery</Text>
          </View>
        )}
        {store.isHalalCertified && (
          <View style={[st.chip, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.primaryDark} />
            <Text style={[st.chipText, { color: colors.primaryDark }]}>Halal Certified</Text>
          </View>
        )}
      </View>

      {categories.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={[st.catScroll, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
          contentContainerStyle={st.catScrollContent}
        >
          <TouchableOpacity
            onPress={() => setActiveCategory('')}
            style={[st.catChip, !activeCategory && { backgroundColor: colors.primary }]}
          >
            <Text style={[st.catText, { color: !activeCategory ? colors.card : colors.foreground }]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat === activeCategory ? '' : cat)}
              style={[st.catChip, activeCategory === cat && { backgroundColor: colors.primary }]}
            >
              <Text style={[st.catText, { color: activeCategory === cat ? colors.card : colors.foreground }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {productsLoading ? (
        <View style={st.loading}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}>
          {Object.entries(grouped)
            .filter(([cat]) => !activeCategory || cat === activeCategory)
            .map(([cat, prods]) => (
              <View key={cat} style={{ marginBottom: 24 }}>
                <Text style={[st.catSectionTitle, { color: colors.foreground }]}>{cat}</Text>
                <View style={st.productsGrid}>
                  {prods.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      storeId={store.id}
                      storeSlug={store.slug}
                      storeName={store.name}
                      onMeatPress={setMeatProduct}
                    />
                  ))}
                </View>
              </View>
            ))}
        </ScrollView>
      )}

      <Modal visible={!!meatProduct} animationType="slide" transparent presentationStyle="overFullScreen">
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={() => setMeatProduct(null)} />
        {meatProduct && (
          <View style={[st.modalContent, { backgroundColor: colors.card }]}>
            <MeatCustomizer
              product={meatProduct}
              storeId={store.id}
              storeSlug={store.slug}
              storeName={store.name}
              onClose={() => setMeatProduct(null)}
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', backgroundColor: c.background },
  bannerContainer: { height: 200, position: 'relative' },
  bannerImg: { width: '100%', height: '100%', position: 'absolute' },
  bannerOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  backBtn: { position: 'absolute', top: 0, left: 16, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bannerInfo: { position: 'absolute', bottom: 16, left: 16 },
  bannerName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  bannerCity: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  ratingCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderBottomWidth: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600' },
  catScroll: { borderBottomWidth: 1, maxHeight: 52 },
  catScrollContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.06)' },
  catText: { fontSize: 13, fontWeight: '600' },
  catSectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
