import { useRef, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { X, ShoppingBag, Trash2, Plus, Minus, ChevronRight, Store, ShoppingCart, Zap, RefreshCw, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CartItem } from '@/contexts/CartContext';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

/* ── Replace-with-similar mini modal inside the drawer ── */
function DrawerReplaceModal({ item, onClose }: { item: CartItem; onClose: () => void }) {
  const { addItem, removeItem } = useCart();
  const slug = item.product.slug || item.product.id;
  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['products', slug, 'related', 'drawer-replace'],
    queryFn: () => api.get(`/products/${slug}/related?limit=8`),
    enabled: !!slug,
  });
  const products = data?.products ?? [];

  const handleSwap = (replacement: Product) => {
    const qty = item.quantity;
    removeItem(item.product.id);
    addItem(replacement, qty, {});
    onClose();
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 bg-background z-10 flex flex-col"
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">Replace item</h3>
          <p className="text-xs text-muted-foreground truncate">"{item.product.name}"</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No similar products found.</p>
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
                      <img src={img} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold line-clamp-2 leading-tight">{p.name}</p>
                    <p className="text-xs text-primary font-bold mt-1">${p.price?.toFixed(2)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Similar Products strip ── */
function DrawerSimilarProducts({ seedSlugs }: { seedSlugs: string[] }) {
  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['products', seedSlugs.join(','), 'related', 'drawer'],
    queryFn: async () => {
      const results = await Promise.all(
        seedSlugs.slice(0, 3).map(slug =>
          api.get<{ products: Product[] }>(`/products/${slug}/related?limit=5`)
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
      return { products: merged.slice(0, 10) };
    },
    enabled: seedSlugs.length > 0,
  });

  const products = data?.products ?? [];
  if (!seedSlugs[0]) return null;
  if (!isLoading && products.length === 0) return null;

  return (
    <div className="px-4 pt-3 pb-4 border-t border-border/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">You might also like</p>
      {isLoading ? (
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-32 h-44 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
          {products.map(p => (
            <div key={p.id} className="flex-shrink-0 w-32 snap-start">
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
    </div>
  );
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, itemCount, subtotal, removeItem, updateQuantity, storeName, storeSlug } = useCart();
  const [, setLocation] = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [replaceItem, setReplaceItem] = useState<CartItem | null>(null);

  const goToCheckout = () => {
    onClose();
    setLocation('/cart');
  };

  const goToStore = () => {
    if (storeSlug) {
      onClose();
      setLocation(`/stores/${storeSlug}`);
    }
  };

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  /* Lock body scroll */
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  /* Reset replace panel on drawer close */
  useEffect(() => {
    if (!open) setReplaceItem(null);
  }, [open]);

  const convenienceFee = items.length > 0 ? 2.99 : 0;
  const total = subtotal + convenienceFee;
  const seedSlugs = items.map(i => i.product.slug).filter(Boolean);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:max-w-[420px] z-[61] bg-background flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Replace-item overlay panel */}
            <AnimatePresence>
              {replaceItem && (
                <DrawerReplaceModal item={replaceItem} onClose={() => setReplaceItem(null)} />
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 shrink-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  <h2 className="font-serif font-bold text-lg">Your Cart</h2>
                  {itemCount > 0 && (
                    <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </div>
                {storeName && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Store className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">from <span className="font-medium text-foreground">{storeName}</span></span>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                  <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-5">
                    <ShoppingCart className="w-10 h-10 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-serif font-bold text-lg mb-1">Your cart is empty</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-[220px]">Add items from a certified halal store near you</p>
                  <Link href="/" onClick={onClose}>
                    <Button className="rounded-xl hg-gradient-primary border-0 text-white gap-2">
                      <Store className="w-4 h-4" /> Browse Stores
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="px-4 py-4 space-y-3">
                    <AnimatePresence initial={false}>
                      {items.map((item) => {
                        const img = item.product.images?.[0] || (item.product as any).imageUrl || '';
                        const itemTotal = item.product.price * item.quantity;
                        return (
                          <motion.div
                            key={item.product.id}
                            layout
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-start gap-3 bg-card rounded-2xl border border-border/40 p-3 hover:border-border/70 transition-colors"
                          >
                            {/* Image */}
                            <div className="w-[68px] h-[68px] rounded-xl bg-muted overflow-hidden shrink-0">
                              {img ? (
                                <img src={img} alt={item.product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                  {item.product.productType === 'FRESH_MEAT' ? '🥩' : item.product.productType === 'PRODUCE' ? '🥬' : item.product.productType === 'SPICES' ? '🌶️' : '🛒'}
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm leading-tight line-clamp-2 mb-0.5">{item.product.name}</p>
                              {item.selectedCut && (
                                <p className="text-[11px] text-primary font-medium">{item.selectedCut}</p>
                              )}
                              <p className="text-xs text-muted-foreground">{item.product.unit}</p>

                              <div className="flex items-center justify-between mt-2.5">
                                {/* Qty controls */}
                                <div className="flex items-center gap-0 bg-muted/60 rounded-full">
                                  <button
                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-colors"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-bold min-w-[20px] text-center">{item.quantity}</span>
                                  <button
                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center hg-gradient-primary text-white hover:opacity-90 transition-opacity"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sm">${itemTotal.toFixed(2)}</span>
                                  <button
                                    onClick={() => setReplaceItem(item)}
                                    title="Replace with similar"
                                    className="w-6 h-6 rounded-full hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => removeItem(item.product.id)}
                                    className="w-6 h-6 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {/* Express pickup banner */}
                    <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-xl px-3 py-2.5">
                      <Zap className="w-4 h-4 text-primary shrink-0" />
                      <p className="text-xs font-medium text-primary">Express pickup ready in ~20 min</p>
                    </div>

                    {/* Add more products */}
                    {storeSlug && (
                      <button
                        onClick={goToStore}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add more products from {storeName || 'store'}
                      </button>
                    )}
                  </div>

                  {/* Similar Products */}
                  <DrawerSimilarProducts seedSlugs={seedSlugs} />
                </>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-5 pt-3 pb-5 border-t border-border/50 bg-background space-y-3 shrink-0">
                {/* Fee breakdown */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Convenience fee</span>
                    <span className="font-medium">${convenienceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-1.5">
                    <span>Estimated total</span>
                    <span className="text-primary">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <Button
                  type="button"
                  onClick={goToCheckout}
                  className="w-full hg-gradient-primary border-0 text-white rounded-2xl h-13 text-base font-bold gap-2 shadow-lg shadow-primary/25"
                  style={{ height: 52 }}
                >
                  Go to Checkout · ${total.toFixed(2)}
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <Link href="/cart" onClick={onClose}>
                  <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                    View full cart
                  </button>
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
