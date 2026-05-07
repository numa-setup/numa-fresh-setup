import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Clock, ShieldCheck, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface OrderItem {
  name: string;
  quantity: number;
  totalPrice?: number;
  finalPrice?: number;
}

export interface OrderForQR {
  id: string;
  orderNumber: string;
  status: string;
  pickupQrCode?: string | null;
  finalTotal?: number | null;
  estimatedTotal?: number | null;
  readyAt?: string | null;
  store?: { name?: string; address?: string; city?: string } | null;
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  items?: OrderItem[];
}

interface OrderQRCodeProps {
  order: OrderForQR;
  size?: number;
}

/** Derives a stable pickup code from the order */
function derivePickupCode(order: OrderForQR): string {
  const existing = order.pickupQrCode;
  if (existing && existing.startsWith('PKP-') && existing.length <= 15) {
    return existing;
  }
  // Deterministic fallback from UUID (hex chars → uppercase)
  const hex = order.id.replace(/-/g, '').toUpperCase();
  return `PKP-${hex.slice(0, 6)}`;
}

export function OrderQRCode({ order, size = 200 }: OrderQRCodeProps) {
  const qrRef = useRef<SVGSVGElement>(null);

  // Already collected — QR no longer usable
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div
          className="bg-muted/40 rounded-2xl flex items-center justify-center border border-dashed border-border opacity-50"
          style={{ width: size, height: size }}
        >
          <QrCode className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {order.status === 'COMPLETED' ? 'Order Already Collected' : 'Order Unavailable'}
        </p>
      </div>
    );
  }

  const pickupCode = derivePickupCode(order);

  // QR is valid as long as the order is READY_FOR_PICKUP — no time-based expiry.

  const storeName = order.store?.name || 'Numa Fresh';

  // Fetch the correct base URL from backend (uses LAN IP, not localhost)
  // so any phone on the same WiFi can scan and open the page.
  const { data: urlData } = useQuery<{ baseUrl: string }>({
    queryKey: ['pickup-base-url'],
    queryFn: () => api.get('/pickup/local-url'),
    staleTime: 5 * 60 * 1000,   // re-check every 5 min
    retry: 1,
  });

  // Env var override → backend-detected LAN IP → window.location.origin fallback
  const baseUrl =
    (import.meta.env.VITE_APP_URL as string | undefined) ||
    urlData?.baseUrl ||
    window.location.origin;

  // QR encodes ONLY a URL — scanning opens the verification page on any phone
  const verifyUrl = `${baseUrl}/pickup/verify/${order.id}`;
  const qrPayload = verifyUrl;

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.download = `pickup-${order.orderNumber}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Real QR Code */}
      <div className="p-4 bg-white rounded-2xl shadow-lg border border-border/30">
        <QRCodeSVG
          ref={qrRef}
          value={qrPayload}
          size={size}
          level="H"
          fgColor="#1a1a1a"
          bgColor="#ffffff"
        />
      </div>

      {/* Pickup Code */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-6 py-3 text-center w-full max-w-[260px]">
        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-[0.1em] font-semibold">
          Pickup Code
        </p>
        <p className="font-mono font-bold text-2xl text-primary tracking-[0.2em]">
          {pickupCode}
        </p>
      </div>

      {/* Scan hint */}
      <p className="text-xs text-muted-foreground text-center max-w-[220px]">
        Scan to verify order details
      </p>

      {/* Expiry + Store meta */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Valid for pickup
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
          Order #{order.orderNumber} · {storeName}
        </div>
      </div>

      {/* Download button */}
      <Button variant="outline" size="sm" onClick={downloadQR} className="gap-2 rounded-xl">
        <Download className="w-3.5 h-3.5" />
        Download QR Code
      </Button>
    </div>
  );
}
