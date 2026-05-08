import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Car, Truck, ChevronRight, ChevronLeft, PartyPopper, Loader2, CreditCard } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { PickupSlotSelector } from '@/components/PickupSlotSelector';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';

type OrderType = 'PICKUP' | 'CURBSIDE' | 'DELIVERY';

const STEPS = [
  { id: 1, label: 'Order Type' },
  { id: 2, label: 'Substitutions' },
  { id: 3, label: 'Review & Pay' },
  { id: 4, label: 'Confirmation' },
];

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { items, subtotal, storeSlug, storeId, storeName, clearCart } = useCart();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [orderType, setOrderType] = useState<OrderType>('PICKUP');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [vehicleInfo, setVehicleInfo] = useState({ make: '', model: '', color: '', plate: '' });

  // Step 2 — substitution prefs per item (simplified)
  const [subPrefs, setSubPrefs] = useState<Record<string, string>>({});

  // Step 3 state
  const [tip, setTip] = useState(0);
  const [notes, setNotes] = useState('');
  const [isFastDelivery, setIsFastDelivery] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod' | 'pay_at_store'>('online');
  const [deliveryAddress, setDeliveryAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [paymentSummary, setPaymentSummary] = useState<'paid' | 'cod' | 'pay_at_store' | null>(null);
  const [showPaymentFailDialog, setShowPaymentFailDialog] = useState(false);

  // Step 4 — confirmed order
  const [confirmedOrder, setConfirmedOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  /** Stripe card checkout (enabled when VITE_STRIPE_PUBLISHABLE_KEY is set). */
  const stripePublishableKey =
    (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim() || undefined;
  const stripeUsableKey = stripePublishableKey?.startsWith('pk_') ? stripePublishableKey : undefined;
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const paymentMountRef = useRef<HTMLDivElement | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);

  const { data: slots = [] } = useQuery({
    queryKey: ['slots', storeSlug],
    queryFn: () => api.get<any[]>(`/slots/${storeSlug}`),
    enabled: !!storeSlug && step === 1,
  });

  const { data: storeDetail } = useQuery({
    queryKey: ['store', storeSlug, 'checkout-fees'],
    queryFn: () => api.get<any>(`/stores/${storeSlug}`),
    enabled: !!storeSlug && !!user,
  });

  const placeOrder = useMutation({
    mutationFn: (data: any) => api.post<any>('/orders/place', data),
    onSuccess: (order) => {
      const id = order.orderId || order.id;
      const confirmed = { id, orderNumber: order.orderNumber || id.slice(0, 8).toUpperCase() };
      setPaymentSummary(order.paymentStatus || (paymentMethod === 'online' ? 'paid' : paymentMethod));
      setConfirmedOrder(confirmed);
      setShowConfirmDialog(true);
      setStep(4);
      clearCart();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to place order');
    },
  });

  const convenienceFee = orderType === 'PICKUP' || orderType === 'CURBSIDE'
    ? Number(storeDetail?.convenienceFee ?? 2.99)
    : 0;
  const curbsideFee = orderType === 'CURBSIDE' ? Number(storeDetail?.curbsideFee ?? 1.99) : 0;
  const deliveryFee = orderType === 'DELIVERY' ? Number(storeDetail?.deliveryFee ?? 4.99) : 0;
  const fastDeliveryEnv = (import.meta.env.VITE_FAST_DELIVERY_CHARGE as string | undefined)?.trim();
  const fastDeliveryCharge = orderType === 'DELIVERY' && isFastDelivery
    ? Number(fastDeliveryEnv || 0)
    : 0;
  const promoDiscount = 0;
  const total = Math.max(0, subtotal + convenienceFee + curbsideFee + deliveryFee + fastDeliveryCharge - promoDiscount + tip);
  const hasMeat = items.some(i => (i.product as any).isFreshMeat);

  const feeRows = [
    { label: 'Subtotal', amount: subtotal },
    { label: 'Convenience Fee', amount: convenienceFee, muted: convenienceFee === 0 },
    ...(curbsideFee > 0 ? [{ label: 'Curbside Fee', amount: curbsideFee }] : []),
    ...(deliveryFee > 0 ? [{ label: 'Delivery Fee', amount: deliveryFee }] : []),
    ...(fastDeliveryCharge > 0 ? [{ label: 'Fast Delivery', amount: fastDeliveryCharge }] : []),
    ...(promoDiscount > 0 ? [{ label: 'Promo', amount: promoDiscount, negative: true }] : []),
    ...(tip > 0 ? [{ label: 'Tip (Thank you!)', amount: tip }] : []),
  ];

  const orderTypeMap: Record<OrderType, 'EXPRESS_PICKUP' | 'CURBSIDE_PICKUP' | 'STORE_DELIVERY'> = {
    PICKUP: 'EXPRESS_PICKUP',
    CURBSIDE: 'CURBSIDE_PICKUP',
    DELIVERY: 'STORE_DELIVERY',
  };

  /** Server pricing body for Stripe create-intent + confirm-order (same fields as POST /orders). */
  const checkoutPayload = useMemo(() => {
    if (!storeId) return null;
    const hasVehicleInfo = orderType === 'CURBSIDE' && (vehicleInfo.make || vehicleInfo.model || vehicleInfo.color || vehicleInfo.plate);
    return {
      storeId,
      orderType: orderTypeMap[orderType],
      pickupSlotId: selectedSlot || null,
      addressId: null as string | null,
      items: items.map(i => ({
        productId: i.product.id,
        quantity: i.quantity,
        meatCutType: i.selectedCut || null,
        meatCutInstructions: i.cutInstructions || null,
        substitutionPref: subPrefs[i.product.id] || 'NO_REPLACEMENT',
        customerNote: i.noteForShopper || null,
      })),
      promoCode: null,
      tip,
      loyaltyPointsToUse: 0,
      vehicleInfo: hasVehicleInfo ? vehicleInfo : null,
      specialInstructions: notes || null,
      deliveryMethod: orderType === 'DELIVERY' ? 'home_delivery' : 'store_pickup',
      paymentMethod,
      deliveryAddress: orderType === 'DELIVERY' ? {
        street: deliveryAddress.street,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        zip: deliveryAddress.zip,
      } : null,
      isFastDelivery: orderType === 'DELIVERY' ? isFastDelivery : false,
      fastDeliveryCharge,
      totalAmount: total,
    };
  }, [storeId, orderType, selectedSlot, items, subPrefs, tip, vehicleInfo, notes, paymentMethod, isFastDelivery, deliveryAddress, fastDeliveryCharge, total]);

  useEffect(() => {
    if (!stripeUsableKey) return;
    void loadStripe(stripeUsableKey).then(s => setStripe(s));
  }, [stripeUsableKey]);

  useEffect(() => {
    if (orderType === 'DELIVERY' && !fastDeliveryEnv) {
      console.error('Missing VITE_FAST_DELIVERY_CHARGE. Fast delivery amount will be 0 on the client.');
    }
    if (!stripePublishableKey) {
      console.error('Missing VITE_STRIPE_PUBLISHABLE_KEY. Online payment will be unavailable.');
    } else if (!stripePublishableKey.startsWith('pk_')) {
      console.error('Invalid Stripe frontend key. VITE_STRIPE_PUBLISHABLE_KEY must be a publishable pk_ key.');
    }
  }, [orderType, fastDeliveryEnv, stripePublishableKey]);

  useEffect(() => {
    if (orderType === 'DELIVERY' && paymentMethod === 'pay_at_store') {
      setPaymentMethod('cod');
    }
    if (orderType !== 'DELIVERY' && paymentMethod === 'cod') {
      setPaymentMethod('pay_at_store');
    }
  }, [orderType, paymentMethod]);

  useEffect(() => {
    if (step !== 3 || !stripeUsableKey || !user || !checkoutPayload || paymentMethod !== 'online') {
      setClientSecret(null);
      setPaymentIntentId(null);
      setIntentError(null);
      return;
    }
    let cancelled = false;
    setIntentLoading(true);
    setIntentError(null);
    setClientSecret(null);
    setPaymentIntentId(null);
    api.post<{ clientSecret: string; paymentIntentId: string }>('/orders/create-payment-intent', checkoutPayload)
      .then((r) => {
        if (!cancelled && r.clientSecret && r.paymentIntentId) {
          setClientSecret(r.clientSecret);
          setPaymentIntentId(r.paymentIntentId);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setIntentError(e.message || 'Could not start secure payment.');
      })
      .finally(() => { if (!cancelled) setIntentLoading(false); });
    return () => { cancelled = true; };
  }, [step, stripeUsableKey, user, checkoutPayload, paymentMethod]);

  useEffect(() => {
    if (!stripe || !clientSecret || step !== 3 || !paymentMountRef.current) return;
    const mountEl = paymentMountRef.current;
    mountEl.innerHTML = '';
    const elements = stripe.elements({
      clientSecret,
      appearance: { theme: 'stripe', variables: { colorPrimary: '#0d9488' } },
    });
    const paymentElement = elements.create('payment');
    paymentElement.mount(mountEl);
    elementsRef.current = elements;
    return () => {
      try {
        paymentElement.destroy();
      } catch { /* noop */ }
      elementsRef.current = null;
      mountEl.innerHTML = '';
    };
  }, [stripe, clientSecret, step]);

  const confirmStripeOrder = async () => {
    if (!stripe || !paymentIntentId || !checkoutPayload) return;
    const elements = elementsRef.current;
    if (!elements) {
      setCardError('Payment form not ready. Please wait a moment.');
      return;
    }
    setPayBusy(true);
    setCardError(null);
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setCardError(submitErr.message || 'Please check your payment details.');
      setPayBusy(false);
      return;
    }
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret: clientSecret!,
      confirmParams: {
        return_url: `${window.location.origin}/checkout`,
      },
      redirect: 'if_required',
    });
    if (error) {
      setCardError(
        error.message ||
          (error.type === 'card_error' ? 'Payment failed.' : 'Connection error. Please check your internet and try again.'),
      );
      setPayBusy(false);
      return;
    }
    try {
      const order = await api.post<any>('/orders/place', { ...checkoutPayload, stripePaymentIntentId: paymentIntentId });
      const id = order.orderId || order.id;
      const confirmed = { id, orderNumber: order.orderNumber || id.slice(0, 8).toUpperCase() };
      setPaymentSummary('paid');
      setConfirmedOrder(confirmed);
      setShowConfirmDialog(true);
      setStep(4);
      clearCart();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Order could not be saved. If you were charged, contact support.';
      setCardError(msg);
      setShowPaymentFailDialog(true);
      toast.error(msg);
    } finally {
      setPayBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <h2 className="font-serif text-2xl font-bold mb-2">Sign in to checkout</h2>
          <p className="text-muted-foreground mb-4">You need to be signed in to place an order.</p>
          <Button onClick={() => setLocation('/login?next=/checkout')} className="hg-gradient-primary border-0 text-white rounded-xl">Sign In</Button>
        </div>
      </div>
    );
  }

  if (items.length === 0 && step !== 4) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <h2 className="font-serif text-2xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-4">Add items from a store before checking out.</p>
          <Button onClick={() => setLocation('/')} className="hg-gradient-primary border-0 text-white rounded-xl">Browse Stores</Button>
        </div>
      </div>
    );
  }

  const handlePlaceOrder = () => {
    if (!checkoutPayload) return;
    if (orderType === 'DELIVERY') {
      const missing = !deliveryAddress.street.trim() || !deliveryAddress.city.trim() || !deliveryAddress.state.trim() || !deliveryAddress.zip.trim();
      if (missing) {
        toast.error('Please complete delivery address.');
        return;
      }
    }
    placeOrder.mutate(checkoutPayload);
  };

  return (
    <>
      <Helmet>
        <title>Checkout — Numa Fresh</title>
      </Helmet>

      {/* Order Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] rounded-3xl border-border/50 p-0 overflow-hidden max-h-[90dvh] overflow-y-auto">
          <div className="hg-gradient-primary p-6 text-center text-white">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
              <PartyPopper className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-serif font-bold text-xl">Order Placed!</h2>
            <p className="text-white/80 text-sm mt-1">Alhamdulillah — your halal order is confirmed</p>
          </div>
          <div className="p-6 space-y-4">
            {confirmedOrder && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Order Number</p>
                <p className="font-serif text-2xl font-bold text-primary">#{confirmedOrder.orderNumber}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              {paymentSummary === 'paid' && 'Payment: Confirmed via Card'}
              {paymentSummary === 'cod' && 'Payment: Cash on Delivery'}
              {paymentSummary === 'pay_at_store' && 'Payment: Pay at Store'}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => { setShowConfirmDialog(false); if (confirmedOrder) setLocation(`/orders/${confirmedOrder.id}`); }}
                className="w-full hg-gradient-primary border-0 text-white rounded-xl"
              >
                Track My Order
              </Button>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="w-full rounded-xl">
                View Confirmation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentFailDialog} onOpenChange={setShowPaymentFailDialog}>
        <DialogContent className="sm:max-w-sm rounded-3xl border-border/50 p-6">
          <div className="text-center space-y-3">
            <div className="text-2xl">❌</div>
            <h3 className="font-serif text-xl font-bold">Payment Failed</h3>
            <p className="text-sm text-muted-foreground">{cardError || 'Payment could not be completed.'}</p>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 rounded-xl" onClick={() => setShowPaymentFailDialog(false)}>Try Again</Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCardError(null)}>Use Different Card</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-background">
        {/* Progress bar */}
        {step < 4 && (
          <div className="border-b border-border/50 bg-background sticky top-0 z-10">
            <div className="container py-4">
              <h1 className="font-serif text-lg font-bold mb-3">Checkout</h1>
              <div className="flex items-center gap-1">
                {STEPS.slice(0, 3).map((s, i) => (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className={`flex items-center gap-1.5 ${step >= s.id ? 'text-primary' : 'text-muted-foreground'}`}>
                      <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step > s.id ? 'hg-gradient-primary text-white' : step === s.id ? 'border-2 border-primary text-primary' : 'border-2 border-border text-muted-foreground'}`}>
                        {step > s.id ? '✓' : s.id}
                      </div>
                      <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-px mx-2 ${step > s.id ? 'bg-primary' : 'bg-border'}`} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="container py-6 max-w-2xl">
          <AnimatePresence mode="wait">

            {/* STEP 1: ORDER TYPE */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <h2 className="font-serif text-2xl font-bold mb-1">How would you like your order?</h2>
                  <p className="text-muted-foreground text-sm">Choose your preferred pickup or delivery method</p>
                </div>

                {/* Order type cards */}
                <div className="space-y-3">
                  {[
                    { type: 'PICKUP' as OrderType, icon: Clock, label: 'Express Pickup', desc: 'Walk in and pick up in under 60 seconds', fee: `$${Number(storeDetail?.convenienceFee ?? 2.99).toFixed(2)} convenience fee`, recommended: true },
                    { type: 'CURBSIDE' as OrderType, icon: Car, label: 'Curbside Pickup', desc: 'We bring it to your vehicle', fee: `$${Number(storeDetail?.curbsideFee ?? 1.99).toFixed(2)} curbside fee`, recommended: false },
                    { type: 'DELIVERY' as OrderType, icon: Truck, label: 'Store Delivery', desc: 'Delivered by the store driver', fee: `$${Number(storeDetail?.deliveryFee ?? 4.99).toFixed(2)} delivery fee`, recommended: false },
                  ].map(({ type, icon: Icon, label, desc, fee, recommended }) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all ${
                        orderType === type ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${orderType === type ? 'hg-gradient-primary text-white' : 'bg-muted'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{label}</span>
                            {recommended && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold hg-gradient-primary text-white">Recommended</span>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                          <p className="text-xs text-muted-foreground mt-1">{fee}</p>
                        </div>
                        {orderType === type && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Curbside vehicle info */}
                {orderType === 'CURBSIDE' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <p className="text-sm font-medium">Vehicle Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Make</Label>
                        <Input value={vehicleInfo.make} onChange={e => setVehicleInfo(v => ({ ...v, make: e.target.value }))} placeholder="Toyota" className="mt-1 rounded-xl" />
                      </div>
                      <div>
                        <Label className="text-xs">Model</Label>
                        <Input value={vehicleInfo.model} onChange={e => setVehicleInfo(v => ({ ...v, model: e.target.value }))} placeholder="Camry" className="mt-1 rounded-xl" />
                      </div>
                      <div>
                        <Label className="text-xs">Color</Label>
                        <Input value={vehicleInfo.color} onChange={e => setVehicleInfo(v => ({ ...v, color: e.target.value }))} placeholder="White" className="mt-1 rounded-xl" />
                      </div>
                      <div>
                        <Label className="text-xs">Plate</Label>
                        <Input value={vehicleInfo.plate} onChange={e => setVehicleInfo(v => ({ ...v, plate: e.target.value }))} placeholder="ABCD 123" className="mt-1 rounded-xl" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {orderType === 'DELIVERY' && (
                  <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
                    <p className="text-sm font-semibold">Delivery Address</p>
                    <Input
                      placeholder="Street Address"
                      value={deliveryAddress.street}
                      onChange={(e) => setDeliveryAddress((v) => ({ ...v, street: e.target.value }))}
                      className="rounded-xl"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="City" value={deliveryAddress.city} onChange={(e) => setDeliveryAddress((v) => ({ ...v, city: e.target.value }))} className="rounded-xl" />
                      <Input placeholder="State" value={deliveryAddress.state} onChange={(e) => setDeliveryAddress((v) => ({ ...v, state: e.target.value }))} className="rounded-xl" />
                      <Input placeholder="ZIP" value={deliveryAddress.zip} onChange={(e) => setDeliveryAddress((v) => ({ ...v, zip: e.target.value }))} className="rounded-xl" />
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFastDelivery}
                        onChange={(e) => setIsFastDelivery(e.target.checked)}
                        className="mt-1"
                      />
                      <span className="text-sm">
                        <span className="font-semibold">Fast Delivery (+${Number(fastDeliveryEnv || 0).toFixed(2)})</span>
                        <span className="block text-muted-foreground text-xs">Estimated: 1-2 hours (Regular: 2-4 hours)</span>
                      </span>
                    </label>
                  </div>
                )}

                {(orderType === 'PICKUP' || orderType === 'CURBSIDE') && (
                  <div className="rounded-2xl border border-border/50 bg-card p-4">
                    <p className="text-sm font-semibold">Pickup from:</p>
                    <p className="text-sm text-muted-foreground">{storeName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Ready in: 30-60 minutes</p>
                  </div>
                )}

                {/* Pickup slots */}
                {(orderType === 'PICKUP' || orderType === 'CURBSIDE') && slots.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3">Select Pickup Time</p>
                    <PickupSlotSelector slots={slots} value={selectedSlot} onChange={setSelectedSlot} />
                  </div>
                )}

                <Button onClick={() => setStep(2)} className="w-full hg-gradient-primary border-0 text-white rounded-xl h-12 font-semibold gap-2">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* STEP 2: SUBSTITUTIONS */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <h2 className="font-serif text-2xl font-bold mb-1">Substitution Preferences</h2>
                  <p className="text-sm text-muted-foreground">What should we do if an item is unavailable?</p>
                </div>

                <div className="space-y-4">
                  {items.filter(i => !(i.product as any).isFreshMeat).map(item => (
                    <div key={item.product.id} className="bg-card border border-border/50 rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl">🛒</div>
                        <div>
                          <p className="font-medium text-sm">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'none', label: 'No Replacement', desc: 'Remove if unavailable' },
                          { value: 'similar', label: 'Similar Item', desc: 'Staff picks best match' },
                          { value: 'contact', label: 'Contact Me', desc: "I'll approve first" },
                          { value: 'any', label: 'Any', desc: 'Surprise me!' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setSubPrefs(p => ({ ...p, [item.product.id]: opt.value }))}
                            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                              (subPrefs[item.product.id] || 'similar') === opt.value
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border/50'
                            }`}
                          >
                            <p className="font-medium">{opt.label}</p>
                            <p className="text-muted-foreground">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {items.every(i => (i.product as any).isFreshMeat) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-lg font-medium">No substitution needed</p>
                      <p className="text-sm">All your items are fresh-cut meat orders</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
                  <Button onClick={() => setStep(3)} className="flex-1 hg-gradient-primary border-0 text-white rounded-xl gap-1">Continue <ChevronRight className="w-4 h-4" /></Button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: REVIEW & PAY */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <h2 className="font-serif text-2xl font-bold mb-1">Review Your Order</h2>
                  <p className="text-sm text-muted-foreground">from {storeName}</p>
                </div>

                {/* Items list */}
                <div className="bg-card border border-border/50 rounded-2xl divide-y divide-border/50">
                  {items.map(item => (
                    <div key={item.product.id} className="flex items-center gap-3 p-4">
                      <span className="text-muted-foreground text-sm w-5">{item.quantity}×</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product.name}</p>
                        {item.selectedCut && <p className="text-xs text-primary">{item.selectedCut}{item.weightKg ? ` · ~${item.weightKg}kg` : ''}</p>}
                        {item.cutInstructions && <p className="text-xs text-muted-foreground">{item.cutInstructions}</p>}
                      </div>
                      <span className="text-sm font-semibold">${(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Tip */}
                <div>
                  <Label className="mb-2 block text-sm">Tip for Store Staff</Label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map(t => (
                      <button
                        key={t}
                        onClick={() => setTip(t)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${tip === t ? 'border-primary bg-primary/5 text-primary' : 'border-border/50'}`}
                      >
                        {t === 0 ? 'None' : `$${t}`}
                      </button>
                    ))}
                    <input
                      type="number"
                      placeholder="Custom"
                      className="flex-1 px-2 py-2 rounded-xl border border-border/50 text-sm text-center focus:outline-none focus:border-primary"
                      min="0"
                      step="0.5"
                      onChange={e => setTip(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="mb-2 block text-sm">Order Notes (optional)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions for the store..." className="rounded-xl resize-none" rows={2} />
                </div>

                {/* Fee breakdown */}
                <div className="bg-card border border-border/50 rounded-2xl p-5">
                  <FeeBreakdown rows={feeRows} total={total} hasMeat={hasMeat} />
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-sm">Payment Method</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'online'}
                      onChange={() => setPaymentMethod('online')}
                    />
                    {orderType === 'DELIVERY' ? 'Pay Online (Card)' : 'Pay Now Online'}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      disabled={orderType !== 'DELIVERY'}
                    />
                    Cash on Delivery
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'pay_at_store'}
                      onChange={() => setPaymentMethod('pay_at_store')}
                      disabled={orderType === 'DELIVERY'}
                    />
                    Pay at Store
                  </label>
                </div>

                {stripeUsableKey?.startsWith('pk_test_') && paymentMethod === 'online' && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    🧪 TEST MODE — No real charges. Card: 4242 4242 4242 4242 | Expiry: 12/34 | CVC: 123
                  </div>
                )}

                {/* Stripe Payment Element — when publishable key is configured */}
                {stripeUsableKey && paymentMethod === 'online' ? (
                  <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-sm">Secure card payment</h3>
                    </div>
                    {intentLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Preparing payment…
                      </div>
                    )}
                    {intentError && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex flex-wrap items-center gap-2">
                        <span>{intentError}</span>
                        <Button type="button" variant="outline" size="sm" className="rounded-lg h-8" onClick={() => { setIntentError(null); setStep(2); }}>
                          Back &amp; retry
                        </Button>
                      </div>
                    )}
                    <div ref={paymentMountRef} className="min-h-[120px] rounded-xl border border-border/50 p-3 bg-background" />
                    {cardError && (
                      <p className="text-sm text-destructive">{cardError}</p>
                    )}
                    <Button
                      type="button"
                      onClick={() => void confirmStripeOrder()}
                      disabled={payBusy || intentLoading || !clientSecret || !paymentIntentId}
                      className="w-full hg-gradient-primary border-0 text-white rounded-xl h-12 font-semibold gap-2"
                    >
                      {payBusy ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing payment…</>
                      ) : (
                        <>🔒 Pay ${total.toFixed(2)} now</>
                      )}
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Total is verified on our server before you are charged.
                    </p>
                  </div>
                ) : null}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
                  {paymentMethod === 'online' && !stripeUsableKey && (
                    <Button
                      type="button"
                      onClick={() => {
                        console.error('Missing/invalid VITE_STRIPE_PUBLISHABLE_KEY for online checkout.');
                        toast.error('Online payment unavailable. Configure a valid pk_ Stripe publishable key.');
                      }}
                      className="flex-1 rounded-xl h-12"
                      variant="outline"
                    >
                      Online payment unavailable
                    </Button>
                  )}
                  {paymentMethod !== 'online' && (
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={placeOrder.isPending}
                      className="flex-1 hg-gradient-primary border-0 text-white rounded-xl h-12 font-semibold"
                    >
                      {placeOrder.isPending ? 'Placing Order...' : `Place Order · $${total.toFixed(2)}`}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 4: CONFIRMATION */}
            {step === 4 && confirmedOrder && (
              <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 py-8">
                <div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    className="w-20 h-20 rounded-full hg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-lg"
                  >
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </motion.div>
                  <h2 className="font-serif text-3xl font-bold text-foreground">Order Placed!</h2>
                  <p className="text-muted-foreground mt-1">Alhamdulillah — your halal order is confirmed</p>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Order Number</p>
                    <p className="font-serif text-2xl font-bold text-primary">#{confirmedOrder.orderNumber}</p>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Show QR at pickup counter</p>
                    <QRCodeDisplay value={confirmedOrder.id} orderId={confirmedOrder.orderNumber} size={160} />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button onClick={() => setLocation(`/orders/${confirmedOrder.id}`)} className="w-full hg-gradient-primary border-0 text-white rounded-xl h-12 font-semibold">
                    Track My Order
                  </Button>
                  <Button variant="outline" onClick={() => setLocation('/')} className="w-full rounded-xl">
                    Return to Home
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
