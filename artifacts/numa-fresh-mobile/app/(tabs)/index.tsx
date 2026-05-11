import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Image, Platform, RefreshControl, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { ProductDetailSheet } from '@/components/ProductDetailSheet';
import type { Store, Product } from '@/lib/types';

const CATEGORIES = [
  { id: 'FRESH_MEAT', label: 'Fresh Meat', icon: '🥩' },
  { id: 'PRODUCE', label: 'Produce', icon: '🥬' },
  { id: 'SPICES', label: 'Spices', icon: '🌶' },
  { id: 'DAIRY', label: 'Dairy', icon: '🥛' },
  { id: 'PACKAGED', label: 'Packaged', icon: '📦' },
  { id: 'BAKERY', label: 'Bakery', icon: '🥖' },
  { id: 'FROZEN', label: 'Frozen', icon: '🧊' },
  { id: 'BEVERAGES', label: 'Beverages', icon: '🥤' },
];

const { width } = Dimensions.get('window');

function StoreCard({ store }: { store: Store }) {
  const colors = useColors();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const img = store.cardImage || store.banner || store.logo;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/store/${store.slug}`)}
      style={[sc.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.88}
    >
      <View style={[sc.imgBox, { backgroundColor: colors.muted }]}>
        {img && !imgError ? (
          <Image source={{ uri: img }} style={sc.img} resizeMode="cover" onError={() => setImgError(true)} />
        ) : (
          <View style={[sc.imgPlaceholder, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="storefront" size={28} color={colors.primary} />
          </View>
        )}
        {store.isHalalCertified && (
          <View style={[sc.halalBadge, { backgroundColor: colors.primaryDarker }]}>
            <Text style={sc.halalText}>Halal</Text>
          </View>
        )}
      </View>
      <View style={sc.info}>
        <Text style={[sc.name, { color: colors.foreground }]} numberOfLines={1}>{store.name}</Text>
        <Text style={[sc.city, { color: colors.mutedForeground }]}>{store.city}</Text>
        <View style={sc.meta}>
          {store.rating != null && (
            <View style={sc.rating}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={[sc.ratingText, { color: colors.mutedForeground }]}>{store.rating.toFixed(1)}</Text>
            </View>
          )}
          {store.avgPrepTimeMinutes != null && (
            <Text style={[sc.metaText, { color: colors.mutedForeground }]}>~{store.avgPrepTimeMinutes}m</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  card: { width: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1, marginRight: 12 },
  imgBox: { height: 110, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  halalBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  halalText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  info: { padding: 10 },
  name: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  city: { fontSize: 12, marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11 },
  metaText: { fontSize: 11 },
});

function ProductRow({ product, onPress }: { product: Product; onPress: (p: Product) => void }) {
  const colors = useColors();
  const [imgError, setImgError] = useState(false);
  const img = product.images?.[0];

  return (
    <TouchableOpacity
      onPress={() => onPress(product)}
      style={[pr.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.88}
    >
      <View style={[pr.imgBox, { backgroundColor: colors.muted }]}>
        {img && !imgError ? (
          <Image source={{ uri: img }} style={pr.img} resizeMode="cover" onError={() => setImgError(true)} />
        ) : (
          <View style={[pr.imgPlaceholder, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="leaf" size={20} color={colors.primary} />
          </View>
        )}
      </View>
      <Text style={[pr.name, { color: colors.foreground }]} numberOfLines={2}>{product.name}</Text>
      <Text style={[pr.price, { color: colors.primary }]}>${product.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );
}

const pr = StyleSheet.create({
  card: { width: 130, borderRadius: 14, overflow: 'hidden', borderWidth: 1, marginRight: 12 },
  imgBox: { height: 90 },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, fontWeight: '600', margin: 8, marginBottom: 2 },
  price: { fontSize: 13, fontWeight: '800', marginHorizontal: 8, marginBottom: 8 },
});

function SkeletonCard({ width: w, height: h, borderRadius: br = 8 }: { width?: number; height: number; borderRadius?: number }) {
  const colors = useColors();
  return <View style={{ width: w, height: h, borderRadius: br, backgroundColor: colors.muted, marginBottom: 6 }} />;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: storesData, isLoading: storesLoading, refetch: refetchStores } = useQuery({
    queryKey: ['stores-featured'],
    queryFn: () => api.get<Store[]>('/stores/featured'),
  });
  const featuredStores = Array.isArray(storesData) ? storesData : [];

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products-featured'],
    queryFn: () => api.get<{ freshMeat?: Product[]; produce?: Product[]; spices?: Product[]; packaged?: Product[]; eidSpecials?: Product[] }>('/products/featured'),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStores(), refetchProducts()]);
    setRefreshing(false);
  };

  const s = styles(colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 20 : 10) }]}>
        <View>
          <Text style={s.greeting}>Numa Fresh</Text>
          <Text style={s.tagline}>Premium Halal Groceries</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/cart')} style={[s.cartIconBtn, { backgroundColor: colors.primaryPale }]}>
          <Ionicons name="cart-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={[s.searchContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            placeholder="Search products or stores..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => {
              if (search.trim()) router.push(`/products?search=${encodeURIComponent(search.trim())}`);
            }}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[s.heroBanner, { backgroundColor: colors.primaryDarker }]}>
          <Text style={s.heroTitle} className="text-white font-bold">Fresh. Halal. Delivered.</Text>
          <Text style={s.heroSub} className="text-white/75">Order from certified stores near you</Text>
          <TouchableOpacity style={[s.heroBtn, { backgroundColor: colors.gold }]} onPress={() => router.push('/stores')}>
            <Text style={[s.heroBtnText, { color: colors.primaryDarker }]} className="font-bold">Browse Stores</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primaryDarker} />
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]} className="font-extrabold">Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[s.catItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/products?category=${cat.id}`)}
                activeOpacity={0.8}
              >
                <Text style={s.catIcon}>{cat.icon}</Text>
                <Text style={[s.catLabel, { color: colors.foreground }]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Featured Stores</Text>
            <TouchableOpacity onPress={() => router.push('/stores')}>
              <Text style={[s.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {storesLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
              {[1, 2, 3].map((k) => (
                <View key={k} style={[sc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[sc.imgBox, { backgroundColor: colors.muted }]} />
                  <View style={{ padding: 10, gap: 6 }}>
                    <SkeletonCard width={100} height={12} />
                    <SkeletonCard width={70} height={10} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : featuredStores.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
              {featuredStores.map((store) => <StoreCard key={store.id} store={store} />)}
            </ScrollView>
          ) : null}
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Fresh Halal Meat</Text>
            <TouchableOpacity onPress={() => router.push('/products?category=FRESH_MEAT')}>
              <Text style={[s.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {productsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
              {[1, 2, 3, 4].map((k) => (
                <View key={k} style={[pr.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[pr.imgBox, { backgroundColor: colors.muted }]} />
                  <View style={{ padding: 8, gap: 6 }}>
                    <SkeletonCard width={80} height={10} />
                    <SkeletonCard width={50} height={12} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : productsData?.freshMeat && productsData.freshMeat.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
              {productsData.freshMeat.map((p) => <ProductRow key={p.id} product={p} onPress={setSelectedProduct} />)}
            </ScrollView>
          ) : null}
        </View>

        {(productsLoading || (productsData?.produce && productsData.produce.length > 0)) && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Fresh Produce</Text>
              <TouchableOpacity onPress={() => router.push('/products?category=PRODUCE')}>
                <Text style={[s.seeAll, { color: colors.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {productsLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                {[1, 2, 3, 4].map((k) => (
                  <View key={k} style={[pr.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[pr.imgBox, { backgroundColor: colors.muted }]} />
                    <View style={{ padding: 8, gap: 6 }}>
                      <SkeletonCard width={80} height={10} />
                      <SkeletonCard width={50} height={12} />
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                {productsData!.produce!.map((p) => <ProductRow key={p.id} product={p} onPress={setSelectedProduct} />)}
              </ScrollView>
            )}
          </View>
        )}

        {(productsLoading || (productsData?.spices && productsData.spices.length > 0)) && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Spices & Seasonings</Text>
              <TouchableOpacity onPress={() => router.push('/products?category=SPICES')}>
                <Text style={[s.seeAll, { color: colors.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {productsLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                {[1, 2, 3, 4].map((k) => (
                  <View key={k} style={[pr.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[pr.imgBox, { backgroundColor: colors.muted }]} />
                    <View style={{ padding: 8, gap: 6 }}>
                      <SkeletonCard width={80} height={10} />
                      <SkeletonCard width={50} height={12} />
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                {productsData!.spices!.map((p) => <ProductRow key={p.id} product={p} onPress={setSelectedProduct} />)}
              </ScrollView>
            )}
          </View>
        )}

        {(productsLoading || (productsData?.packaged && productsData.packaged.length > 0)) && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Packaged Foods</Text>
              <TouchableOpacity onPress={() => router.push('/products?category=PACKAGED')}>
                <Text style={[s.seeAll, { color: colors.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {productsLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                {[1, 2, 3, 4].map((k) => (
                  <View key={k} style={[pr.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[pr.imgBox, { backgroundColor: colors.muted }]} />
                    <View style={{ padding: 8, gap: 6 }}>
                      <SkeletonCard width={80} height={10} />
                      <SkeletonCard width={50} height={12} />
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                {productsData!.packaged!.map((p) => <ProductRow key={p.id} product={p} onPress={setSelectedProduct} />)}
              </ScrollView>
            )}
          </View>
        )}

        {productsData?.eidSpecials && productsData.eidSpecials.length > 0 && (
          <View style={[s.section, { marginBottom: 32 }]}>
            <View style={[s.eidBanner, { backgroundColor: colors.gold }]}>
              <Text style={[s.eidTitle, { color: colors.primaryDarker }]}>Eid Specials</Text>
              <Text style={[s.eidSub, { color: colors.primaryDarker }]}>Exclusive packages for the celebration</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingTop: 12 }}>
              {productsData.eidSpecials.map((p) => <ProductRow key={p.id} product={p} onPress={setSelectedProduct} />)}
            </ScrollView>
          </View>
        )}

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingBottom: 16, backgroundColor: c.background,
  },
  greeting: { fontSize: 26, fontWeight: '800', color: c.foreground },
  tagline: { fontSize: 13, color: c.mutedForeground, marginTop: 2 },
  cartIconBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16,
    borderRadius: 14, paddingHorizontal: 14, height: 48, gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      default: { elevation: 2 },
    }),
  },
  searchInput: { flex: 1, fontSize: 15 },
  heroBanner: {
    marginHorizontal: 20, borderRadius: 20, padding: 24, marginBottom: 8,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 16 },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  heroBtnText: { fontSize: 14, fontWeight: '700' },
  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  catRow: { paddingLeft: 20, paddingRight: 8 },
  catItem: {
    width: 80, alignItems: 'center', paddingVertical: 12, borderRadius: 16,
    borderWidth: 1, marginRight: 10,
  },
  catIcon: { fontSize: 26, marginBottom: 4 },
  catLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  eidBanner: { marginHorizontal: 20, borderRadius: 16, padding: 16 },
  eidTitle: { fontSize: 20, fontWeight: '800' },
  eidSub: { fontSize: 13, marginTop: 4 },
});
