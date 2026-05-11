import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signup } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signup({ firstName, lastName, email: email.trim().toLowerCase(), phone, password, role: 'CUSTOMER' });
      router.replace('/(tabs)');
    } catch (err) {
      const serverErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = serverErr?.response?.data?.message ?? serverErr?.message ?? 'Sign up failed. Please try again.';
      Alert.alert('Sign Up Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={[s.container]}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.title}>Create Account</Text>
          <Text style={s.subtitle}>Join Numa Fresh for premium halal groceries</Text>
        </View>

        <View style={s.card}>
          <View style={s.row}>
            <View style={[s.fieldGroup, { flex: 1 }]}>
              <Text style={s.label}>First Name *</Text>
              <TextInput
                style={s.input}
                placeholder="First"
                placeholderTextColor={colors.mutedForeground}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[s.fieldGroup, { flex: 1 }]}>
              <Text style={s.label}>Last Name *</Text>
              <TextInput
                style={s.input}
                placeholder="Last"
                placeholderTextColor={colors.mutedForeground}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Email *</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Phone</Text>
            <TextInput
              style={s.input}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={colors.mutedForeground}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Password *</Text>
            <View style={s.passwordWrapper}>
              <TextInput
                style={[s.input, { flex: 1, borderWidth: 0 }]}
                placeholder="Min 8 characters"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={s.primaryBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={s.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 24 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: c.foreground, marginBottom: 6 },
  subtitle: { fontSize: 14, color: c.mutedForeground },
  card: {
    backgroundColor: c.card, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: c.border,
  },
  row: { flexDirection: 'row' },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: c.foreground, marginBottom: 6 },
  input: {
    backgroundColor: c.muted, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 14, height: 48, fontSize: 15, color: c.foreground,
  },
  passwordWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.muted, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 14, height: 48,
  },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    backgroundColor: c.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: c.card },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: c.mutedForeground },
  footerLink: { fontSize: 14, fontWeight: '700', color: c.primary },
});
