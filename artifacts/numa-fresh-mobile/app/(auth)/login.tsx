import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err) {
      const serverErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = serverErr?.response?.data?.message ?? serverErr?.message ?? 'Login failed. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={[s.container]}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo area */}
        <View style={s.logoArea}>
          <View style={s.logoCircle}>
            <Ionicons name="leaf" size={36} color={colors.card} />
          </View>
          <Text style={s.brandName}>Numa Fresh</Text>
          <Text style={s.brandTagline}>Premium Halal Groceries</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Sign in to your account</Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Your password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={s.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity style={s.secondaryBtn}>
              <Text style={s.secondaryBtnText}>Create an Account</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <Text style={s.footerNote}>
          By signing in, you agree to our Terms & Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: c.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12,
  },
  brandName: { fontSize: 26, fontWeight: '800', color: c.foreground, letterSpacing: -0.5 },
  brandTagline: { fontSize: 13, color: c.mutedForeground, marginTop: 2 },
  card: {
    backgroundColor: c.card, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: c.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: c.foreground, marginBottom: 4 },
  subtitle: { fontSize: 14, color: c.mutedForeground, marginBottom: 24 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: c.foreground, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.muted, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 12, height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: c.foreground },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    backgroundColor: c.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: c.card },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { fontSize: 13, color: c.mutedForeground },
  secondaryBtn: {
    borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: c.primary,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: c.primary },
  footerNote: { textAlign: 'center', fontSize: 12, color: c.mutedForeground, marginTop: 24, lineHeight: 18 },
});
