import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "";

function getToken() {
  return localStorage.getItem("accessToken");
}

export type OrderEvent =
  | { type: "order_status"; status: string; message?: string }
  | { type: "order_ready"; qrCode?: string }
  | { type: "substitution_request"; originalItem: string; substituteItem: string; substitutePrice: number }
  | { type: "new_message"; from: "store" | "customer"; message: string; timestamp: string };

interface UseOrderSocketOptions {
  orderId: string | null;
  onEvent?: (event: OrderEvent) => void;
}

export function useOrderSocket({ orderId, onEvent }: UseOrderSocketOptions) {
  const token = getToken();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<OrderEvent | null>(null);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (!orderId) return;
    emit("send_message", { orderId, message });
  }, [orderId, emit]);

  const respondToSubstitution = useCallback((accepted: boolean, itemId: string) => {
    if (!orderId) return;
    emit("substitution_response", { orderId, itemId, accepted });
  }, [orderId, emit]);

  const notifyArrival = useCallback((vehicleInfo?: string) => {
    if (!orderId) return;
    emit("im_here_curbside", { orderId, vehicleInfo });
  }, [orderId, emit]);

  useEffect(() => {
    if (!token || !orderId) return;

    const socket = io(`${SOCKET_URL}/customer`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_order", orderId);
    });

    socket.on("disconnect", () => setConnected(false));

    const handleEvent = (type: string) => (data: Omit<OrderEvent, "type">) => {
      const event = { type, ...data } as OrderEvent;
      setLastEvent(event);
      onEvent?.(event);
    };

    socket.on("order_status", handleEvent("order_status"));
    socket.on("order_ready", handleEvent("order_ready"));
    socket.on("substitution_request", handleEvent("substitution_request"));
    socket.on("new_message", handleEvent("new_message"));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, orderId]);

  return { connected, lastEvent, sendMessage, respondToSubstitution, notifyArrival };
}

// Store-side socket hook
export function useStoreSocket(storeId: string | null) {
  const token = getToken();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: string, message?: string) => {
    emit("order_status_update", { orderId, status, message });
  }, [emit]);

  const markReady = useCallback((orderId: string, qrCode?: string) => {
    emit("mark_ready", { orderId, qrCode });
  }, [emit]);

  const requestSubstitution = useCallback((data: { orderId: string; originalItem: string; substituteItem: string; substitutePrice: number }) => {
    emit("substitution_request", data);
  }, [emit]);

  useEffect(() => {
    if (!token || !storeId) return;

    const socket = io(`${SOCKET_URL}/store`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_store", storeId);
    });
    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, storeId]);

  return { connected, emit, updateOrderStatus, markReady, requestSubstitution };
}
