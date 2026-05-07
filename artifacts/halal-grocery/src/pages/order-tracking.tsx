import { useState, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Clock, Package, MapPin, Car, Star, ChevronLeft,
  PhoneCall, RefreshCw, AlertTriangle, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { useOrder } from '@/hooks/useOrders';
import { useOrderSocket } from '@/hooks/useOrderSocket';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type OrderStatus = 'PENDING' | 'STORE_CONFIRMED' | 'IN_PREPARATION' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ElementType; desc?: string }[] = [
  { status: 'PENDING', label: 'Order Received', icon: Package, desc: 'Waiting for store to confirm...' },
  { status: 'STORE_CONFIRMED', label: 'Confirmed by Store', icon: CheckCircle2, desc: 'Store is getting ready' },
  { status: 'IN_PREPARATION', label: 'Being Prepared', icon: Clock, desc: 'Your fresh halal order is being packed' },
  { status: 'READY_FOR_PICKUP', label: 'Ready for Pickup', icon: MapPin, desc: 'Come grab it! 🏃' },
  { status: 'COMPLETED', label: 'Order Complete', icon: CheckCircle2, desc: 'Jazakallah Khair!' },
];

const STATUS_INDEX: Record<string, number> = {
  PENDING: 0, STORE_CONFIRMED: 1, IN_PREPARATION: 2, REPLACEMENT_HANDLING: 2,
  READY_FOR_PICKUP: 3, OUT_FOR_DELIVERY: 3, COMPLETED: 4,
};

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="text-2xl transition-transform hover:scale-110"
        >
          <Star className={`w-8 h-8 transition-colors ${(hover || value) >= i ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
        </button>
      ))}
    </div>
  );
}


export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const qc = useQueryClient();
  const { data: order, isLoading, refetch } = useOrder(orderId || '');
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [substitution, setSubstitution] = useState<{
    originalItem: string; substituteItem: string; substitutePrice: number;
  } | null>(null);

  const handleSocketEvent = useCallback((event: any) => {
    if (event.type === 'order_status') {
      setLiveStatus(event.status);
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      toast.success(`Order status: ${event.status.replace(/_/g, ' ')}`, { duration: 4000 });
    } else if (event.type === 'order_ready') {
      setLiveStatus('READY_FOR_PICKUP');
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      toast.success('🎉 Your order is READY for pickup!', { duration: 8000 });
    } else if (event.type === 'new_message' && event.from === 'store') {
      setMessages(prev => [...prev, { from: 'store', message: event.message, timestamp: event.timestamp }]);
      toast.info(`Store: ${event.message}`, { duration: 5000 });
    } else if (event.type === 'substitution_request') {
      setSubstitution(event);
      toast.warning('⚠️ Store is requesting a substitution!', { duration: 0 });
    }
  }, [orderId, qc]);

  const { connected, sendMessage, respondToSubstitution, notifyArrival } = useOrderSocket({
    orderId: orderId || null,
    onEvent: handleSocketEvent,
  });

  const rateMutation = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/rate`, { rating, review }),
    onSuccess: () => {
      toast.success('Thank you for your review! Jazakallah Khair 🌟');
      setShowRating(false);
    },
    onError: () => toast.error('Failed to submit rating. Please try again.'),
  });

  const handleSubstitutionResponse = (accepted: boolean) => {
    respondToSubstitution(accepted, 'item');
    setSubstitution(null);
    toast.success(accepted ? 'Substitution accepted!' : 'Substitution rejected — item will be removed.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="font-serif text-2xl font-bold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-4">We couldn't find order #{orderId?.slice(0, 8).toUpperCase()}</p>
          <Link href="/orders"><Button className="hg-gradient-primary border-0 text-white rounded-xl">My Orders</Button></Link>
        </div>
      </div>
    );
  }

  const effectiveStatus = liveStatus || order.status;
  const currentStep = STATUS_INDEX[effectiveStatus] ?? 0;
  const isReady = effectiveStatus === 'READY_FOR_PICKUP';
  const isCompleted = effectiveStatus === 'COMPLETED';
  const isCancelled = effectiveStatus === 'CANCELLED' || order.status === 'CANCELLED';
  const isCurbside = order.orderType === 'CURBSIDE_PICKUP' || (order as any).orderType === 'CURBSIDE';
  const orderNumber = (order as any).orderNumber || order.id.slice(0, 8).toUpperCase();

  return (
    <>
      <Helmet>
        <title>Track Order #{orderNumber} — Numa Fresh</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/50 bg-background sticky top-0 z-10 backdrop-blur-sm">
          <div className="container py-4 flex items-center gap-3">
            <Link href="/orders">
              <button className="p-2 rounded-xl hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg font-bold truncate">Order #{orderNumber}</h1>
              <p className="text-xs text-muted-foreground">{(order as any).store?.name || 'Halal Store'}</p>
            </div>
            <div className="flex items-center gap-2">
              {connected ? (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <WifiOff className="w-3.5 h-3.5" />
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={() => refetch()} className="rounded-xl">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <OrderStatusBadge status={effectiveStatus} />
            </div>
          </div>
        </div>

        <div className="container py-6 max-w-lg space-y-5">

          {/* Substitution Alert */}
          <AnimatePresence>
            {substitution && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-1">Substitution Requested</h3>
                    <p className="text-sm text-amber-700 mb-1">
                      <span className="line-through">{substitution.originalItem}</span>
                      {' → '}
                      <span className="font-medium">{substitution.substituteItem}</span>
                      {' ($' + substitution.substitutePrice.toFixed(2) + ')'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleSubstitutionResponse(false)}
                    className="flex-1 rounded-xl border-amber-300 text-amber-700"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleSubstitutionResponse(true)}
                    className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white border-0"
                  >
                    Accept
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ready Banner */}
          {isReady && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative overflow-hidden rounded-2xl hg-gradient-primary p-6 text-white text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-4xl mb-2"
              >
                🎉
              </motion.div>
              <h2 className="font-serif text-2xl font-bold">Your order is ready!</h2>
              <p className="text-white/85 text-sm mt-1">Show the QR code below to the store staff</p>
            </motion.div>
          )}

          {/* Cancelled Banner */}
          {isCancelled && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-5 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <h2 className="font-semibold text-destructive">Order Cancelled</h2>
              <p className="text-sm text-muted-foreground mt-1">Contact the store or support if you need help.</p>
            </div>
          )}

          {/* Status Timeline — horizontal */}
          {!isCancelled && (
            <div className="bg-card border border-border/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold">Order Progress</h3>
                {connected && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live updates
                  </span>
                )}
              </div>
              <div className="flex items-start gap-0">
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= currentStep;
                  const active = i === currentStep;
                  return (
                    <div key={step.status} className="flex-1 flex flex-col items-center relative">
                      {/* Connector line (before icon) */}
                      {i > 0 && (
                        <div className={`absolute top-4 right-1/2 left-0 h-0.5 transition-colors ${i <= currentStep ? 'bg-primary' : 'bg-border'}`} />
                      )}
                      <motion.div
                        animate={active && connected ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          done ? 'hg-gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
                        } ${active ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      >
                        <step.icon className="w-4 h-4" />
                      </motion.div>
                      <div className="text-center mt-1.5 px-1">
                        <p className={`text-[10px] font-medium leading-tight ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                        {active && step.desc && (
                          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-primary mt-0.5 leading-tight">
                            {step.desc}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Curbside Im Here */}
          {isCurbside && isReady && (
            <div className="bg-card border border-border/50 rounded-2xl p-5 text-center space-y-3">
              <Car className="w-10 h-10 mx-auto text-primary" />
              <h3 className="font-serif text-xl font-semibold">Ready in your vehicle?</h3>
              <p className="text-sm text-muted-foreground">Tap the button and the store will bring your order out.</p>
              <Button
                onClick={() => {
                  notifyArrival((order as any).vehicleInfo ? JSON.stringify((order as any).vehicleInfo) : undefined);
                  toast.success('Store notified — they\'re on their way! 🚗');
                }}
                className="w-full hg-gradient-primary border-0 text-white rounded-xl h-12 font-semibold gap-2"
              >
                <Car className="w-5 h-5" />
                I'm Here! 🚗
              </Button>
            </div>
          )}

          {/* Order Items */}
          <div className="bg-card border border-border/50 rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Order Items</h3>
            <div className="space-y-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-start justify-between text-sm">
                  <div className="flex-1">
                    <span className="font-medium">{item.quantity}× {item.name || item.product?.name || 'Item'}</span>
                    {item.meatCutType && <p className="text-xs text-primary">{item.meatCutType}</p>}
                    {item.meatCutInstructions && <p className="text-xs text-muted-foreground">{item.meatCutInstructions}</p>}
                  </div>
                  <span className="font-semibold ml-3">${parseFloat(item.totalPrice || '0').toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 mt-3 pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">
                ${parseFloat(String((order as any).finalTotal || (order as any).estimatedTotal || (order as any).totalAmount || '0')).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Contact Store */}
          {(order as any).store?.phone && !isCompleted && !isCancelled && (
            <a href={`tel:${(order as any).store.phone}`} className="flex items-center gap-3 p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <PhoneCall className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Call Store</p>
                <p className="text-xs text-muted-foreground">{(order as any).store.phone}</p>
              </div>
            </a>
          )}

          {/* Rating */}
          {isCompleted && !showRating && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-2xl p-5 text-center">
              <p className="font-semibold mb-1">How was your order?</p>
              <p className="text-sm text-muted-foreground mb-4">Your feedback helps our community</p>
              <Button onClick={() => setShowRating(true)} className="hg-gradient-primary border-0 text-white rounded-xl gap-2">
                <Star className="w-4 h-4" /> Rate this Order
              </Button>
            </motion.div>
          )}

          {showRating && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
              <h3 className="font-serif text-lg font-semibold text-center">Rate Your Experience</h3>
              <StarRatingInput value={rating} onChange={setRating} />
              <Textarea
                value={review}
                onChange={e => setReview(e.target.value)}
                placeholder="Write a review (optional)..."
                className="rounded-xl resize-none"
                rows={3}
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowRating(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button
                  onClick={() => rateMutation.mutate()}
                  disabled={rating === 0 || rateMutation.isPending}
                  className="flex-1 hg-gradient-primary border-0 text-white rounded-xl"
                >
                  {rateMutation.isPending ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </motion.div>
          )}

          <div className="h-16 md:h-4" />
        </div>
      </div>
    </>
  );
}
