import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Current access token, kept in sync with sessionStorage. Bumps when token rotates. */
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  signup: (data: SignupData) => Promise<User>;
  /** Apply session after passwordless OTP (or other token-based) auth without calling /auth/login. */
  establishSession: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'CUSTOMER' | 'STORE_OWNER';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(
    () => (typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null)
  );

  const loadUser = useCallback(async () => {
    const token = sessionStorage.getItem('accessToken');
    setAccessToken(token);
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Listen for token-rotation events fired by the api client after a refresh,
  // so the realtime socket can recreate with the fresh token.
  useEffect(() => {
    const handleTokenRotated = () => {
      setAccessToken(sessionStorage.getItem('accessToken'));
    };
    const handleLogout = () => {
      setUser(null);
      setAccessToken(null);
    };
    window.addEventListener('auth:token-rotated', handleTokenRotated);
    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.removeEventListener('auth:token-rotated', handleTokenRotated);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { user, accessToken, refreshToken } = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { email, password }
    );
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
    setAccessToken(accessToken);
    setUser(user);
    return user;
  }, []);

  const signup = useCallback(async (data: SignupData): Promise<User> => {
    const { user, accessToken, refreshToken } = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/signup',
      data
    );
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
    setAccessToken(accessToken);
    setUser(user);
    return user;
  }, []);

  const establishSession = useCallback((nextUser: User, accessToken: string, refreshToken: string) => {
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
    setAccessToken(accessToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    setAccessToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        accessToken,
        login,
        signup,
        establishSession,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
