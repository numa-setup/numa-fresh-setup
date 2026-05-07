import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRCodeDisplayProps {
  value: string;
  orderId: string;
  size?: number;
}

export function QRCodeDisplay({ value, orderId, size = 180 }: QRCodeDisplayProps) {
  const qrRef = useRef<SVGSVGElement>(null);

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.download = `order-${orderId}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-2xl shadow-lg border border-border/30">
        <QRCodeSVG
          ref={qrRef}
          value={value}
          size={size}
          level="H"
          fgColor="#1a1a1a"
          bgColor="#ffffff"
          imageSettings={{
            src: '',
            x: undefined,
            y: undefined,
            height: 0,
            width: 0,
            excavate: false,
          }}
        />
      </div>
      <Button variant="outline" size="sm" onClick={downloadQR} className="gap-2 rounded-xl">
        <Download className="w-3.5 h-3.5" />
        Download QR
      </Button>
    </div>
  );
}
