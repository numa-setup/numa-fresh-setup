import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  registerForPushNotificationsAsync,
  savePushTokenToServer,
} from '@/lib/pushNotifications';

const PREFS_KEY = 'numa-fresh-notifications';

interface NotifPrefs {
  emailOrderUpdates: boolean;
  emailPromotions: boolean;
  pushOrderUpdates: boolean;
  pushPromotions: boolean;
  smsOrderUpdates: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  emailOrderUpdates: true,
  emailPromotions: false,
  pushOrderUpdates: true,
  pushPromotions: false,
  smsOrderUpdates: false,
};

const EMAIL_SMS_SECTIONS = [
  {
    title: 'Email',
    items: [
      { key: 'emailOrderUpdates', label: 'Order Updates', desc: 'Order confirmations and status changes' },
      { key: 'emailPromotions', label: 'Promotions', desc: 'Deals, discounts, and new stores' },
    ],
  },
  {
    title: 'SMS',
    items: [
      { key: 'smsOrderUpdates', label: 'Order Updates', desc: 'Text messages for pickup ready' },
    ],
  },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) {
        try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) }); } catch {}
      }
    });

    if (Platform.OS !== 'web') {
      getNotificationPermissionStatus().then(setPermissionStatus);
    }
  }, []);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleEnablePush = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    setIsRegistering(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setPermissionStatus('granted');
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushTokenToServer(token);
        }
      } else {
        setPermissionStatus('denied');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const s = styles(colors);

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
      {Platform.OS !== 'web' && (
        <View style={[s.pushCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.pushCardHeader}>
            <View style={[s.pushIcon, { backgroundColor: colors.primaryPale }]}>
              <Ionicons name="notifications" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.pushTitle, { color: colors.foreground }]}>Push Notifications</Text>
              <Text style={[s.pushDesc, { color: colors.mutedForeground }]}>
                Get real-time alerts when your order is ready for pickup or out for delivery.
              </Text>
            </View>
          </View>

          {permissionStatus === 'granted' ? (
            <View style={[s.pushGranted, { backgroundColor: colors.primaryPale }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={[s.pushGrantedText, { color: colors.primary }]}>Push notifications are enabled</Text>
            </View>
          ) : permissionStatus === 'denied' ? (
            <View style={[s.pushDenied, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
              <Text style={[s.pushDeniedText, { color: '#DC2626' }]}>
                Notifications are blocked. Enable them in your device settings.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.enableBtn, { backgroundColor: colors.primary }]}
              onPress={handleEnablePush}
              disabled={isRegistering}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications-outline" size={18} color="#fff" />
              <Text style={s.enableBtnText}>
                {isRegistering ? 'Enabling…' : 'Enable Push Notifications'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={[s.pushItem, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.itemLabel, { color: colors.foreground }]}>Order Updates</Text>
              <Text style={[s.itemDesc, { color: colors.mutedForeground }]}>Real-time status notifications (ready, out for delivery)</Text>
            </View>
            <Switch
              value={prefs.pushOrderUpdates}
              onValueChange={() => toggle('pushOrderUpdates')}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={prefs.pushOrderUpdates ? colors.card : colors.border}
            />
          </View>
          <View style={[s.pushItem, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.itemLabel, { color: colors.foreground }]}>Promotions</Text>
              <Text style={[s.itemDesc, { color: colors.mutedForeground }]}>Limited offers and deals</Text>
            </View>
            <Switch
              value={prefs.pushPromotions}
              onValueChange={() => toggle('pushPromotions')}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={prefs.pushPromotions ? colors.card : colors.border}
            />
          </View>
        </View>
      )}

      {EMAIL_SMS_SECTIONS.map((section) => (
        <View key={section.title} style={{ marginBottom: 20 }}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>{section.title}</Text>
          <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {section.items.map((item, index) => (
              <View
                key={item.key}
                style={[s.item, index < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[s.itemDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
                </View>
                <Switch
                  value={prefs[item.key as keyof NotifPrefs]}
                  onValueChange={() => toggle(item.key as keyof NotifPrefs)}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={prefs[item.key as keyof NotifPrefs] ? colors.card : colors.border}
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={[s.note, { color: colors.mutedForeground }]}>
        Email and SMS preferences are saved locally on this device.
      </Text>
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  pushCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, gap: 0 },
  pushCardHeader: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  pushIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pushTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  pushDesc: { fontSize: 12, lineHeight: 18 },
  pushGranted: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  pushGrantedText: { fontSize: 13, fontWeight: '600' },
  pushDenied: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  pushDeniedText: { fontSize: 12, fontWeight: '600', flex: 1 },
  enableBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, marginBottom: 4 },
  enableBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pushItem: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  itemLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  itemDesc: { fontSize: 12 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
