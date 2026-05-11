import '../global.css';
import { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme, TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { useRouter as useRouterHook } from 'expo-router';
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular,
} from '@expo-google-fonts/playfair-display';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider, useCart } from '@/contexts/CartContext';
import { Colors } from '@/constants/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const PROTECTED_SEGMENTS = ['checkout', 'account', 'orders'];

function SessionGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const topSegment = segments[0] as string | undefined;
    if (!topSegment) return;
    const inProtected = PROTECTED_SEGMENTS.includes(topSegment);
    if (!isAuthenticated && inProtected) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return null;
}

function CartFab() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? Colors.dark : Colors.light;
  const { itemCount } = useCart();
  const router = useRouterHook();

  if (itemCount === 0) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/cart')}
      style={[fab.btn, { backgroundColor: colors.primary }]}
      activeOpacity={0.85}
    >
      <Ionicons name="cart" size={22} color={colors.card} />
      <View style={[fab.badge, { backgroundColor: colors.gold }]}>
        <Text style={[fab.badgeText, { color: colors.foreground }]}>{itemCount}</Text>
      </View>
    </TouchableOpacity>
  );
}

const fab = StyleSheet.create({
  btn: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 100 : 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
});

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? Colors.dark : Colors.light;

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CartProvider>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <SessionGate />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.foreground,
                  headerTitleStyle: { fontWeight: '700', fontSize: 17 },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="store/[slug]" options={{ headerShown: false }} />
                <Stack.Screen name="cart" options={{ title: 'Cart', presentation: 'modal' }} />
                <Stack.Screen name="checkout" options={{ title: 'Checkout', headerBackTitle: 'Cart' }} />
                <Stack.Screen name="products" options={{ title: 'Shop Products' }} />
                <Stack.Screen name="orders/[id]" options={{ title: 'Order Details' }} />
                <Stack.Screen name="orders/[id]/track" options={{ title: 'Track Order' }} />
                <Stack.Screen name="account/profile" options={{ title: 'Edit Profile' }} />
                <Stack.Screen name="account/addresses" options={{ title: 'Addresses' }} />
                <Stack.Screen name="account/loyalty" options={{ title: 'Loyalty Points' }} />
                <Stack.Screen name="account/notifications" options={{ title: 'Notifications' }} />
                <Stack.Screen name="account/meal-planner" options={{ title: 'AI Meal Planner' }} />
              </Stack>
              <CartFab />
            </CartProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
