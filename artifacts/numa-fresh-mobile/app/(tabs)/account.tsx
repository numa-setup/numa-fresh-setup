import { ComponentProps, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { getNotificationPermissionStatus } from '@/lib/pushNotifications';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface NavItem {
  id: string;
  icon: IoniconName;
  label: string;
  subtitle: string;
  route: Href;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', icon: 'person-outline', label: 'Edit Profile', subtitle: 'Name, email, phone', route: '/account/profile' },
  { id: 'addresses', icon: 'location-outline', label: 'Addresses', subtitle: 'Manage delivery addresses', route: '/account/addresses' },
  { id: 'loyalty', icon: 'diamond-outline', label: 'Loyalty Points', subtitle: 'Points & rewards', route: '/account/loyalty' },
  { id: 'meal-planner', icon: 'restaurant-outline', label: 'AI Meal Planner', subtitle: 'Generate halal meal plans', route: '/account/meal-planner' },
  { id: 'notifications', icon: 'notifications-outline', label: 'Notifications', subtitle: 'Email, push preferences', route: '/account/notifications' },
];

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const [pushPermission, setPushPermission] = useState<string>('granted');

  useEffect(() => {
    if (isAuthenticated && Platform.OS !== 'web') {
      getNotificationPermissionStatus().then(setPushPermission);
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const st = styles(colors);

  if (!isAuthenticated || !user) {
    return (
      <View style={[st.container, { paddingTop: insets.top + (Platform.OS === 'web' ? 20 : 0) }]}>
        <View style={st.authPrompt}>
          <View style={[st.avatarCircle, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="person-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[st.authTitle, { color: colors.foreground }]}>Sign In to Continue</Text>
          <Text style={[st.authSub, { color: colors.mutedForeground }]}>Access your orders, loyalty points, and more.</Text>
          <TouchableOpacity
            style={[st.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={[st.primaryBtnText, { color: colors.card }]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={[st.secondaryLink, { color: colors.primary }]}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[st.container]}
      contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 20 : 10), paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[st.profileCard, { backgroundColor: colors.primary }]}>
        <View style={[st.avatar, { backgroundColor: colors.primaryDarker }]}>
          <Text style={st.avatarText}>
            {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
          </Text>
        </View>
        <View>
          <Text style={st.profileName}>{user.firstName} {user.lastName}</Text>
          <Text style={st.profileEmail}>{user.email}</Text>
          {user.loyaltyPoints != null && (
            <View style={st.pointsRow}>
              <Ionicons name="diamond" size={12} color={colors.gold} />
              <Text style={[st.points, { color: colors.goldLight }]}>{user.loyaltyPoints} pts</Text>
            </View>
          )}
        </View>
      </View>

      {Platform.OS !== 'web' && pushPermission === 'undetermined' && (
        <TouchableOpacity
          style={[st.pushBanner, { backgroundColor: colors.primaryPale, borderColor: colors.primary }]}
          onPress={() => router.push('/account/notifications')}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={[st.pushBannerText, { color: colors.primary }]}>Enable push notifications for order updates</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      <View style={[st.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {NAV_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[st.navItem, index < NAV_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => router.push(item.route)}
            activeOpacity={0.8}
          >
            <View style={[st.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.navLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[st.navSub, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[st.signOutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={[st.signOutText, { color: colors.destructive }]}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[st.version, { color: colors.mutedForeground }]}>Numa Fresh v1.0</Text>
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  authPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 12 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  authTitle: { fontSize: 22, fontWeight: '800' },
  authSub: { fontSize: 14, textAlign: 'center' },
  primaryBtn: { width: '100%', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  secondaryLink: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  profileCard: {
    marginHorizontal: 16, borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  points: { fontSize: 12, fontWeight: '600' },
  section: {
    marginHorizontal: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 16,
  },
  navItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  navIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 15, fontWeight: '700' },
  navSub: { fontSize: 12, marginTop: 1 },
  signOutBtn: {
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 52, marginBottom: 16,
  },
  signOutText: { fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, marginBottom: 8 },
  pushBanner: {
    marginHorizontal: 16, marginBottom: 16, borderRadius: 14, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  pushBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
});
