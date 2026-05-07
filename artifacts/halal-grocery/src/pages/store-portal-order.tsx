import { useState, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, X, RefreshCw, Scale, ChevronRight, Clock, Truck,
  Store, AlertTriangle, Package, CheckCircle2, Printer, Timer, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { OrderQRCode } from '@/components/OrderQRCode';
import { QRCodeCanvas } from 'qrcode.react';
import { printPickupSlip } from '@/utils/printPickupSlip';

const STATUS_STEPS = ['STORE_CONFIRMED', 'IN_PREPARATION', 'READY_FOR_PICKUP'];
const STEP_LABELS: Record<string, string> = {
  STORE_CONFIRMED: 'Confirmed',
  IN_PREPARATION: 'In Preparation',
  READY_FOR_PICKUP: 'Ready',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  STORE_CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PREPARATION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  REPLACEMENT_HANDLING: 'bg-purple-50 text-purple-700 border-purple-200',
  READY_FOR_PICKUP: 'bg-green-50 text-green-700 border-green-200',
  OUT_FOR_DELIVERY: 'bg-teal-50 text-teal-700 border-teal-200',
  COMPLETED: 'bg-slate-50 text-slate-600 border-slate-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  FOUND: 'bg-green-100 text-green-700 border-green-200',
  OUT_OF_STOCK: 'bg-red-100 text-red-700 border-red-200',
  SUBSTITUTED: 'bg-blue-100 text-blue-700 border-blue-200',
  WEIGHED: 'bg-teal-100 text-teal-700 border-teal-200',
};

function StatusBar({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-2">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const current = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              done ? (current ? 'hg-gradient-primary text-white' : 'bg-primary/10 text-primary') : 'bg-muted text-muted-foreground'
            }`}>
              {done && !current ? <Check className="h-3 w-3" /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-current inline-block" />}
              {STEP_LABELS[step]}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <ChevronRight className={`h-3 w-3 ${done ? 'text-primary' : 'text-muted-foreground/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FreshMeatItem({ item, onWeighed }: { item: any; onWeighed: (itemId: string, weight: number) => void }) {
  const [weight, setWeight] = useState('');
  const price = Number(item.pricePerKg || item.unitPrice || 0);
  const finalPrice = weight ? (price * Number(weight)).toFixed(2) : null;

  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🥩</span>
        <div>
          <div className="font-semibold text-sm text-red-900">FRESH MEAT — CUT TO ORDER</div>
          <div className="text-sm text-red-700 font-medium">{item.name}</div>
        </div>
        {item.itemStatus && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${ITEM_STATUS_COLORS[item.itemStatus] || ''}`}>
            {item.itemStatus}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl p-3 space-y-1.5 border border-red-100">
        <div className="text-xs text-muted-foreground">Estimated: {item.quantity} {item.unit || 'kg'} @ ${price.toFixed(2)}/{item.unit || 'kg'} = ~${(price * Number(item.quantity || 1)).toFixed(2)}</div>
        {item.customInstructions && (
          <div className="text-xs bg-amber-50 text-amber-800 rounded-lg p-2">
            💬 Customer: "{item.customInstructions}"
          </div>
        )}
        {item.customerNote && (
          <div className="text-xs bg-blue-50 text-blue-800 rounded-lg p-2">
            📝 Note for shopper: "{item.customerNote}"
          </div>
        )}
      </div>

      {item.itemStatus !== 'WEIGHED' ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Actual weight (kg)</label>
            <Input
              type="number"
              step="0.01"
              min="0.1"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="0.00"
              className="h-12 text-lg font-bold text-center rounded-xl"
            />
          </div>
          {finalPrice && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Final Price</div>
              <div className="text-lg font-bold text-primary">${finalPrice}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl p-3">
          <CheckCircle2 className="h-5 w-5 text-teal-600" />
          <span className="text-sm text-teal-700 font-medium">
            Weighed: {item.actualWeight}kg — Final: ${Number(item.finalPrice || 0).toFixed(2)}
          </span>
        </div>
      )}

      {item.itemStatus !== 'WEIGHED' && (
        <Button
          className="w-full h-12 hg-gradient-primary border-0 text-white rounded-xl font-semibold gap-2"
          disabled={!weight}
          onClick={() => weight && onWeighed(item.id, Number(weight))}
        >
          <Scale className="h-4 w-4" /> Weighed & Packed
        </Button>
      )}
    </div>
  );
}

function PackagedItem({ item, onStatus }: { item: any; onStatus: (itemId: string, status: string) => void }) {
  const image = item.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=60';
  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 ${item.itemStatus === 'OUT_OF_STOCK' ? 'border-red-200 bg-red-50/30' : item.itemStatus === 'FOUND' ? 'border-green-200 bg-green-50/30' : 'border-border/50'}`}>
      <div className="flex items-center gap-3">
        <img src={image} alt={item.name} className="w-14 h-14 rounded-xl object-cover shrink-0" onError={e => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=60'} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm line-clamp-2">{item.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity} · ${Number(item.unitPrice || 0).toFixed(2)} each</div>
          {item.substitutionPreference && (
            <div className="text-xs text-primary mt-0.5">Sub pref: {item.substitutionPreference.replace(/_/g, ' ')}</div>
          )}
          {item.customerNote && (
            <div className="text-xs bg-blue-50 text-blue-800 rounded-lg px-2 py-1 mt-1.5 inline-block">
              📝 "{item.customerNote}"
            </div>
          )}
        </div>
        {item.itemStatus && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${ITEM_STATUS_COLORS[item.itemStatus] || ''}`}>
            {item.itemStatus}
          </span>
        )}
      </div>

      {!item.itemStatus || item.itemStatus === 'PENDING' ? (
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-12 bg-green-500 hover:bg-green-600 text-white border-0 rounded-xl font-semibold gap-2" onClick={() => onStatus(item.id, 'FOUND')}>
            <Check className="h-4 w-4" /> Found
          </Button>
          <Button className="h-12 bg-red-500 hover:bg-red-600 text-white border-0 rounded-xl font-semibold gap-2" onClick={() => onStatus(item.id, 'OUT_OF_STOCK')}>
            <X className="h-4 w-4" /> Out of Stock
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function StorePortalOrderPage() {
  const [, params] = useRoute('/store-portal/orders/:id');
  const orderId = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['portal', 'order', orderId],
    queryFn: () => api.get<any>(`/store/orders/${orderId}`),
    refetchInterval: 10000,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/store/orders/${orderId}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portal'] }); toast({ title: 'Order status updated' }); },
  });

  const itemStatusMutation = useMutation({
    mutationFn: ({ itemId, itemStatus }: any) => api.patch(`/store/orders/${orderId}/item-status`, { itemId, itemStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'order', orderId] }),
  });

  const meatWeightMutation = useMutation({
    mutationFn: ({ itemId, actualWeight }: any) => api.patch(`/store/orders/${orderId}/meat-weight`, { itemId, actualWeight }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portal', 'order', orderId] }); toast({ title: '✅ Weight recorded' }); },
  });

  const markReadyMutation = useMutation({
    mutationFn: () => api.post(`/store/orders/${orderId}/mark-ready`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portal'] }); toast({ title: '✅ Order marked ready! Customer notified.' }); },
  });

  const nextStatus: Record<string, string> = {
    STORE_CONFIRMED: 'IN_PREPARATION',
    IN_PREPARATION: 'READY_FOR_PICKUP',
  };

  const nextStatusLabel: Record<string, string> = {
    STORE_CONFIRMED: '▶ Start Preparing',
    IN_PREPARATION: '✓ Mark as Ready',
  };

  const allItemsHandled = order?.items?.every((i: any) => i.itemStatus && i.itemStatus !== 'PENDING') ?? false;
  const isReady = order?.status === 'READY_FOR_PICKUP';

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  // Print slip — uses a hidden QRCodeCanvas to generate a PNG data URL
  const printQrCanvasId = `print-qr-${orderId}`;
  const handlePrintSlip = () => {
    const canvas = document.getElementById(printQrCanvasId) as HTMLCanvasElement | null;
    const qrDataUrl = canvas ? canvas.toDataURL('image/png') : undefined;
    printPickupSlip(order, qrDataUrl);
  };

  const refundMutation = useMutation({
    mutationFn: () => statusMutation.mutateAsync('REFUNDED'),
    onSuccess: () => { setShowRefundModal(false); setRefundReason(''); setRefundAmount(''); },
  });

  if (isLoading) {
    return (
      <PortalLayout title="Order Detail">
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      </PortalLayout>
    );
  }

  if (!order) {
    return (
      <PortalLayout title="Order Not Found">
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="font-bold text-lg mb-2">Order Not Found</h2>
          <Link href="/store-portal/orders"><Button variant="outline">Back to Orders</Button></Link>
        </div>
      </PortalLayout>
    );
  }

  const orderType = order.orderType?.replace(/_/g, ' ');
  const meatItems = order.items?.filter((i: any) => i.productType === 'FRESH_MEAT') || [];
  const otherItems = order.items?.filter((i: any) => i.productType !== 'FRESH_MEAT') || [];

  return (
    <PortalLayout title={`Order #${order.orderNumber}`}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card rounded-2xl border border-border/50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href="/store-portal/orders">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                    <ArrowLeft className="h-3 w-3" /> Back
                  </Button>
                </Link>
                <h1 className="font-serif font-bold text-xl">#{order.orderNumber}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || ''}`}>
                  {order.status?.replace(/_/g, ' ')}
                </span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                  {order.orderType === 'CURBSIDE' ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                  {orderType}
                </span>
              </div>
              <div className="mt-1.5 text-sm text-muted-foreground">
                {order.customer?.firstName} {order.customer?.lastName}
                {order.customer?.phone && ` · ${order.customer.phone}`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-lg">${Number(order.estimatedTotal || 0).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(order.createdAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="overflow-x-auto">
            <StatusBar status={order.status} />
          </div>
        </div>

        {/* Curbside Info */}
        {order.orderType === 'CURBSIDE_PICKUP' && order.vehicleInfo && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-amber-700" />
              <span className="font-semibold text-sm text-amber-900">Curbside Pickup — Vehicle Info</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(order.vehicleInfo as Record<string, string>).map(([k, v]) => (
                <div key={k} className="bg-white rounded-xl p-2.5 text-center border border-amber-100">
                  <div className="text-xs text-muted-foreground capitalize">{k}</div>
                  <div className="font-bold text-sm">{String(v)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="space-y-4">
          <h2 className="font-serif font-bold text-lg flex items-center gap-2">
            Item Checklist
            <span className="text-sm font-normal text-muted-foreground">
              ({(order.items?.filter((i: any) => i.itemStatus && i.itemStatus !== 'PENDING').length || 0)}/{order.items?.length || 0} handled)
            </span>
          </h2>

          {/* Fresh Meat Items */}
          {meatItems.length > 0 && (
            <div className="space-y-3">
              {meatItems.map((item: any) => (
                <FreshMeatItem
                  key={item.id}
                  item={item}
                  onWeighed={(itemId, weight) => meatWeightMutation.mutate({ itemId, actualWeight: weight })}
                />
              ))}
            </div>
          )}

          {/* Packaged / Other Items */}
          {otherItems.length > 0 && (
            <div className="space-y-3">
              {otherItems.map((item: any) => (
                <PackagedItem
                  key={item.id}
                  item={item}
                  onStatus={(itemId, itemStatus) => itemStatusMutation.mutate({ itemId, itemStatus })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
          <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
            {order.status === 'IN_PREPARATION' && !allItemsHandled && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Mark all items as found/out-of-stock before marking as ready
              </div>
            )}

            {nextStatus[order.status] && (
              <Button
                className="w-full h-14 text-base font-bold hg-gradient-primary border-0 text-white rounded-xl gap-2"
                onClick={() => {
                  if (order.status === 'IN_PREPARATION') {
                    markReadyMutation.mutate();
                  } else {
                    statusMutation.mutate(nextStatus[order.status]);
                  }
                }}
                disabled={statusMutation.isPending || markReadyMutation.isPending || (order.status === 'IN_PREPARATION' && !allItemsHandled)}
              >
                {nextStatusLabel[order.status]}
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full h-10 text-sm text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive rounded-xl"
              onClick={() => statusMutation.mutate('CANCELLED')}
              disabled={statusMutation.isPending}
            >
              Cancel Order
            </Button>
          </div>
        )}

        {/* Completed — Refund Option */}
        {order.status === 'COMPLETED' && (
          <div className="bg-card rounded-2xl border border-border/50 p-4">
            <p className="text-sm text-muted-foreground mb-3">Need to issue a refund for this completed order?</p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setShowRefundModal(true)}
            >
              <DollarSign className="h-4 w-4" /> Issue Refund
            </Button>
          </div>
        )}

        {/* Refund Modal */}
        {showRefundModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowRefundModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
              <h3 className="font-bold text-base">Issue Refund</h3>
              <p className="text-sm text-muted-foreground">This will mark the order as refunded. Please confirm the refund details.</p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Refund Amount (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    placeholder={Number(order.finalTotal ?? order.estimatedTotal ?? 0).toFixed(2)}
                    className="pl-6 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reason</label>
                <Input
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Item unavailable, customer request…"
                  className="rounded-xl"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowRefundModal(false)}>Cancel</Button>
                <Button
                  size="sm"
                  className="rounded-xl bg-destructive text-white hover:bg-destructive/90 gap-2"
                  onClick={() => refundMutation.mutate()}
                  disabled={refundMutation.isPending || statusMutation.isPending}
                >
                  <DollarSign className="h-4 w-4" /> Confirm Refund
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Ready State — Real QR Code */}
        {isReady && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <div className="flex items-center justify-center gap-2 mb-5">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-bold text-green-800">Order Ready for Pickup!</span>
            </div>

            {/* Real QR Code — generated client-side from order data */}
            <div className="flex justify-center mb-5">
              <OrderQRCode order={order} size={180} />
            </div>

            {/* Hidden canvas — encodes verification URL for print slip PNG export */}
            <div style={{ display: 'none' }}>
              <QRCodeCanvas
                id={printQrCanvasId}
                value={`${window.location.origin}/pickup/verify/${order.id}`}
                size={150}
                level="H"
              />
            </div>

            <p className="text-sm text-green-700 text-center mb-5">
              Ask the customer to show this QR code, or scan it with your phone to verify pickup
            </p>

            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                className="hg-gradient-primary border-0 text-white rounded-xl gap-2"
                onClick={() => statusMutation.mutate('COMPLETED')}
                disabled={statusMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" /> Mark Collected
              </Button>
              <Button
                variant="outline"
                className="rounded-xl gap-2 border-green-300 text-green-700 hover:bg-green-50"
                onClick={handlePrintSlip}
              >
                <Printer className="h-4 w-4" /> Print Slip
              </Button>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
