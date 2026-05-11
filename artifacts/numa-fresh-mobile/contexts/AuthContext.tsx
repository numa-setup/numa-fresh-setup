import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { api, loadTokens, saveTokens, clearTokens, getAccessToken, setOnUnauthorizedCallback } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: SignupData) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'CUSTOMER';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    await loadTokens();
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }
    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch {
      await clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      setUser(null);
      router.replace('/(auth)/login');
    });
    return () => { setOnUnauthorizedCallback(null); };
  }, [router]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const data = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { email, password },
    );
    await saveTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (signupData: SignupData): Promise<User> => {
    const data = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/signup',
      { ...signupData, role: 'CUSTOMER' },
    );
    await saveTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    await clearTokens();
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      updateUser,
      refreshUser,
    }),
    [user, isLoading, login, signup, logout, updateUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
