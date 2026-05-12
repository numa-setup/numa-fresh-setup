import { useParams, Link, useLocation } from 'wouter';
import { useState } from 'react';
import { Package, MapPin, Clock, CheckCircle2, XCircle, ArrowLeft, Truck, RotateCcw, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useOrder } from '@/hooks/useOrders';
import { useCart } from '@/contexts/CartContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { OrderQRCode } from '@/components/OrderQRCode';
import { printPickupSlip } from '@/utils/printPickupSlip';

const STATUS_STEPS = ['PENDING', 'STORE_CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Order Placed',
  STORE_CONFIRMED: 'Store Confirmed',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

/* Round 10 / Fix #9 — shared one-click reorder helper */
function useReorder() {
  const { addItem, setStoreInfo } = useCart();
  const [, navigate] = useLocation();
  const [reordering, setReordering] = useState(false);

  const reorder = async (orderId: string) => {
    setReordering(true);
    try {
      const result = await api.post<{ items: any[]; storeId: string; storeSlug: string; storeName: string }>(
        `/orders/${orderId}/reorder`, {}
      );
      if (result.storeId) setStoreInfo(result.storeId, result.storeSlug, result.storeName);
      let added = 0;
      for (const item of result.items || []) {
        if (item.product) { addItem(item.product, item.quantity); added++; }
      }
      if (added > 0) {
        toast.success(`${added} item${added > 1 ? 's' : ''} added to cart!`);
        navigate('/cart');
      } else {
        toast.warning('Items from this order are no longer available.');
      }
    } catch (err: any) {
      toast.error('Reorder failed: ' + (err.message || 'Please try again'));
    } finally {
      setReordering(false);
    }
  };

  return { reorder, reordering };
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = useOrder(orderId);
  const { reorder, reordering } = useReorder();

  if (isLoading) {
    return (
      <div className="min-h-screen py-8 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-8 bg-muted animate-pulse rounded w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif font-bold text-2xl mb-2">Order Not Found</h2>
          <Link href="/orders"><Button variant="outline">My Orders</Button></Link>
        </div>
      </div>
    );
  }

  const isCancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const isDelivery = order.orderType === 'DELIVERY';
  const currentStepIdx = isCancelled ? -1 : (isDelivery
    ? ['PENDING', 'STORE_CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED'].indexOf(order.status)
    : STATUS_STEPS.indexOf(order.status));

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/orders">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif font-bold text-2xl">Order #{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Status Progress */}
        {!isCancelled ? (
          <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
            <h3 className="font-semibold mb-4">Order Status</h3>
            <div className="relative">
              <div className="flex justify-between relative z-10">
                {STATUS_STEPS.slice(0, isDelivery ? 5 : 5).map((step, i) => {
                  const done = i <= currentStepIdx;
                  const current = i === currentStepIdx;
                  return (
                    <div key={step} className="flex flex-col items-center gap-1 flex-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                        done ? 'bg-primary border-primary text-white' : 'bg-background border-border text-muted-foreground'
                      } ${current ? 'ring-2 ring-primary/30 ring-offset-1' : ''}`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                      </div>
                      <span className={`text-[10px] text-center leading-tight hidden sm:block ${done ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        {STATUS_LABELS[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-border">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${currentStepIdx >= 0 ? (currentStepIdx / (STATUS_STEPS.length - 1)) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-destructive/10 rounded-2xl border border-destructive/20 p-4 mb-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive" />
            <p className="font-medium text-destructive">{STATUS_LABELS[order.status]}</p>
          </div>
        )}

        {/* Store Info */}
        {order.store && (
          <div className="bg-card rounded-2xl border border-border/50 p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">From</p>
              <p className="font-semibold">{order.store.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {order.store.address}, {order.store.city}
              </p>
            </div>
            <Link href={`/store/${order.store.slug}`}>
              <Button variant="outline" size="sm">View Store</Button>
            </Link>
          </div>
        )}

        {/* QR Code — shown when order is Ready for Pickup */}
        {order.status === 'READY_FOR_PICKUP' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-bold text-green-800">Your order is ready for pickup!</p>
            </div>
            <p className="text-sm text-green-700 mb-4">
              Show the QR code or your pickup code at the store to collect your order.
            </p>
            <div className="flex justify-center">
              <OrderQRCode order={order} size={200} />
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-card rounded-2xl border border-border/50 p-4 mb-4">
          <h3 className="font-semibold mb-3">Items</h3>
          <div className="space-y-3">
            {order.items?.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.unit} × {item.quantity}
                    {item.selectedCut && ` · Cut: ${item.selectedCut}`}
                  </p>
                  {item.cutInstructions && (
                    <p className="text-xs text-muted-foreground italic">{item.cutInstructions}</p>
                  )}
                </div>
                <p className="font-medium text-sm">${item.totalPrice.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            {order.convenienceFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Convenience Fee</span>
                <span>${order.convenienceFee.toFixed(2)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span>${order.deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Discount</span>
                <span>-${order.discount.toFixed(2)}</span>
              </div>
            )}
            {order.tip > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tip</span>
                <span>${order.tip.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base pt-1">
              <span>Total</span>
              <span>${(order.finalTotal || order.estimatedTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        {order.specialInstructions && (
          <div className="bg-card rounded-2xl border border-border/50 p-4 mb-4">
            <h3 className="font-semibold text-sm mb-2">Special Instructions</h3>
            <p className="text-sm text-muted-foreground">{order.specialInstructions}</p>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <Button
            className="flex-1 hg-gradient-primary border-0 text-white gap-1.5"
            onClick={() => reorder(order.id)}
            disabled={reordering}
          >
            <RotateCcw className="h-4 w-4" />
            {reordering ? 'Adding…' : 'Reorder'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={() => printPickupSlip(order)}
          >
            <Printer className="h-4 w-4" />
            Invoice
          </Button>
          <Link href="/orders" className="flex-1">
            <Button variant="outline" className="w-full">All Orders</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
