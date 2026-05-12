import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Clock, CheckCircle2, XCircle, DollarSign, TrendingUp,
  Package, AlertCircle, ChevronRight, Timer, Truck, Store, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useAuth } from '@/contexts/AuthContext';
import { StoreStatusBanner } from '@/components/portal/StoreStatusBanner';

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

const ORDER_TYPE_ICONS: Record<string, React.ReactNode> = {
  EXPRESS_PICKUP: <Store className="h-3 w-3" />,
  CURBSIDE_PICKUP: <Truck className="h-3 w-3" />,
  STORE_DELIVERY: <Truck className="h-3 w-3" />,
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function StatCard({ label, value, icon: Icon, color, trend }: any) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 hg-shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <span className="text-xs font-medium text-green-600">{trend}</span>
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function OrderCard({ order, onAccept, onDecline, loading }: any) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border-2 border-amber-200 rounded-2xl overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="bg-amber-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-900">#{order.orderNumber}</span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || ''}`}>
            {ORDER_TYPE_ICONS[order.orderType]}
            {order.orderType?.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-700">
          <Clock className="h-3 w-3" />
          {timeAgo(order.createdAt)}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3">
        {order.pickupSlotTime && (
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-2">
            <Timer className="h-3 w-3" />
            Slot: {new Date(order.pickupSlotTime).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        <div className="space-y-1.5 mb-3">
          {order.items?.slice(0, 4).map((item: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 text-base leading-snug">
                {item.productType === 'FRESH_MEAT' ? '🥩' : item.productType === 'PRODUCE' ? '🥬' : item.productType === 'SPICES' ? '🌶️' : '📦'}
              </span>
              <span className="text-foreground">{item.name}</span>
              <span className="ml-auto text-muted-foreground shrink-0">×{item.quantity}</span>
            </div>
          ))}
          {order.items?.length > 4 && (
            <div className="text-xs text-muted-foreground pl-6">+{order.items.length - 4} more items</div>
          )}
        </div>

        {order.orderType === 'STORE_DELIVERY' && order.deliveryAddress && (
          <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg p-2 mb-2 text-blue-800">
            📍 {[order.deliveryAddress.line1 || order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.province].filter(Boolean).join(', ')}
          </div>
        )}

        {order.substitutionPref && order.substitutionPref !== 'NO_REPLACEMENT' && (
          <div className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-2 mb-2 text-amber-800">
            🔄 Substitution: {order.substitutionPref === 'REPLACE_SIMILAR' ? 'Replace with similar item' : order.substitutionPref === 'CHOOSE_SPECIFIC' ? 'Choose specific replacement' : 'Contact customer first'}
          </div>
        )}

        {order.specialInstructions && (
          <div className="text-xs bg-muted/50 rounded-lg p-2 mb-3 text-muted-foreground">
            💬 "{order.specialInstructions}"
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">
            {order.customer?.firstName} {order.customer?.lastName}
          </span>
          <span className="font-bold text-base text-foreground">
            ${Number(order.estimatedTotal || 0).toFixed(2)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-12 text-sm font-semibold bg-destructive hover:bg-destructive/90 text-white border-0 rounded-xl gap-2"
            onClick={() => onDecline(order.id)}
            disabled={loading}
          >
            <XCircle className="h-4 w-4" /> Decline
          </Button>
          <Button
            className="h-12 text-sm font-semibold hg-gradient-primary border-0 text-white rounded-xl gap-2"
            onClick={() => onAccept(order.id)}
            disabled={loading}
          >
            <CheckCircle2 className="h-4 w-4" /> Accept
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ActiveOrderCard({ order }: any) {
  return (
    <Link href={`/store-portal/orders/${order.id}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-card rounded-xl border border-border/50 p-3.5 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="font-semibold text-sm">#{order.orderNumber}</span>
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || ''}`}>
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="font-semibold text-sm">${Number(order.estimatedTotal || 0).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{order.customer?.firstName} {order.customer?.lastName} · {order.items?.length || 0} items</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(order.createdAt)}
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function StorePortalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const prevPendingCount = useRef(0);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: () => api.get<any>('/store/dashboard'),
    refetchInterval: 5000,
    retry: false,
  });

  const { data: storeStatus } = useQuery({
    queryKey: ['portal', 'store-status'],
    queryFn: () => api.get<any>('/store/onboarding/status'),
    refetchInterval: 30000,
    retry: false,
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['portal', 'orders', 'PENDING'],
    queryFn: () => api.get<any>('/store/orders?status=PENDING&limit=20'),
    refetchInterval: 5000,
    retry: false,
  });

  const { data: activeData } = useQuery({
    queryKey: ['portal', 'orders', 'active'],
    queryFn: () => api.get<any>('/store/orders?status=STORE_CONFIRMED,IN_PREPARATION&limit=20'),
    refetchInterval: 8000,
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: (orderId: string) => api.patch(`/store/orders/${orderId}/confirm`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal'] });
      toast({ title: '✅ Order accepted', description: 'Customer has been notified' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to accept order', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (orderId: string) => api.patch(`/store/orders/${orderId}/reject`, { reason: 'Unable to fulfill at this time' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal'] });
      toast({ title: 'Order declined', variant: 'destructive' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to decline order', variant: 'destructive' }),
  });

  const pendingOrders = pendingData?.orders || [];
  const activeOrders = activeData?.orders || [];

  // Audio alert for new orders (Web Audio API — no external file needed)
  const playNewOrderSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, startTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const t = ctx.currentTime;
      playTone(880, t, 0.15);
      playTone(1100, t + 0.18, 0.15);
      playTone(1320, t + 0.36, 0.25);
    } catch { /* silently skip if audio not supported */ }
  };

  // Notify on new pending orders
  useEffect(() => {
    if (pendingOrders.length > prevPendingCount.current && prevPendingCount.current > 0) {
      playNewOrderSound();
      toast({ title: '🔔 New Order!', description: `Order #${pendingOrders[0]?.orderNumber} just came in` });
    }
    prevPendingCount.current = pendingOrders.length;
  }, [pendingOrders.length]);

  if (!user || (user.role !== 'STORE_OWNER' && user.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="font-serif font-bold text-2xl mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">This area is for store owners and staff only.</p>
          <Link href="/"><Button className="hg-gradient-primary border-0 text-white">Go to Store</Button></Link>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Pending', value: dashLoading ? '—' : String(dashboard?.pendingOrders ?? 0), icon: Clock, color: 'bg-amber-100 text-amber-600', trend: undefined },
    { label: 'In Prep', value: dashLoading ? '—' : String(dashboard?.preparingOrders ?? 0), icon: Package, color: 'bg-indigo-100 text-indigo-600', trend: undefined },
    { label: 'Ready', value: dashLoading ? '—' : String(dashboard?.readyOrders ?? 0), icon: CheckCircle2, color: 'bg-green-100 text-green-600', trend: undefined },
    { label: "Today's Revenue", value: dashLoading ? '—' : `$${(dashboard?.todayRevenue ?? 0).toFixed(2)}`, icon: DollarSign, color: 'bg-primary/10 text-primary', trend: undefined },
    { label: 'Completed Today', value: dashLoading ? '—' : String(dashboard?.completedToday ?? 0), icon: TrendingUp, color: 'bg-teal-100 text-teal-600', trend: undefined },
    { label: 'Avg Prep Time', value: dashLoading ? '—' : `${dashboard?.avgPrepTime ?? 0} min`, icon: Timer, color: 'bg-purple-100 text-purple-600', trend: undefined },
  ];

  return (
    <PortalLayout title="Live Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Store Status Banner */}
        {storeStatus?.hasStore && (
          <StoreStatusBanner
            storeStatus={storeStatus.store?.storeStatus}
            isActiveManual={storeStatus.store?.isActiveManual}
            showOnWebsite={storeStatus.store?.showOnWebsite}
            isCurrentlyOpen={storeStatus.store?.isCurrentlyOpen}
            rejectionReason={storeStatus.store?.rejectionReason}
            onboardingCompleted={storeStatus.onboardingCompleted}
          />
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {stats.map(s => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* Main Content: Order Queue + Active Orders */}
        <div className="grid xl:grid-cols-5 gap-6">
          {/* LEFT: Incoming Order Queue */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-lg flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                Incoming Orders
                {pendingOrders.length > 0 && (
                  <Badge className="bg-amber-500 text-white border-0 text-xs">{pendingOrders.length}</Badge>
                )}
              </h2>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => qc.invalidateQueries({ queryKey: ['portal'] })}>
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>

            {pendingLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No pending orders</p>
                <p className="text-xs text-muted-foreground mt-1">New orders will appear here automatically</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {pendingOrders.map((order: any) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAccept={(id: string) => confirmMutation.mutate(id)}
                    onDecline={(id: string) => rejectMutation.mutate(id)}
                    loading={confirmMutation.isPending || rejectMutation.isPending}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* RIGHT: Active Orders */}
          <div className="xl:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-lg flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Active Orders
                {activeOrders.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{activeOrders.length}</Badge>
                )}
              </h2>
              <Link href="/store-portal/orders">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary hover:text-primary">
                  View All <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            {activeOrders.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No active orders</p>
                <p className="text-xs text-muted-foreground mt-1">Accepted orders will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {activeOrders.map((order: any) => (
                    <ActiveOrderCard key={order.id} order={order} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Ready for Pickup Section */}
            {(dashboard?.readyOrders ?? 0) > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Ready for Pickup
                </h3>
                <Link href="/store-portal/orders?status=READY_FOR_PICKUP">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between hover:bg-green-100 transition-colors cursor-pointer">
                    <span className="text-sm text-green-800 font-medium">{dashboard.readyOrders} orders waiting for customer</span>
                    <ChevronRight className="h-4 w-4 text-green-600" />
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
