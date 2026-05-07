import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Package, ChevronRight, Clock, CheckCircle2, XCircle, Truck, AlertCircle, RotateCcw, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrders, useCancelOrder } from '@/hooks/useOrders';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Clock },
  STORE_CONFIRMED: { label: 'Confirmed', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  IN_PREPARATION: { label: 'Preparing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Clock },
  PREPARING: { label: 'Preparing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Clock },
  READY_FOR_PICKUP: { label: 'Ready!', color: 'bg-primary/10 text-primary border-primary/20', icon: Package },
  OUT_FOR_DELIVERY: { label: 'On the Way', color: 'bg-primary/10 text-primary border-primary/20', icon: Truck },
  COMPLETED: { label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  REFUNDED: { label: 'Refunded', color: 'bg-gray-50 text-gray-700 border-gray-200', icon: AlertCircle },
};

function OrderCard({ order }: { order: Order }) {
  const cancelOrder = useCancelOrder();
  const { addItem, setStoreInfo } = useCart();
  const [, navigate] = useLocation();
  const [reordering, setReordering] = useState(false);
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const Icon = status.icon;

  const handleCancel = async () => {
    if (!confirm('Cancel this order?')) return;
    try {
      await cancelOrder.mutateAsync({ orderId: order.id });
      toast.success('Order cancelled');
    } catch (err: any) {
      toast.error('Failed to cancel: ' + err.message);
    }
  };

  const handleReorder = async () => {
    setReordering(true);
    try {
      const result = await api.post<{ items: any[]; storeId: string; storeSlug: string; storeName: string }>(
        `/orders/${order.id}/reorder`, {}
      );
      if (result.storeId) {
        setStoreInfo(result.storeId, result.storeSlug, result.storeName);
      }
      let addedCount = 0;
      for (const item of result.items || []) {
        if (item.product) {
          addItem(item.product, item.quantity);
          addedCount++;
        }
      }
      if (addedCount > 0) {
        toast.success(`${addedCount} item${addedCount > 1 ? 's' : ''} added to cart!`);
        navigate('/cart');
      } else {
        toast.warning('Some items are no longer available from this store.');
      }
    } catch (err: any) {
      toast.error('Reorder failed: ' + (err.message || 'Please try again'));
    } finally {
      setReordering(false);
    }
  };

  const isCompleted = order.status === 'COMPLETED';
  const isCancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';

  return (
    <div
      className="bg-card rounded-2xl border border-border/50 p-4 hg-shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => navigate(`/orders/${order.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-sm">Order #{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color} shrink-0`}>
          <Icon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      {order.store && (
        <p className="text-sm text-muted-foreground mb-2">
          From <span className="text-foreground font-medium">{order.store.name}</span>
        </p>
      )}

      <div className="text-xs text-muted-foreground mb-3">
        {order.items?.slice(0, 3).map((item, i) => (
          <span key={item.id}>{i > 0 ? ', ' : ''}{item.name} ×{item.quantity}</span>
        ))}
        {order.items?.length > 3 && <span> +{order.items.length - 3} more</span>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">${order.finalTotal?.toFixed(2) || order.estimatedTotal?.toFixed(2)}</span>
        <div className="flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {(order.status === 'PENDING' || order.status === 'STORE_CONFIRMED') && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/30 px-2" onClick={handleCancel} disabled={cancelOrder.isPending}>
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 px-2"
            onClick={handleReorder}
            disabled={reordering}
          >
            <RotateCcw className="h-3 w-3" />
            {reordering ? '…' : 'Reorder'}
          </Button>
          {!isCancelled && (
            <Link href={`/orders/${order.id}/track`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/5 px-2">
                Track
              </Button>
            </Link>
          )}
          <Link href={`/orders/${order.id}`}>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2">
              Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('all');
  const { data, isLoading } = useOrders(tab === 'all' ? undefined : tab.toUpperCase());

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="font-serif font-bold text-2xl mb-2">Sign in to view orders</h2>
          <Link href="/login"><Button className="hg-gradient-primary border-0 text-white">Sign In</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px]">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <h1 className="font-serif font-bold text-3xl">My Orders</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
              </div>
            ) : data?.orders && data.orders.length > 0 ? (
              <div className="space-y-3">
                {data.orders.map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            ) : (
              <div className="text-center py-16">
                <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-serif font-semibold text-xl mb-2">No Orders Found</h3>
                <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
                <Link href="/">
                  <Button className="hg-gradient-primary border-0 text-white">Browse Stores</Button>
                </Link>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
