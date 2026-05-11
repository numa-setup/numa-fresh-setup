import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  Image, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import type { Store } from '@/lib/types';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pickup', label: 'Pickup' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'halal', label: 'Halal Cert.' },
  { id: 'rating4', label: '4★+' },
  { id: 'rating45', label: '4.5★+' },
];

function StoreListItem({ store }: { store: Store }) {
  const colors = useColors();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const img = store.cardImage || store.banner || store.logo;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/store/${store.slug}`)}
      style={[s.item, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.88}
    >
      <View style={[s.itemImg, { backgroundColor: colors.muted }]}>
        {img && !imgError ? (
          <Image source={{ uri: img }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} onError={() => setImgError(true)} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryPale }}>
            <Ionicons name="storefront" size={24} color={colors.primary} />
          </View>
        )}
      </View>
      <View style={s.itemInfo}>
        <Text style={[s.itemName, { color: colors.foreground }]} numberOfLines={1}>{store.name}</Text>
        <Text style={[s.itemCity, { color: colors.mutedForeground }]} numberOfLines={1}>{store.address ? `${store.address}, ` : ''}{store.city}</Text>
        <View style={s.itemMeta}>
          {store.rating != null && (
            <View style={s.ratingRow}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={[s.metaText, { color: colors.mutedForeground }]}>{store.rating.toFixed(1)}</Text>
            </View>
          )}
          {store.pickupAvailable && (
            <View style={[s.chip, { backgroundColor: colors.primaryPale }]}>
              <Text style={[s.chipText, { color: colors.primaryDark }]}>Pickup</Text>
            </View>
          )}
          {store.deliveryAvailable && (
            <View style={[s.chip, { backgroundColor: colors.primaryPale }]}>
              <Text style={[s.chipText, { color: colors.primaryDark }]}>Delivery</Text>
            </View>
          )}
          {store.isHalalCertified && (
            <View style={[s.chip, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[s.chipText, { color: '#065F46' }]}>Halal ✓</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1,
    marginHorizontal: 16, marginBottom: 10, overflow: 'hidden',
  },
  itemImg: { width: 80, height: 80 },
  itemInfo: { flex: 1, padding: 12 },
  itemName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  itemCity: { fontSize: 12, marginBottom: 6 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '600' },
});

function applyClientFilters(stores: Store[], activeFilter: string): Store[] {
  switch (activeFilter) {
    case 'pickup':
      return stores.filter((s) => s.pickupAvailable);
    case 'delivery':
      return stores.filter((s) => s.deliveryAvailable);
    case 'halal':
      return stores.filter((s) => s.isHalalCertified);
    case 'rating4':
      return stores.filter((s) => (s.rating ?? 0) >= 4);
    case 'rating45':
      return stores.filter((s) => (s.rating ?? 0) >= 4.5);
    default:
      return stores;
  }
}

export default function StoresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ search?: string; category?: string }>();
  const [search, setSearch] = useState(params.search || '');
  const [inputValue, setInputValue] = useState(params.search || '');
  const [activeFilter, setActiveFilter] = useState('all');

  const queryParams: Record<string, string> = { limit: '200' };
  if (search) queryParams.search = search;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stores', search],
    queryFn: () => api.get<{ stores: Store[]; total: number }>('/stores', queryParams),
  });

  const allStores = data?.stores || [];
  const stores = applyClientFilters(allStores, activeFilter);

  const st = styles(colors);

  return (
    <View style={[st.container]}>
      {/* Search */}
      <View style={[st.searchRow, { paddingTop: Platform.OS === 'web' ? insets.top + 20 : 12 }]}>
        <View style={[st.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[st.searchInput, { color: colors.foreground }]}
            placeholder="Search stores..."
            placeholderTextColor={colors.mutedForeground}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={() => setSearch(inputValue)}
            returnKeyType="search"
          />
          {inputValue.length > 0 && (
            <TouchableOpacity onPress={() => { setInputValue(''); setSearch(''); }}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={st.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setActiveFilter(f.id)}
            style={[st.filterChip, activeFilter === f.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={[st.filterText, { color: activeFilter === f.id ? colors.card : colors.foreground }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Count */}
      {!isLoading && (
        <Text style={[st.countText, { color: colors.mutedForeground }]}>
          {stores.length} store{stores.length !== 1 ? 's' : ''} found
        </Text>
      )}

      {isLoading ? (
        <View style={st.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : stores.length === 0 ? (
        <View style={st.empty}>
          <Ionicons name="storefront-outline" size={48} color={colors.mutedForeground} />
          <Text style={[st.emptyTitle, { color: colors.foreground }]}>No Stores Found</Text>
          <Text style={[st.emptySub, { color: colors.mutedForeground }]}>Try adjusting your search or filters.</Text>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <StoreListItem store={item} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    paddingHorizontal: 14, height: 48, gap: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '600' },
  countText: { fontSize: 13, paddingHorizontal: 20, marginBottom: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
