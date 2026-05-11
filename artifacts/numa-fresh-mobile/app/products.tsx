import { ComponentProps, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { ProductDetailSheet } from '@/components/ProductDetailSheet';
import type { Product } from '@/lib/types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const CATEGORIES: Array<{ id: string; label: string; icon: IoniconName }> = [
  { id: '', label: 'All', icon: 'grid-outline' },
  { id: 'FRESH_MEAT', label: 'Meat', icon: 'nutrition-outline' },
  { id: 'PRODUCE', label: 'Produce', icon: 'leaf-outline' },
  { id: 'SPICES', label: 'Spices', icon: 'flame-outline' },
  { id: 'DAIRY', label: 'Dairy', icon: 'water-outline' },
  { id: 'PACKAGED', label: 'Packaged', icon: 'cube-outline' },
  { id: 'BAKERY', label: 'Bakery', icon: 'restaurant-outline' },
  { id: 'FROZEN', label: 'Frozen', icon: 'snow-outline' },
  { id: 'BEVERAGES', label: 'Drinks', icon: 'wine-outline' },
];

const PAGE_SIZE = 20;

function ProductCard({ product, onPress }: { product: Product; onPress: (p: Product) => void }) {
  const colors = useColors();
  const [imgError, setImgError] = useState(false);
  const img = product.images?.[0];
  const isAvailable = product.isAvailable !== false && product.isActive !== false;

  return (
    <TouchableOpacity
      style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress(product)}
      activeOpacity={0.88}
    >
      <View style={[st.imgBox, { backgroundColor: colors.muted }]}>
        {img && !imgError ? (
          <Image source={{ uri: img }} style={st.img} resizeMode="cover" onError={() => setImgError(true)} />
        ) : (
          <View style={[st.imgPlaceholder, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="leaf-outline" size={24} color={colors.primary} />
          </View>
        )}
        {!isAvailable && (
          <View style={st.unavailableOverlay}>
            <Text style={st.unavailableText}>Out of Stock</Text>
          </View>
        )}
        {product.isFreshMeat && (
          <View style={[st.badge, { backgroundColor: '#E53935' }]}>
            <Text style={st.badgeText}>FRESH</Text>
          </View>
        )}
      </View>
      <View style={st.info}>
        <Text style={[st.name, { color: colors.foreground }]} numberOfLines={2}>{product.name}</Text>
        <Text style={[st.category, { color: colors.mutedForeground }]}>{product.category?.replace(/_/g, ' ')}</Text>
        <Text style={[st.price, { color: colors.primary }]}>
          ${product.price.toFixed(2)}{product.isFreshMeat ? '/kg' : ''}
        </Text>
        {product.store && (
          <Text style={[st.storeName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {product.store.name}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden', margin: 6 },
  imgBox: { height: 120, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  unavailableOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  unavailableText: { fontSize: 11, fontWeight: '700', color: '#666' },
  badge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  info: { padding: 10 },
  name: { fontSize: 13, fontWeight: '600', marginBottom: 2, lineHeight: 18 },
  category: { fontSize: 11, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  shopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 7, gap: 4,
  },
  storeName: { fontSize: 11, marginTop: 2 },
});

export default function ProductsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; search?: string }>();

  const [search, setSearch] = useState(params.search ?? '');
  const [selectedCategory, setSelectedCategory] = useState(params.category ?? '');
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', search, selectedCategory, page],
    queryFn: () =>
      api.get<{ products: Product[]; total: number; totalPages: number }>(
        '/products',
        {
          ...(search ? { search } : {}),
          ...(selectedCategory ? { category: selectedCategory } : {}),
          page,
          limit: PAGE_SIZE,
        },
      ),
    placeholderData: (prev) => prev,
  });

  const products = data?.products ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    setPage(1);
  }, []);

  const handleCategory = useCallback((catId: string) => {
    setSelectedCategory(catId);
    setPage(1);
  }, []);

  const s = screenStyles(colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search bar */}
      <View style={[s.searchWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[s.searchBox, { backgroundColor: colors.card }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            placeholder="Search products..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter */}
      <FlatList
        data={CATEGORIES}
        horizontal
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catRow}
        renderItem={({ item: cat }) => {
          const active = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              onPress={() => handleCategory(cat.id)}
              style={[s.catChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
            >
              <Ionicons name={cat.icon} size={14} color={active ? colors.card : colors.mutedForeground} />
              <Text style={[s.catLabel, { color: active ? colors.card : colors.foreground }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        }}
        style={[s.catList, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
      />

      {/* Result count */}
      {!isLoading && (
        <View style={s.resultRow}>
          <Text style={[s.resultText, { color: colors.mutedForeground }]}>
            {total} {total === 1 ? 'product' : 'products'}
            {selectedCategory ? ` in ${selectedCategory.replace(/_/g, ' ')}` : ''}
            {search ? ` for "${search}"` : ''}
          </Text>
          {isFetching && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
        </View>
      )}

      {/* Product grid */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : products.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No products found</Text>
          <Text style={[s.emptySub, { color: colors.mutedForeground }]}>
            {search ? 'Try a different search term' : 'Try selecting a different category'}
          </Text>
          {(search || selectedCategory) && (
            <TouchableOpacity
              style={[s.clearBtn, { backgroundColor: colors.primary }]}
              onPress={() => { handleSearch(''); handleCategory(''); }}
            >
              <Text style={[s.clearBtnText, { color: colors.card }]}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 10, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) => <ProductCard product={item} onPress={setSelectedProduct} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <View style={[s.pagination, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 16 : 0) }]}>
          <TouchableOpacity
            style={[s.pageBtn, { borderColor: colors.border, opacity: page <= 1 ? 0.4 : 1 }]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.pageInfo, { color: colors.foreground }]}>Page {page} of {totalPages}</Text>
          <TouchableOpacity
            style={[s.pageBtn, { borderColor: colors.border, opacity: page >= totalPages ? 0.4 : 1 }]}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const screenStyles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    paddingHorizontal: 12, height: 44, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  catList: { borderBottomWidth: 1, maxHeight: 56 },
  catRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  catLabel: { fontSize: 12, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  resultText: { fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  clearBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  clearBtnText: { fontSize: 14, fontWeight: '700' },
  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1,
  },
  pageBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pageInfo: { fontSize: 14, fontWeight: '600' },
});
