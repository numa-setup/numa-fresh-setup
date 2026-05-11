import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import type { LoyaltyTransaction } from '@/lib/types';

const TIERS = [
  { name: 'Bronze', minPoints: 0, color: '#CD7F32' },
  { name: 'Silver', minPoints: 500, color: '#C0C0C0' },
  { name: 'Gold', minPoints: 1500, color: '#FFD700' },
  { name: 'Platinum', minPoints: 5000, color: '#E5E4E2' },
];

function getTier(points: number) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (points >= t.minPoints) tier = t;
  }
  return tier;
}

export default function LoyaltyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get<{ points: number; pointsValue: number; tier: string; nextTierPoints: number; transactions: LoyaltyTransaction[] }>('/users/loyalty'),
  });

  const s = styles(colors);

  if (isLoading) {
    return <View style={s.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const points = data?.points || 0;
  const tier = getTier(points);
  const nextTier = TIERS.find((t) => t.minPoints > points);
  const progress = nextTier ? Math.min(1, (points - tier.minPoints) / (nextTier.minPoints - tier.minPoints)) : 1;
  const transactions = data?.transactions || [];

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      {/* Points card */}
      <View style={[s.pointsCard, { backgroundColor: colors.primaryDarker }]}>
        <View style={[s.tierBadge, { backgroundColor: tier.color }]}>
          <Text style={s.tierBadgeText}>{tier.name}</Text>
        </View>
        <Text style={s.pointsAmount}>{points.toLocaleString()}</Text>
        <Text style={s.pointsLabel}>Loyalty Points</Text>
        {data?.pointsValue != null && (
          <Text style={s.pointsValue}>${data.pointsValue.toFixed(2)} value</Text>
        )}

        {/* Progress bar */}
        {nextTier && (
          <View style={s.progressSection}>
            <View style={[s.progressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.gold }]} />
            </View>
            <Text style={s.progressText}>
              {nextTier.minPoints - points} pts to {nextTier.name}
            </Text>
          </View>
        )}
      </View>

      {/* Tier benefits */}
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Tier Benefits</Text>
        {TIERS.map((t) => (
          <View key={t.name} style={[s.tierRow, { backgroundColor: colors.card, borderColor: tier.name === t.name ? colors.primary : colors.border }]}>
            <View style={[s.tierDot, { backgroundColor: t.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.tierName, { color: colors.foreground }]}>{t.name}</Text>
              <Text style={[s.tierMin, { color: colors.mutedForeground }]}>{t.minPoints.toLocaleString()}+ points</Text>
            </View>
            {tier.name === t.name && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
          </View>
        ))}
      </View>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <View style={[s.section, { paddingHorizontal: 16 }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>History</Text>
          {transactions.map((tx) => (
            <View key={tx.id} style={[s.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.txIcon, { backgroundColor: tx.type === 'EARN' ? colors.primaryPale : '#FEE2E2' }]}>
                <Ionicons
                  name={tx.type === 'EARN' ? 'add-circle-outline' : 'remove-circle-outline'}
                  size={20}
                  color={tx.type === 'EARN' ? colors.primary : colors.destructive}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.txDesc, { color: colors.foreground }]}>{tx.description}</Text>
                <Text style={[s.txDate, { color: colors.mutedForeground }]}>
                  {new Date(tx.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[s.txPoints, { color: tx.type === 'EARN' ? colors.primary : colors.destructive }]}>
                {tx.type === 'EARN' ? '+' : '-'}{tx.points} pts
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  pointsCard: { padding: 32, alignItems: 'center', marginBottom: 8 },
  tierBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  tierBadgeText: { fontSize: 13, fontWeight: '800', color: '#1A1A1A' },
  pointsAmount: { fontSize: 52, fontWeight: '900', color: '#fff' },
  pointsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  pointsValue: { fontSize: 16, color: '#D4AF37', fontWeight: '700', marginBottom: 16 },
  progressSection: { width: '100%', gap: 8 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 12 },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5,
    padding: 14, gap: 12, marginHorizontal: 16, marginBottom: 8,
  },
  tierDot: { width: 16, height: 16, borderRadius: 8 },
  tierName: { fontSize: 15, fontWeight: '700' },
  tierMin: { fontSize: 12, marginTop: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 14, fontWeight: '600' },
  txDate: { fontSize: 12, marginTop: 2 },
  txPoints: { fontSize: 15, fontWeight: '800' },
});
