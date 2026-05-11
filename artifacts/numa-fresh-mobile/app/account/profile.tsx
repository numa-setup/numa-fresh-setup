import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const updateProfile = useMutation<typeof user, { response?: { data?: { message?: string } }; message?: string }>({
    mutationFn: () => api.patch('/users/profile', { firstName, lastName, phone }),
    onSuccess: (data) => {
      if (data) updateUser(data);
      Alert.alert('Success', 'Profile updated successfully.');
    },
    onError: (err) => {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Could not update profile.');
    },
  });

  const s = styles(colors);

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: insets.bottom + 40 }}>
      <View style={[s.avatar, { backgroundColor: colors.primary }]}>
        <Text style={s.avatarText}>{(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}</Text>
      </View>

      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.field}>
          <Text style={[s.label, { color: colors.foreground }]}>First Name</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <View style={s.field}>
          <Text style={[s.label, { color: colors.foreground }]}>Last Name</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <View style={s.field}>
          <Text style={[s.label, { color: colors.foreground }]}>Email</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.mutedForeground, borderColor: colors.border }]}
            value={user?.email || ''}
            editable={false}
          />
        </View>
        <View style={s.field}>
          <Text style={[s.label, { color: colors.foreground }]}>Phone</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[s.saveBtn, { backgroundColor: colors.primary }]}
        onPress={() => updateProfile.mutate()}
        disabled={updateProfile.isPending}
        activeOpacity={0.85}
      >
        {updateProfile.isPending ? <ActivityIndicator color={colors.card} /> : <Text style={[s.saveBtnText, { color: colors.card }]}>Save Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, height: 48 },
  saveBtn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});
