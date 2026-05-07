import { useParams, Link } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart, ArrowLeft, Star, Shield, Package, Clock, Store,
  CheckCircle2, AlertTriangle, Tag, ChevronRight, Minus, Plus, Zap, Truck, Heart,
  ChevronLeft, PenLine, UserCircle2, MessageSquare,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';
import { useToggleSaved } from '@/lib/saves';
import { ProductCard } from '@/components/ProductCard';
import { ReviewModal } from '@/components/ReviewModal';
import { formatDistanceToNow } from 'date-fns';

interface SiteReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

function StockBadge({ qty, threshold }: { qty: number; threshold?: number | null }) {
  if (qty === 0) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Out of Stock</Badge>;
  if (threshold && qty <= threshold) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><AlertTriangle className="w-3 h-3" /> Low Stock ({qty} left)</Badge>;
  return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> In Stock</Badge>;
}

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';
  const { items, addItem, updateQuantity, setStoreInfo, updateNote } = useCart();

  const cartItem = items.find(i => i.product.slug === slug || i.product.id === slug);
  const cartQty = cartItem?.quantity ?? 0;

  const [activeImg, setActiveImg] = useState(0);
  const [zoom, setZoom] = useState<{ active: boolean; x: number; y: number }>({ active: false, x: 50, y: 50 });
  const [paused, setPaused] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [, navigate] = useLocation();
  const slideshowRef = useRef<HTMLDivElement>(null);

  const { data: product, isLoading, isError } = useQuery<Product & {
    store?: { id: string; slug: string; name: string; city: string; rating?: number; avgPrepTimeMinutes?: number };
    comparePrice?: number; barcode?: string; sku?: string;
    lowStockThreshold?: number; nutritionJson?: unknown;
    nameUrdu?: string; nameArabic?: string;
  }>({
    queryKey: ['product', slug],
    queryFn: () => api.get<any>(`/products/${slug}`),
    enabled: !!slug,
  });

  const { data: productReviews = [], refetch: refetchProductReviews } = useQuery<SiteReview[]>({
    queryKey: ['site-reviews', 'product', slug],
    queryFn: () => api.get<SiteReview[]>(`/site-reviews/product/${slug}`),
    enabled: !!slug,
  });

  // ── Hooks must be called unconditionally on every render. Keep all hook
  // calls above the early returns below to avoid "Rendered more hooks than
  // during the previous render" when the product transitions loading→loaded.
  const saved = useToggleSaved(product?.id);

  const realImagesAll = (product?.images || []).filter(u => u && u.trim());
  const slideCount = realImagesAll.length;

  // Auto-advance the slideshow every 4s when there's more than one image
  // and the user isn't hovering / touching the slideshow.
  useEffect(() => {
    if (slideCount <= 1 || paused) return;
    const id = window.setInterval(() => {
      setActiveImg(i => (i + 1) % slideCount);
    }, 4000);
    return () => window.clearInterval(id);
  }, [slideCount, paused]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="space-y-3">
            <div className="aspect-square rounded-3xl bg-muted animate-pulse" />
            <div className="flex gap-2">{[1,2,3].map(i => <div key={i} className="w-16 h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          </div>
          <div className="space-y-4">
            {[80, 50, 60, 40, 100, 70, 90].map((w, i) => (
              <div key={i} className="h-5 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <Package className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="font-serif font-bold text-2xl mb-2">Product Not Found</h2>
        <p className="text-muted-foreground mb-6">This product may no longer be available.</p>
        <Link href="/"><Button variant="outline" className="rounded-xl">Browse Stores</Button></Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (product.store) setStoreInfo(product.store.id, product.store.slug, product.store.name);
    addItem(product as unknown as Product, 1);
    toast.success(`${product.name} added to cart!`);
  };

  const handleIncrease = () => {
    if (product.store) setStoreInfo(product.store.id, product.store.slug, product.store.name);
    if (cartQty === 0) addItem(product as unknown as Product, 1);
    else updateQuantity(product.id, cartQty + 1);
  };

  const handleDecrease = () => {
    updateQuantity(product.id, cartQty - 1);
  };

  const handleToggleSaved = () => {
    if (!saved.isAuthenticated) {
      toast.info('Sign in to save items to your list');
      navigate('/login');
      return;
    }
    saved.toggle();
  };

  const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#f1f5f1"/><g fill="#9ca39c" font-family="system-ui,sans-serif" text-anchor="middle"><text x="300" y="295" font-size="64">📦</text><text x="300" y="360" font-size="22">No image available</text></g></svg>`
  );
  const images = realImagesAll.length ? realImagesAll : [PLACEHOLDER_IMG];
  const safeIndex = activeImg < images.length ? activeImg : 0;
  const mainImage = images[safeIndex] || PLACEHOLDER_IMG;

  const goPrev = () => setActiveImg(i => (slideCount === 0 ? 0 : (i - 1 + slideCount) % slideCount));
  const goNext = () => setActiveImg(i => (slideCount === 0 ? 0 : (i + 1) % slideCount));
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://numafresh.com';

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: product.name, description: product.description || undefined,
    image: mainImage ? [mainImage] : undefined,
    sku: (product as any).sku || undefined,
    offers: {
      '@type': 'Offer', price: product.price, priceCurrency: 'USD',
      availability: product.stockQty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    brand: { '@type': 'Brand', name: product.store?.name || 'Numa Fresh' },
  };

  const discount = (product as any).comparePrice && (product as any).comparePrice > product.price
    ? Math.round((1 - product.price / (product as any).comparePrice) * 100)
    : null;

  return (
    <>
      <Helmet>
        <title>{product.name} | Numa Fresh Halal Grocery</title>
        <meta name="description" content={product.description || `Buy ${product.name} from Numa Fresh — premium certified halal grocery.`} />
        <link rel="canonical" href={`${siteUrl}/products/${slug}`} />
        <meta property="og:title" content={product.name} />
        {mainImage && <meta property="og:image" content={mainImage} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/" className="hover:text-foreground transition-colors">Stores</Link>
          {product.store && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link href={`/stores/${product.store.slug}`} className="hover:text-foreground transition-colors">{product.store.name}</Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>

        <Link href={product.store ? `/stores/${product.store.slug}` : '/'}>
          <Button variant="ghost" size="sm" className="gap-1.5 mb-5 -ml-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Products
          </Button>
        </Link>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
          {/* ── LEFT: Images ── */}
          <div className="space-y-3">
            {/* Main image — slideshow with hover zoom */}
            <div
              ref={slideshowRef}
              className="relative aspect-square rounded-3xl overflow-hidden bg-muted/20 border border-border/40 group cursor-zoom-in"
              onMouseEnter={() => { setPaused(true); setZoom(z => ({ ...z, active: true })); }}
              onMouseLeave={() => { setPaused(false); setZoom(z => ({ ...z, active: false })); }}
              onMouseMove={e => {
                const el = slideshowRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setZoom({ active: true, x, y });
              }}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => setPaused(false)}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={safeIndex}
                  src={mainImage}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 ease-out will-change-transform"
                  style={{
                    transform: zoom.active ? 'scale(1.6)' : 'scale(1)',
                    transformOrigin: `${zoom.x}% ${zoom.y}%`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                  draggable={false}
                />
              </AnimatePresence>

              {/* Overlays */}
              {discount && (
                <div className="absolute top-4 left-4 pointer-events-none">
                  <span className="bg-red-500 text-white font-bold text-sm px-3 py-1.5 rounded-xl shadow-lg">
                    -{discount}% OFF
                  </span>
                </div>
              )}
              <button
                onClick={handleToggleSaved}
                disabled={saved.pending}
                aria-label={saved.isSaved ? 'Remove from saved' : 'Save for later'}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm border border-border/40 flex items-center justify-center shadow hover:scale-110 transition-transform disabled:opacity-70 z-10"
              >
                <Heart className={`w-5 h-5 ${saved.isSaved ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </button>

              {/* Prev/Next — only when >1 image */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-border/40 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-border/40 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>

                  {/* Dot indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1.5 z-10">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImg(i)}
                        aria-label={`Go to image ${i + 1}`}
                        className={`rounded-full transition-all ${
                          i === safeIndex ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/90'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.slice(0, 5).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImg === i ? 'border-primary shadow-md' : 'border-border/40 hover:border-border/80'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Halal cert guarantee */}
            {product.isHalalCertified && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Halal Certified</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Verified by ISNA / IFANCA standards</p>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Sticky info panel ── */}
          <div>
            <div className="sticky top-24 space-y-5">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize rounded-lg">{product.category}</Badge>
                {product.isHalalCertified && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-xs rounded-lg">
                    <Shield className="w-3 h-3" /> Halal
                  </Badge>
                )}
                <StockBadge qty={product.stockQty} threshold={(product as any).lowStockThreshold} />
              </div>

              {/* Name */}
              <div>
                <h1 className="font-serif font-bold text-2xl sm:text-3xl leading-tight mb-1">{product.name}</h1>
                {(product as any).nameUrdu && (
                  <p className="text-xl text-muted-foreground font-medium" dir="rtl">{(product as any).nameUrdu}</p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-primary">${product.price.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">/ {product.unit}</span>
                {(product as any).comparePrice && (product as any).comparePrice > product.price && (
                  <span className="text-xl text-muted-foreground line-through">${((product as any).comparePrice).toFixed(2)}</span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
              )}

              {/* Store card */}
              {product.store && (
                <Link href={`/stores/${product.store.slug}`}>
                  <div className="flex items-center gap-3 bg-muted/40 border border-border/40 rounded-2xl px-4 py-3 hover:border-primary/30 hover:bg-muted/60 transition-all cursor-pointer mb-5">
                    <div className="w-10 h-10 rounded-xl hg-gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {product.store.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{product.store.name}</p>
                      <p className="text-xs text-muted-foreground">{product.store.city}</p>
                    </div>
                    {product.store.rating && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {product.store.rating.toFixed(1)}
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              )}

              {/* Pickup info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">Express Pickup</p>
                    <p className="text-[10px] text-muted-foreground">~{product.store?.avgPrepTimeMinutes ?? 20} min</p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">Curbside</p>
                    <p className="text-[10px] text-muted-foreground">Available</p>
                  </div>
                </div>
              </div>

              {/* Add to Cart — Instacart-style */}
              <div className="space-y-3">
                {cartQty === 0 ? (
                  <Button
                    className="w-full hg-gradient-primary border-0 text-white rounded-2xl gap-2 font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                    style={{ height: 52, fontSize: '1rem' }}
                    disabled={product.stockQty === 0}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart · ${product.price.toFixed(2)}
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0 bg-primary rounded-2xl overflow-hidden shadow-lg shadow-primary/25 flex-1" style={{ height: 52 }}>
                      <button
                        onClick={handleDecrease}
                        className="flex-none w-14 h-full flex items-center justify-center text-white hover:bg-white/20 transition-colors text-xl font-bold"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <div className="flex-1 text-center">
                        <span className="text-white font-bold text-xl">{cartQty}</span>
                        <p className="text-white/70 text-[10px]">in cart</p>
                      </div>
                      <button
                        onClick={handleIncrease}
                        className="flex-none w-14 h-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <Link href="/checkout">
                      <Button variant="outline" className="rounded-2xl h-[52px] px-5 border-primary/30 text-primary hover:bg-primary/5 font-semibold whitespace-nowrap">
                        Checkout →
                      </Button>
                    </Link>
                  </div>
                )}
                {cartQty > 0 && (
                  <p className="text-center text-sm text-primary font-medium">
                    ${(product.price * cartQty).toFixed(2)} subtotal ({cartQty} in cart)
                  </p>
                )}

                {/* Note for shopper — Round 10 / Fix #4 */}
                {cartQty > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <label htmlFor="note-for-shopper" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      📝 Note for shopper <span className="text-muted-foreground/60 font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="note-for-shopper"
                      value={cartItem?.noteForShopper ?? ''}
                      onChange={e => updateNote(product.id, e.target.value)}
                      placeholder="e.g. pick the ripest, no bruises please"
                      maxLength={280}
                      rows={2}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="text-[10px] text-muted-foreground/70 text-right">
                      {(cartItem?.noteForShopper?.length ?? 0)}/280
                    </p>
                  </div>
                )}
              </div>

              {/* Product details */}
              <div className="border-t border-border/50 pt-4 space-y-2">
                {(product as any).sku && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground w-24 shrink-0">SKU</span>
                    <span className="font-mono">{(product as any).sku}</span>
                  </div>
                )}
                {product.meatAnimalType && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground w-24 shrink-0">Meat Type</span>
                    <span className="capitalize">{product.meatAnimalType}</span>
                  </div>
                )}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex gap-2 text-xs items-start">
                    <span className="text-muted-foreground w-24 shrink-0 pt-0.5">Tags</span>
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((tag, i) => (
                        <span key={i} className="bg-muted rounded-full px-2 py-0.5">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Full Product Details */}
              {(product as any).productDetails && (
                <div className="bg-muted/30 rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-primary" /> Product Details
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{(product as any).productDetails}</p>
                </div>
              )}

              {/* Ingredients */}
              {(product as any).ingredients && (
                <div className="bg-muted/30 rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Ingredients
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{(product as any).ingredients}</p>
                </div>
              )}

              {/* Usage / Cooking Directions */}
              {(product as any).directions && (
                <div className="bg-muted/30 rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Usage & Directions
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{(product as any).directions}</p>
                </div>
              )}

              {/* Nutrition */}
              {(product as any).nutritionJson && typeof (product as any).nutritionJson === 'object' && Object.keys((product as any).nutritionJson as object).length > 0 && (
                <div className="bg-muted/30 rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Nutrition Facts
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries((product as any).nutritionJson as Record<string, unknown>).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs border-b border-border/30 pb-1.5">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Similar Products — full-width, outside the 2-col grid */}
      <RelatedProducts slug={slug} />

      {/* ── COMMUNITY REVIEWS ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-primary mb-0.5">Community</p>
            <h3 className="font-serif text-xl font-bold">Product Reviews</h3>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={() => setShowReviewModal(true)}>
            <PenLine className="w-3.5 h-3.5" /> Write a Review
          </Button>
        </div>

        {productReviews.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border">
            <MessageSquare className="w-10 h-10 text-muted-foreground/25 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No reviews yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-4">Share your experience to help other shoppers.</p>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs" onClick={() => setShowReviewModal(true)}>
              <PenLine className="w-3.5 h-3.5" /> Be the first to review
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {productReviews.map(r => (
              <div key={r.id} className="bg-card rounded-2xl border border-border/50 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full hg-gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {r.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{r.authorName}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'}`} />)}
                  </div>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground leading-relaxed">"{r.comment}"</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Review modal */}
      {showReviewModal && (
        <ReviewModal
          targetType="product"
          productSlug={slug}
          targetName={product?.name}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => refetchProductReviews()}
        />
      )}
    </>
  );
}

function RelatedProducts({ slug }: { slug: string }) {
  const { items, addItem, updateQuantity, setStoreInfo } = useCart();
  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['products', slug, 'related'],
    queryFn: () => api.get(`/products/${slug}/related?limit=10`),
    enabled: !!slug,
  });

  const products = data?.products ?? [];
  if (!isLoading && products.length === 0) return null;

  const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f1f5f1"/><text x="50" y="58" font-size="32" text-anchor="middle" fill="#9ca39c">📦</text></svg>`
  );

  return (
    <section className="border-t border-border/50 mt-2 pt-8 pb-10 bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Similar Products</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Compare prices across stores</p>
          </div>
          <span className="text-[11px] font-medium text-primary/60 bg-primary/8 border border-primary/15 px-2.5 py-1 rounded-full">
            {products.length} result{products.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map(p => {
              const cartItem = items.find(i => i.product.id === p.id);
              const qty = cartItem?.quantity ?? 0;
              const realImg = (p.images || []).find(u => u && u.trim()) || (p as any).imageUrl;
              const img = realImg || PLACEHOLDER_IMG;
              const pStore = (p as any).store;
              const discount = p.comparePrice && p.comparePrice > p.price
                ? Math.round((1 - p.price / p.comparePrice) * 100) : null;

              const handleAdd = (e: React.MouseEvent) => {
                e.preventDefault(); e.stopPropagation();
                if (pStore?.id) setStoreInfo(pStore.id, pStore.slug, pStore.name);
                addItem(p, 1);
              };
              const handleInc = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); addItem(p, 1); };
              const handleDec = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(p.id, qty - 1); };

              return (
                <div
                  key={p.id}
                  className={`group flex items-start gap-3 bg-card border rounded-xl p-2.5 transition-all duration-200 hover:shadow-md hover:-translate-y-px ${qty > 0 ? 'border-primary/35 shadow-sm shadow-primary/10' : 'border-border/50 hover:border-border'}`}
                >
                  {/* Thumbnail */}
                  <Link href={`/products/${p.slug || p.id}`} className="shrink-0 mt-0.5">
                    <div className="w-[62px] h-[62px] rounded-lg overflow-hidden bg-muted/40 border border-border/30">
                      <img
                        src={img}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                      />
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <Link href={`/products/${p.slug || p.id}`}>
                      <p className="text-[13px] font-medium leading-snug line-clamp-2 hover:text-primary transition-colors">{p.name}</p>
                    </Link>
                    {pStore?.name && (
                      <Link href={`/stores/${pStore.slug}`}>
                        <p className="text-[11px] text-muted-foreground hover:text-primary/70 transition-colors truncate">{pStore.name}</p>
                      </Link>
                    )}
                    <div className="flex items-center flex-wrap gap-1 mt-1">
                      <span className="font-bold text-sm">${p.price.toFixed(2)}</span>
                      {p.comparePrice && p.comparePrice > p.price && (
                        <span className="text-[11px] text-muted-foreground line-through">${p.comparePrice.toFixed(2)}</span>
                      )}
                      {discount && (
                        <span className="text-[10px] font-bold bg-red-500 text-white px-1 py-0.5 rounded shrink-0">-{discount}%</span>
                      )}
                    </div>
                  </div>

                  {/* Cart */}
                  <div className="shrink-0 self-center">
                    <AnimatePresence mode="wait">
                      {qty === 0 ? (
                        <motion.button
                          key="add"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          onClick={handleAdd}
                          disabled={p.stockQty === 0}
                          className="w-8 h-8 rounded-full hg-gradient-primary text-white flex items-center justify-center shadow shadow-primary/30 hover:shadow-md hover:scale-105 transition-all disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </motion.button>
                      ) : (
                        <motion.div
                          key="qty"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center bg-primary rounded-full overflow-hidden shadow shadow-primary/30"
                        >
                          <button onClick={handleDec} className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-white font-bold text-xs min-w-[18px] text-center">{qty}</span>
                          <button onClick={handleInc} className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
