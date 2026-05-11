import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null) {
  _onUnauthorized = cb;
}

export async function loadTokens() {
  if (Platform.OS === 'web') {
    _accessToken = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    _refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  } else {
    _accessToken = await SecureStore.getItemAsync('accessToken');
    _refreshToken = await SecureStore.getItemAsync('refreshToken');
  }
}

export async function saveTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
    }
  } else {
    await SecureStore.setItemAsync('accessToken', access);
    await SecureStore.setItemAsync('refreshToken', refresh);
  }
}

export async function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  } else {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  }
}

export function getAccessToken() { return _accessToken; }

const instance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

instance.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

instance.interceptors.response.use(
  (res) => res,
  async (error: { config: { _retry?: boolean; headers: { Authorization: string } }; response?: { status: number } }) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && _refreshToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(instance(original));
            } else {
              reject(error);
            }
          });
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const resp = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${API_URL}/api/auth/refresh`,
          { refreshToken: _refreshToken },
        );
        const { accessToken, refreshToken } = resp.data;
        await saveTokens(accessToken, refreshToken);
        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${accessToken}`;
        return instance(original);
      } catch {
        await clearTokens();
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        _onUnauthorized?.();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) =>
    instance.get<T>(path, { params }).then((r) => r.data),
  post: <T>(path: string, body?: unknown) =>
    instance.post<T>(path, body).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) =>
    instance.patch<T>(path, body).then((r) => r.data),
  put: <T>(path: string, body?: unknown) =>
    instance.put<T>(path, body).then((r) => r.data),
  delete: <T>(path: string) =>
    instance.delete<T>(path).then((r) => r.data),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
