import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Minus, Plus, Trash2, ShoppingBag, X, ChevronRight,
  CheckCircle2, Truck, Zap, Car, Clock, RefreshCw, Shield, User, Store, MapPin,
  AlertCircle, Navigation, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateOrder } from '@/hooks/useOrders';
import { usePickupSlots } from '@/hooks/useStores';
import { useAddresses } from '@/hooks/useUser';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ChooseReplacementModal } from '@/components/ChooseReplacementModal';
import type { CartItem } from '@/contexts/CartContext';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { motion } from 'framer-motion';

const CATEGORY_FALLBACKS: Record<string, string> = {
  'Fresh Meat': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=100&q=80',
  'Spices & Seasonings': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=100&q=80',
  'Rice & Grains': 'https://images.unsplash.com/photo-1536304993881-ff86e0c9ef3b?w=100&q=80',
  'Fresh Produce': 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=100&q=80',
  'Dairy & Eggs': 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=100&q=80',
};
const DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=80';

const ORDER_TYPES = [
  { value: 'EXPRESS_PICKUP', label: 'Express Pickup', desc: 'Ready in ~25 min', fee: 0, icon: Zap },
  { value: 'SCHEDULED_PICKUP', label: 'Scheduled Pickup', desc: 'Choose a slot', fee: 0, icon: Clock },
  { value: 'CURBSIDE', label: 'Curbside', desc: 'We bring it out', fee: 1.49, icon: Car },
  { value: 'DELIVERY', label: 'Home Delivery', desc: 'Delivered to you', fee: 4.99, icon: Truck },
];

const TIP_OPTIONS = [0, 1, 2, 3, 5];

const REPLACEMENT_LABELS: Record<string, string> = {
  specific: 'Specific replacement chosen',
  best_match: 'Replace with best match',
  refund: 'Refund if out of stock',
};

export default function CartPage() {
  const { items, storeId, storeSlug, storeName, updateQuantity, removeItem, clearCart, subtotal, itemCount } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [orderType, setOrderType] = useState('EXPRESS_PICKUP');
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [pickupSlotId, setPickupSlotId] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: true; orderNumber: string; orderId: string } | { success: false; errorMsg: string } | null>(null);
  // Round 10 / Fix #8 — active "swap with related" modal
  const [swapItem, setSwapItem] = useState<CartItem | null>(null);
  const [replacementItem, setReplacementItem] = useState<CartItem | null>(null);

  const { data: slots } = usePickupSlots(storeSlug || '');
  const { data: savedAddresses } = useAddresses();

  // Auto-fill delivery address with the default saved address when switching to DELIVERY
  const defaultAddress = savedAddresses?.find((a: any) => a.isDefault);
  const defaultAddressString = defaultAddress
    ? [defaultAddress.line1 || defaultAddress.street, defaultAddress.city, defaultAddress.province, defaultAddress.postalCode].filter(Boolean).join(', ')
    : '';

  // When user selects DELIVERY and no address is entered yet, pre-fill with default
  const prevOrderType = useRef(orderType);
  useEffect(() => {
    if (orderType === 'DELIVERY' && prevOrderType.current !== 'DELIVERY' && !deliveryAddress && defaultAddressString) {
      setDeliveryAddress(defaultAddressString);
    }
    prevOrderType.current = orderType;
  }, [orderType, defaultAddressString]);
  const { data: storeProductsData } = useQuery<{ products: Product[] }>({
    queryKey: ['store-products-replacement', storeSlug],
    queryFn: () => api.get(`/stores/${storeSlug}/products?limit=50`),
    enabled: !!storeSlug,
  });
  const storeProducts = storeProductsData?.products || [];

  const createOrder = useCreateOrder();

  const selectedType = ORDER_TYPES.find(t => t.value === orderType) || ORDER_TYPES[0];
  const convenienceFee = 2.99;
  const effectiveTip = tip === -1 ? parseFloat(customTip) || 0 : tip;
  const total = subtotal + convenienceFee + selectedType.fee + effectiveTip;
  const savings = 0;

  const slotsByDate: Record<string, typeof slots> = {};
  slots?.forEach(slot => {
    const dateStr = new Date(slot.date).toLocaleDateString('en-CA');
    if (!slotsByDate[dateStr]) slotsByDate[dateStr] = [];
    slotsByDate[dateStr]!.push(slot);
  });

  const handleRemove = (id: string) => {
    setRemovingId(id);
    setTimeout(() => { removeItem(id); setRemovingId(null); }, 280);
  };

  const handlePlaceOrder = () => {
    if (!user) { setLocation('/login'); return; }
    if (!storeId) return;
    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      toast({ title: 'Delivery address required', description: 'Please enter your delivery address.', variant: 'destructive' });
      return;
    }
    setShowConfirm(true);
  };

  /** Multi-step checkout with Stripe card payment (same cart; `/checkout` page). */
  const handleProceedToCheckout = () => {
    if (!user) {
      setLocation('/login?next=/checkout');
      return;
    }
    if (!storeId || items.length === 0) return;
    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      toast({ title: 'Delivery address required', description: 'Please enter your delivery address for delivery orders.', variant: 'destructive' });
      return;
    }
    setLocation('/checkout');
  };

  // Map frontend order type values to DB enum values
  const DB_ORDER_TYPE_MAP: Record<string, string> = {
    EXPRESS_PICKUP: 'EXPRESS_PICKUP',
    SCHEDULED_PICKUP: 'EXPRESS_PICKUP', // Stored as EXPRESS_PICKUP with pickupSlotId
    CURBSIDE: 'CURBSIDE_PICKUP',
    DELIVERY: 'STORE_DELIVERY',
  };

  const handleConfirmOrder = async () => {
    setShowConfirm(false);
    try {
      const dbOrderType = DB_ORDER_TYPE_MAP[orderType] || orderType;
      const order = await createOrder.mutateAsync({
        storeId,
        orderType: dbOrderType,
        items: items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          meatCutType: i.selectedCut,
          meatCutInstructions: i.cutInstructions,
          customerNote: i.noteForShopper || undefined,
          weightKg: i.weightKg,
        })),
        tip: effectiveTip,
        specialInstructions: [specialInstructions, orderType === 'DELIVERY' && deliveryAddress ? `Delivery to: ${deliveryAddress}` : ''].filter(Boolean).join(' | ') || undefined,
        pickupSlotId: pickupSlotId || undefined,
      });
      // clearCart() is called in the popup button handlers so the popup
      // renders before the cart empties (prevents early-return from hiding popup)
      setOrderResult({ success: true, orderNumber: order.orderNumber, orderId: order.id });
    } catch (err: any) {
      setOrderResult({ success: false, errorMsg: err.message || 'Something went wrong. Please try again.' });
    }
  };

  // Block Escape key while the success popup is visible
  useEffect(() => {
    if (!orderResult?.success) return;
    const block = (e: KeyboardEvent) => { if (e.key === 'Escape') e.stopImmediatePropagation(); };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [orderResult]);

  // ── Order Success Popup — rendered BEFORE empty-cart early return so it
  //    always appears even after clearCart() is eventually called ──────────
  if (orderResult?.success) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-4"
        style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className="bg-background border border-border/60 rounded-3xl w-full flex flex-col items-center text-center"
          style={{
            maxWidth: 420,
            width: '90vw',
            padding: 'clamp(24px, 6vw, 40px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          {/* Pulse icon */}
          <div className="relative flex items-center justify-center mb-5">
            <span
              className="absolute w-[72px] h-[72px] rounded-full bg-primary opacity-20 animate-ping"
              style={{ animationDuration: '1.8s' }}
            />
            <div className="relative w-[72px] h-[72px] rounded-full hg-gradient-primary flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-9 h-9 text-white" strokeWidth={2.5} />
            </div>
          </div>

          {/* Heading */}
          <h2
            className="font-serif font-bold mb-2"
            style={{ fontSize: 'clamp(1.1rem, 3vw, 1.375rem)' }}
          >
            Order Placed Successfully!
          </h2>

          {/* Sub-text with real order number */}
          <p className="text-muted-foreground text-sm leading-relaxed mb-7">
            Your order{' '}
            <span className="font-semibold text-foreground">#{orderResult.orderNumber}</span>{' '}
            has been placed and is being processed.
          </p>

          {/* Track Your Order */}
          <Button
            className="w-full hg-gradient-primary border-0 text-white font-semibold rounded-2xl gap-2 mb-3"
            style={{ height: 48 }}
            onClick={() => { clearCart(); setOrderResult(null); setLocation('/orders'); }}
          >
            <Package className="w-4 h-4" /> Track Your Order
          </Button>

          {/* Continue Shopping */}
          <Button
            variant="outline"
            className="w-full font-semibold rounded-2xl text-primary hover:bg-primary/5"
            style={{ height: 48, borderWidth: '1.5px', borderColor: 'hsl(var(--primary))' }}
            onClick={() => { clearCart(); setOrderResult(null); setLocation('/'); }}
          >
            <ShoppingBag className="w-4 h-4 mr-2" /> Continue Shopping
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Order Failure Popup ──────────────────────────────────────────────────
  if (orderResult && !orderResult.success) {
    return (
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
        style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-background rounded-3xl shadow-2xl w-full max-w-sm p-6 border border-border/60"
        >
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle className="w-9 h-9 text-destructive" />
            </div>
            <h2 className="font-serif font-bold text-xl mb-1 text-destructive">Order Failed</h2>
            <p className="text-sm text-muted-foreground">{(orderResult as any).errorMsg}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full hg-gradient-primary border-0 text-white rounded-2xl h-12 font-bold"
              onClick={() => { setOrderResult(null); setShowConfirm(true); }}
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-2xl h-11"
              onClick={() => { setOrderResult(null); setLocation('/cart'); }}
            >
              Go to Cart
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Empty cart screen ────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-16 px-4">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h2 className="font-serif font-bold text-2xl mb-2">Your Cart is Empty</h2>
          <p className="text-muted-foreground text-sm mb-8">Browse our halal grocery stores and add items to get started.</p>
          <div className="space-y-3">
            <Link href="/">
              <Button className="w-full hg-gradient-primary border-0 text-white h-11">
                Browse Stores <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* Estimate ready time */
  const now = new Date();
  const readyTime = new Date(now.getTime() + 25 * 60 * 1000);
  const readyLabel = readyTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      {/* ── Place Order Confirmation Dialog ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative z-10 bg-background rounded-3xl shadow-2xl w-full max-w-sm p-6 border border-border/60">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-full hg-gradient-primary flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h2 className="font-serif font-bold text-xl mb-1">Confirm Your Order</h2>
              <p className="text-sm text-muted-foreground">From <span className="font-semibold text-foreground">{storeName || 'store'}</span></p>
            </div>
            <div className="bg-muted/40 rounded-2xl px-4 py-3 space-y-2 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{itemCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fulfillment</span>
                <span className="font-medium">{selectedType.label}</span>
              </div>
              {orderType === 'DELIVERY' && deliveryAddress && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Deliver to</span>
                  <span className="font-medium text-right text-xs">{deliveryAddress}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border/30 pt-2 mt-1">
                <span>Total</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 hg-gradient-primary border-0 text-white rounded-2xl h-12 font-bold"
                disabled={createOrder.isPending}
                onClick={handleConfirmOrder}
              >
                {createOrder.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Place Order'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Popups (success/failure) are rendered as early returns above,
          before the empty-cart guard, so they always appear. */}

      {/* Replacement preference (out-of-stock policy) */}
      {replacementItem && (
        <ChooseReplacementModal
          item={replacementItem}
          storeProducts={storeProducts}
          onClose={() => setReplacementItem(null)}
        />
      )}

      {/* Round 10 / Fix #8 — active swap with related product */}
      {swapItem && (
        <ReplaceWithMatchModal
          item={swapItem}
          onClose={() => setSwapItem(null)}
        />
      )}

      <div className="min-h-screen bg-muted/10 pb-28 md:pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6">

          {/* ── Header ── */}
          <div className="flex items-center mb-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="font-semibold text-base">
                Personal {storeName ? `${storeName} ` : ''}Cart
              </h1>
              {user && (
                <p className="text-xs text-muted-foreground">Shopping for {user.firstName}</p>
              )}
            </div>
            <button className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
              <User className="h-5 w-5" />
            </button>
          </div>

          {/* ── Store bar ── */}
          <div className="bg-card rounded-2xl border border-border/40 px-4 py-3 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl hg-gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                {storeName ? storeName[0] : 'N'}
              </div>
              <div>
                <p className="font-semibold text-sm">{storeName || 'Numa Fresh'}</p>
                <p className="text-xs text-primary font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Ready by {readyLabel}
                </p>
              </div>
            </div>
            <span className="font-bold text-sm">${subtotal.toFixed(2)}</span>
          </div>

          {/* ── Items List ── */}
          <div className="bg-card rounded-2xl border border-border/40 overflow-hidden mb-4">
            <div className="divide-y divide-border/30">
              {items.map(item => {
                const imgSrc = item.product.images?.[0]
                  || CATEGORY_FALLBACKS[item.product.category]
                  || DEFAULT_FALLBACK;
                const isRemoving = removingId === item.product.id;
                const replacePref = item.replacementPreference;

                return (
                  <div
                    key={item.product.id}
                    className={`flex items-start gap-3 px-4 py-4 transition-all duration-280 ${isRemoving ? 'opacity-0 translate-x-4' : 'opacity-100'}`}
                  >
                    {/* Product image — clickable to detail */}
                    <Link href={`/products/${item.product.slug || item.product.id}`} className="shrink-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted">
                        <img
                          src={imgSrc}
                          alt={item.product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          onError={e => { (e.target as HTMLImageElement).src = DEFAULT_FALLBACK; }}
                        />
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/products/${item.product.slug || item.product.id}`}>
                        <p className="font-semibold text-sm leading-tight hover:text-primary transition-colors">{item.product.name}</p>
                      </Link>
                      <p className="text-sm text-muted-foreground mt-0.5">${item.product.price.toFixed(2)}</p>
                      {item.selectedCut && (
                        <p className="text-xs text-primary mt-0.5 font-medium">Cut: {item.selectedCut}</p>
                      )}
                      <button
                        onClick={() => setReplacementItem(item)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium mt-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {replacePref ? REPLACEMENT_LABELS[replacePref] : 'Choose replacement'}
                      </button>
                    </div>

                    {/* Right: Replace + Delete + Qty */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSwapItem(item)}
                          title="Replace with best match"
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(item.product.id)}
                          title="Remove"
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold min-w-[28px] text-center">{item.quantity} ct</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add more products */}
            {storeSlug && (
              <div className="border-t border-border/30 px-4 py-3">
                <button
                  onClick={() => setLocation(`/stores/${storeSlug}`)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
                >
                  <Store className="w-4 h-4" /> Add more products from {storeName || 'store'}
                </button>
              </div>
            )}

          </div>

          {/* ── Fulfillment selector ── */}
          <div className="bg-card rounded-2xl border border-border/40 overflow-hidden mb-4">
            <div className="px-4 pt-4 pb-2">
              <h2 className="font-semibold text-sm mb-3">How would you like your order?</h2>
              <div className="grid grid-cols-2 gap-2">
                {ORDER_TYPES.map(({ value, label, desc, fee, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setOrderType(value)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      orderType === value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${orderType === value ? 'bg-primary/15' : 'bg-muted/60'}`}>
                      <Icon className={`h-3.5 w-3.5 ${orderType === value ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${orderType === value ? 'text-primary' : ''}`}>{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fee > 0 ? `+$${fee.toFixed(2)} · ${desc}` : desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scheduled pickup slots */}
            {orderType === 'SCHEDULED_PICKUP' && slots && slots.length > 0 && (
              <div className="px-4 pb-4 pt-2 border-t border-border/30">
                <Label className="text-xs font-semibold mb-2 block">Select Pickup Time</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Object.entries(slotsByDate).slice(0, 3).map(([date, daySlots]) => (
                    <div key={date}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {daySlots?.filter(s => s.spotsLeft > 0).map(slot => (
                          <button key={slot.id} onClick={() => setPickupSlotId(slot.id)}
                            className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-all ${pickupSlotId === slot.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 hover:border-primary/40 text-muted-foreground'}`}>
                            {slot.startTime}–{slot.endTime}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery address */}
            {orderType === 'DELIVERY' && (
              <div className="px-4 pb-4 pt-2 border-t border-border/30">
                <Label className="text-xs font-semibold mb-2 flex items-center gap-1.5 block">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> Delivery Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder={defaultAddressString || "Enter delivery address"}
                  className={`rounded-xl ${!deliveryAddress.trim() ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                />
                {defaultAddressString && !deliveryAddress.trim() && (
                  <button
                    type="button"
                    onClick={() => setDeliveryAddress(defaultAddressString)}
                    className="mt-1.5 text-[11px] text-primary hover:underline text-left"
                  >
                    Use saved address: {defaultAddressString}
                  </button>
                )}
                {!defaultAddressString && !deliveryAddress.trim() && (
                  <p className="text-[11px] text-red-500 mt-1.5">Required for home delivery</p>
                )}
              </div>
            )}
          </div>

          {/* ── Tip ── */}
          <div className="bg-card rounded-2xl border border-border/40 px-4 py-4 mb-4">
            <h3 className="font-semibold text-sm mb-3">Add a tip for the store</h3>
            <div className="flex gap-1.5">
              {TIP_OPTIONS.map(amount => (
                <button key={amount} onClick={() => { setTip(amount); setCustomTip(''); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${tip === amount && tip !== -1 ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/30'}`}>
                  {amount === 0 ? 'None' : `$${amount}`}
                </button>
              ))}
              <button onClick={() => setTip(-1)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${tip === -1 ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/30'}`}>
                Custom
              </button>
            </div>
            {tip === -1 && (
              <div className="mt-2 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" min={0} step={0.5} value={customTip} onChange={e => setCustomTip(e.target.value)} placeholder="0.00" className="pl-6" />
              </div>
            )}
          </div>

          {/* ── Special Instructions ── */}
          <div className="bg-card rounded-2xl border border-border/40 px-4 py-4 mb-4">
            <Label className="font-semibold text-sm mb-1.5 block">Special Instructions</Label>
            <textarea
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              placeholder="Dietary notes, preferred cuts, allergies, etc."
              rows={2}
              className="w-full text-sm px-3 py-2 rounded-xl border border-border/60 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
          </div>

          {/* ── Order Summary ── */}
          <div className="bg-card rounded-2xl border border-border/40 px-4 py-4 mb-6">
            <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Convenience fee</span>
                <span>${convenienceFee.toFixed(2)}</span>
              </div>
              {selectedType.fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{selectedType.label} fee</span>
                  <span>${selectedType.fee.toFixed(2)}</span>
                </div>
              )}
              {effectiveTip > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Tip</span><span>${effectiveTip.toFixed(2)}</span></div>
              )}
              {savings > 0 && (
                <div className="mt-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex justify-between">
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><Shield className="w-3 h-3" /> You're saving</span>
                  <span className="text-sm font-bold text-emerald-700">-${savings.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-border/30 pt-2 mt-1">
                <span>Estimated total</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ── Checkout: Stripe on `/checkout` vs quick place-order on this page ── */}
          <div className="mb-4 space-y-3">
            <Button
              type="button"
              className="w-full hg-gradient-primary border-0 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/30"
              style={{ height: 56 }}
              onClick={handleProceedToCheckout}
            >
              Proceed to Checkout
              <ChevronRight className="w-5 h-5 ml-1 inline" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full font-semibold text-base rounded-2xl border-border/60"
              style={{ height: 52 }}
              disabled={createOrder.isPending}
              onClick={handlePlaceOrder}
            >
              {createOrder.isPending ? 'Placing order…' : `Place order here · $${total.toFixed(2)}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Halal certified · Secure checkout</p>
          </div>

          {/* Similar Products seeded by all cart items */}
          {items.length > 0 && (
            <CartSimilarProducts seedSlugs={items.map(i => i.product.slug).filter(Boolean)} />
          )}
        </div>
      </div>
    </>
  );
}

/* Round 10 / Fix #8 — modal to swap a cart item for a related product */
function ReplaceWithMatchModal({ item, onClose }: { item: CartItem; onClose: () => void }) {
  const { addItem, removeItem } = useCart();
  const slug = item.product.slug || item.product.id;
  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['products', slug, 'related', 'replace'],
    queryFn: () => api.get(`/products/${slug}/related?limit=12`),
    enabled: !!slug,
  });
  const products = data?.products ?? [];

  const handleSwap = (replacement: Product) => {
    const qty = item.quantity;
    const opts = {
      selectedCut: item.selectedCut,
      cutInstructions: item.cutInstructions,
      weightKg: item.weightKg,
    };
    removeItem(item.product.id);
    addItem(replacement, qty, opts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-background rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="min-w-0">
            <h3 className="font-semibold text-base">Replace with best match</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">Swapping "{item.product.name}"</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No similar products found right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const img = p.images?.[0];
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSwap(p)}
                    className="text-left rounded-2xl border border-border/40 hover:border-primary hover:shadow-md overflow-hidden transition-all bg-card"
                  >
                    <div className="aspect-square bg-muted">
                      {img ? (
                        <img src={img} alt={p.name} className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🛒</div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="text-xs font-semibold line-clamp-2 leading-tight">{p.name}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary">${Number(p.price).toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground">{p.unit}</span>
                      </div>
                      <span className="block text-[10px] text-primary font-medium mt-1">Tap to replace →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border/40 bg-background">
          <Button variant="outline" onClick={onClose} className="w-full rounded-xl">Cancel</Button>
        </div>
      </motion.div>
    </div>
  );
}

/* Similar Products on cart, seeded by all cart items */
function CartSimilarProducts({ seedSlugs }: { seedSlugs: string[] }) {
  const primarySlug = seedSlugs[0];
  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['products', seedSlugs.join(','), 'related', 'cart'],
    queryFn: async () => {
      const results = await Promise.all(
        seedSlugs.slice(0, 4).map(slug =>
          api.get<{ products: Product[] }>(`/products/${slug}/related?limit=6`)
            .catch(() => ({ products: [] }))
        )
      );
      const seen = new Set<string>();
      const merged: Product[] = [];
      for (const r of results) {
        for (const p of (r as any).products ?? []) {
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
        }
      }
      return { products: merged.slice(0, 12) };
    },
    enabled: seedSlugs.length > 0,
  });

  const products = data?.products ?? [];
  if (!primarySlug) return null;
  if (!isLoading && products.length === 0) return null;

  return (
    <section className="mt-8 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold">You might also like</h2>
        <span className="text-xs text-muted-foreground">Curated for you</span>
      </div>
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-40 h-56 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 snap-x snap-mandatory pr-8">
          {products.map(p => (
            <div key={p.id} className="shrink-0 w-40 sm:w-44 snap-start last:mr-4">
              <ProductCard
                product={p}
                storeId={(p as any).store?.id}
                storeSlug={(p as any).store?.slug}
                storeName={(p as any).store?.name}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
