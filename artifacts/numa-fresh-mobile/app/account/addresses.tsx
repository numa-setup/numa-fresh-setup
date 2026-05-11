import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import type { Address } from '@/lib/types';

export default function AddressesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get<Address[]>('/users/addresses'),
  });
  const addresses = Array.isArray(data) ? data : [];

  const addAddress = useMutation({
    mutationFn: () => api.post('/users/addresses', { line1, city, province, postalCode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['addresses'] });
      setShowAdd(false);
      setLine1(''); setCity(''); setProvince(''); setPostalCode('');
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) =>
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Could not add address.'),
  });

  const deleteAddress = useMutation({
    mutationFn: (id: string) => api.delete(`/users/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/users/addresses/${id}`, { isDefault: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const s = styles(colors);

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : addresses.length === 0 && !showAdd ? (
        <View style={s.empty}>
          <Ionicons name="location-outline" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No Addresses</Text>
          <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Add a delivery address to checkout faster.</Text>
        </View>
      ) : (
        addresses.map((addr) => (
          <View key={addr.id} style={[s.addrCard, { backgroundColor: colors.card, borderColor: addr.isDefault ? colors.primary : colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.addrLine, { color: colors.foreground }]}>{addr.line1 || addr.street}</Text>
              <Text style={[s.addrCity, { color: colors.mutedForeground }]}>{addr.city}, {addr.province} {addr.postalCode}</Text>
              {addr.isDefault && (
                <View style={[s.defaultBadge, { backgroundColor: colors.primaryPale }]}>
                  <Text style={[s.defaultText, { color: colors.primary }]}>Default</Text>
                </View>
              )}
            </View>
            <View style={s.addrActions}>
              {!addr.isDefault && (
                <TouchableOpacity onPress={() => setDefault.mutate(addr.id)} style={s.actionBtn}>
                  <Ionicons name="star-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => {
                Alert.alert('Delete Address', 'Remove this address?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteAddress.mutate(addr.id) },
                ]);
              }} style={s.actionBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {showAdd && (
        <View style={[s.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.addTitle, { color: colors.foreground }]}>New Address</Text>
          {[
            { label: 'Street Address', value: line1, setter: setLine1, placeholder: '123 Main St' },
            { label: 'City', value: city, setter: setCity, placeholder: 'Toronto' },
            { label: 'Province', value: province, setter: setProvince, placeholder: 'ON' },
            { label: 'Postal Code', value: postalCode, setter: setPostalCode, placeholder: 'M1A 1A1' },
          ].map((f) => (
            <View key={f.label} style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.foreground }]}>{f.label}</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={f.value}
                onChangeText={f.setter}
                placeholder={f.placeholder}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          ))}
          <View style={s.addActions}>
            <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAdd(false)}>
              <Text style={[s.cancelText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={() => addAddress.mutate()} disabled={addAddress.isPending}>
              {addAddress.isPending ? <ActivityIndicator size="small" color={colors.card} /> : <Text style={[s.saveBtnText, { color: colors.card }]}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!showAdd && (
        <TouchableOpacity style={[s.addNewBtn, { borderColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={[s.addNewText, { color: colors.primary }]}>Add New Address</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  addrCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start' },
  addrLine: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  addrCity: { fontSize: 13 },
  defaultBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  defaultText: { fontSize: 11, fontWeight: '700' },
  addrActions: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  actionBtn: { padding: 4 },
  addCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  addTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  fieldInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, height: 48 },
  addActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 12, height: 48, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
  addNewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1.5, height: 52, gap: 8 },
  addNewText: { fontSize: 15, fontWeight: '700' },
});
