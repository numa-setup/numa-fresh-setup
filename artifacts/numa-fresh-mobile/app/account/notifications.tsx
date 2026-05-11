import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';

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

const SECTIONS = [
  {
    title: 'Email',
    items: [
      { key: 'emailOrderUpdates', label: 'Order Updates', desc: 'Order confirmations and status changes' },
      { key: 'emailPromotions', label: 'Promotions', desc: 'Deals, discounts, and new stores' },
    ],
  },
  {
    title: 'Push Notifications',
    items: [
      { key: 'pushOrderUpdates', label: 'Order Updates', desc: 'Real-time status notifications' },
      { key: 'pushPromotions', label: 'Promotions', desc: 'Limited offers and deals' },
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
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) {
        try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) }); } catch {}
      }
    });
  }, []);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const s = styles(colors);

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
      {SECTIONS.map((section) => (
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
        Preferences are saved locally on this device.
      </Text>
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  itemLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  itemDesc: { fontSize: 12 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
