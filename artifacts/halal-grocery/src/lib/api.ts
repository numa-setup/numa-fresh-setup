function getApiOrigin(): string {
  // Explicit env override always wins (set VITE_API_URL in .env)
  const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envApiUrl && envApiUrl.trim()) {
    return envApiUrl.replace(/\/$/, "");
  }

  // In local dev, derive the backend host from the CURRENT page hostname.
  // → On computer  (localhost:5173):      uses http://localhost:8080
  // → On phone/LAN (192.168.1.6:5173):   uses http://192.168.1.6:8080
  // This means QR scan on any phone works without any manual configuration.
  if (import.meta.env.DEV) {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `http://${host}:8080`;
  }

  return "";
}

export function getApiUrl(path: string): string {
  const origin = getApiOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}/api${normalizedPath}` : `/api${normalizedPath}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    // Try refresh
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(getApiUrl('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const { accessToken, refreshToken: newRefreshToken } = await refreshRes.json();
          sessionStorage.setItem('accessToken', accessToken);
          sessionStorage.setItem('refreshToken', newRefreshToken);
          // Notify listeners (AuthContext, realtime socket) that the token rotated
          window.dispatchEvent(new Event('auth:token-rotated'));
          // Retry with new token
          headers['Authorization'] = `Bearer ${accessToken}`;
          const retryRes = await fetch(getApiUrl(path), { ...options, headers, credentials: 'include' });
          if (!retryRes.ok) {
            const text = await retryRes.text();
            let parsed: Record<string, unknown> = {};
            try {
              if (text) parsed = JSON.parse(text) as Record<string, unknown>;
            } catch { /* non-JSON */ }
            const msg =
              (typeof parsed.message === 'string' && parsed.message) ||
              (typeof parsed.error === 'string' && parsed.error) ||
              (text ? text.slice(0, 200) : '') ||
              `Request failed (${retryRes.status})`;
            throw new ApiError(retryRes.status, msg, typeof parsed.error === 'string' ? parsed.error : undefined);
          }
          return retryRes.json();
        }
      } catch {}
    }
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    window.dispatchEvent(new Event('auth:logout'));
  }

  if (!response.ok) {
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      if (text) parsed = JSON.parse(text) as Record<string, unknown>;
    } catch { /* HTML or plain text */ }
    const msg =
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      (text ? text.trim().slice(0, 200) : '') ||
      `Request failed (${response.status})`;
    throw new ApiError(response.status, msg, typeof parsed.error === 'string' ? parsed.error : undefined);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
