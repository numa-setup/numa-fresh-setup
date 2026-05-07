import { io, type Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "";

type Namespace = "/customer" | "/store" | "/admin";

export type Role = "CUSTOMER" | "STORE_OWNER" | "ADMIN";

function namespaceForRole(role: Role): Namespace {
  if (role === "ADMIN") return "/admin";
  if (role === "STORE_OWNER") return "/store";
  return "/customer";
}

interface CachedConnection {
  socket: Socket;
  namespace: Namespace;
  token: string;
  refCount: number;
}

let cached: CachedConnection | null = null;

function getOrCreateSocket(token: string, namespace: Namespace): Socket {
  if (cached && cached.token === token && cached.namespace === namespace) {
    cached.refCount += 1;
    return cached.socket;
  }
  if (cached) {
    try { cached.socket.disconnect(); } catch {}
    cached = null;
  }
  const socket = io(`${SOCKET_URL}${namespace}`, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });
  cached = { socket, namespace, token, refCount: 1 };
  return socket;
}

function releaseSocket(socket: Socket) {
  if (!cached || cached.socket !== socket) return;
  cached.refCount -= 1;
  if (cached.refCount <= 0) {
    try { cached.socket.disconnect(); } catch {}
    cached = null;
  }
}

export interface SocketHandle {
  socket: Socket;
  release: () => void;
}

export function connectForRole(role: Role): SocketHandle | null {
  const token = sessionStorage.getItem("accessToken");
  if (!token) return null;
  const ns = namespaceForRole(role);
  const socket = getOrCreateSocket(token, ns);
  return {
    socket,
    release: () => releaseSocket(socket),
  };
}
