import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  MapPin, Phone, Clock, Star, Truck, Package, ShieldCheck, Search, ChevronLeft,
  ShoppingCart, X, Info, Award, CheckCircle, Zap, ArrowRight, AlertTriangle,
  PenLine, UserCircle2, ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HalalBadge } from '@/components/HalalBadge';
import { StarRating } from '@/components/StarRating';
import { ProductCardSkeleton } from '@/components/LoadingSkeleton';
import { MeatCustomizerModal } from '@/components/MeatCustomizerModal';
import { CartDrawer } from '@/components/CartDrawer';
import { ReviewModal } from '@/components/ReviewModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Store, Product } from '@/lib/types';

interface SiteReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

function ProductImagePlaceholder({ name }: { name: string }) {
  const initial = (name?.trim()?.[0] || '?').toUpperCase();
  return (
    <div className="w-full h-full hg-gradient-primary flex items-center justify-center">
      <span className="font-serif font-bold text-white/90 text-4xl select-none">{initial}</span>
    </div>
  );
}

function ProductCard({ product, storeId, storeSlug, storeName, onMeatClick }: {
  product: Product;
  storeId: string;
  storeSlug: string;
  storeName: string;
  onMeatClick: (p: Product) => void;
}) {
  const { addItem, updateQuantity, items, setStoreInfo } = useCart();
  const cartItem = items.find(i => i.product.id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const image = product.images?.[0] || null;
  const [imageErrored, setImageErrored] = useState(false);
  const isAvailable = (product as any).isAvailable !== false && product.isActive !== false && (product.stockQty ?? 1) > 0;
  const productHref = `/products/${product.slug || product.id}`;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.isFreshMeat) { onMeatClick(product); return; }
    setStoreInfo(storeId, storeSlug, storeName);
    addItem(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  const handleIncrease = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); addItem(product, 1); };
  const handleDecrease = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, qty - 1); };

  return (
    <motion.div whileHover={{ y: -2 }} className={`group bg-card rounded-xl border overflow-hidden hg-shadow-sm hover:hg-shadow-md transition-all ${qty > 0 ? 'border-primary/50 shadow-md shadow-primary/10' : 'border-border/50'}`}>
      {/* Image — clickable to product detail */}
      <Link href={productHref}>
        <div className="relative aspect-square overflow-hidden bg-muted cursor-pointer">
          {image && !imageErrored ? (
            <img
              src={image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={() => setImageErrored(true)}
            />
          ) : (
            <ProductImagePlaceholder name={product.name} />
          )}
          {qty > 0 && <div className="absolute top-0 left-0 right-0 h-1 hg-gradient-primary" />}
          {product.isFreshMeat && (
            <div className="absolute top-2 left-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">FRESH TODAY</span>
            </div>
          )}
          {!isAvailable && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-sm font-semibold text-muted-foreground">Out of Stock</span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3">
        {/* Name — clickable to product detail */}
        <Link href={productHref}>
          <h4 className="font-medium text-sm leading-tight mb-0.5 hover:text-primary transition-colors">{product.name}</h4>
        </Link>
        {isAvailable && (product as any).stockQty != null && (product as any).lowStockThreshold != null && (product as any).stockQty <= (product as any).lowStockThreshold && (product as any).stockQty > 0 && (
          <span className="inline-block text-[10px] font-semibold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 mb-1">Low Stock</span>
        )}
        <div className="flex items-center justify-between mt-1">
          <div>
            <span className="font-bold text-base">${product.price.toFixed(2)}</span>
            {product.isFreshMeat && <span className="text-xs text-muted-foreground">/kg</span>}
            {(product as any).comparePrice && (product as any).comparePrice > product.price && (
              <span className="ml-1.5 text-xs text-muted-foreground line-through">${Number((product as any).comparePrice).toFixed(2)}</span>
            )}
          </div>

          {/* Cart controls */}
          {qty === 0 ? (
            <button
              onClick={handleAdd}
              disabled={!isAvailable}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold text-lg ${
                isAvailable ? 'hg-gradient-primary text-white hover:scale-110 shadow-md shadow-primary/30' : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {product.isFreshMeat ? '✂' : '+'}
            </button>
          ) : (
            <div className="flex items-center gap-0 bg-primary rounded-full overflow-hidden shadow-md shadow-primary/30">
              <button onClick={handleDecrease} className="w-7 h-7 flex items-center justify-center text-white text-sm font-bold hover:bg-white/20 transition-colors">−</button>
              <span className="text-white font-bold text-sm min-w-[20px] text-center">{qty}</span>
              <button onClick={handleIncrease} className="w-7 h-7 flex items-center justify-center text-white text-sm font-bold hover:bg-white/20 transition-colors">+</button>
            </div>
          )}
        </div>
        {product.isFreshMeat && qty === 0 && (
          <p className="text-[10px] text-primary mt-1">Tap ✂ to customize your cut</p>
        )}
      </div>
    </motion.div>
  );
}

function ProductSearchOverlay({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const [, navigate] = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const enabled = debounced.trim().length >= 2;
  const { data, isFetching } = useQuery<{ products: Product[] }>({
    queryKey: ['store-product-search', storeSlug, debounced],
    queryFn: () => api.get<{ products: Product[] }>(`/stores/${storeSlug}/products?search=${encodeURIComponent(debounced)}&limit=8`),
    enabled,
    staleTime: 30_000,
  });
  const results = data?.products ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results[0]) {
      setOpen(false);
      navigate(`/products/${results[0].slug || results[0].id}`);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={submit}>
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={`Search ${storeName}'s products...`}
              className="w-full pl-10 pr-3 py-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm font-medium"
            />
          </div>
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-white border-0 px-5 py-3 rounded-xl font-semibold shrink-0 gap-2">
            <Search className="w-4 h-4" /> Search
          </Button>
        </div>
      </form>

      {open && enabled && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 right-0 top-[calc(100%+8px)] bg-white rounded-2xl shadow-2xl border border-border/50 overflow-hidden z-50 max-h-[420px] overflow-y-auto"
        >
          {isFetching && <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>}
          {!isFetching && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No products match "<span className="font-semibold text-foreground">{debounced}</span>" at this store.
            </div>
          )}
          {!isFetching && results.length > 0 && (
            <ul role="listbox">
              {results.map(p => {
                const img = p.images?.[0] || null;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.slug || p.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border/30 last:border-0 hover:bg-muted/40"
                    >
                      <div className="w-11 h-11 rounded-xl bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {img ? (
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.category || 'Product'}
                          {typeof p.price === 'number' || typeof p.price === 'string' ? ` · $${Number(p.price).toFixed(2)}` : ''}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}

function groupByCategory(products: Product[]) {
  return products.reduce((acc, p) => {
    const cat = p.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, Product[]>);
}

export default function StoreDetailPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [meatProduct, setMeatProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [bannerErrored, setBannerErrored] = useState(false);
  const [logoErrored, setLogoErrored] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    setBannerErrored(false);
    setLogoErrored(false);
  }, [storeSlug]);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { itemCount } = useCart();

  const { data: store, isLoading: storeLoading } = useQuery<Store>({
    queryKey: ['store', storeSlug],
    queryFn: () => api.get<Store>(`/stores/${storeSlug}`),
    enabled: !!storeSlug,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{
    products: Product[]; total: number; page: number; totalPages: number;
  }>({
    queryKey: ['store-products', storeSlug],
    queryFn: () => api.get(`/stores/${storeSlug}/products?limit=100`),
    enabled: !!store,
  });
  const products = productsData?.products || [];

  const { data: storeReviews = [], refetch: refetchReviews } = useQuery<SiteReview[]>({
    queryKey: ['site-reviews', 'store', store?.id],
    queryFn: () => api.get<SiteReview[]>(`/site-reviews/store/${store!.id}`),
    enabled: !!store?.id,
  });

  const filteredProducts = products.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = groupByCategory(filteredProducts);
  // Use store-defined categories when available; fall back to product-derived list
  const storeDefinedCats = store?.storeCategories?.length ? store.storeCategories : null;
  const categories = storeDefinedCats
    ? storeDefinedCats.map(c => c.name)
    : Object.keys(grouped);

  const scrollToCategory = useCallback((cat: string) => {
    categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (storeLoading) {
    return (
      <>
        <Helmet>
          <title>Loading Store… | Numa Fresh</title>
        </Helmet>
        <div className="min-h-screen bg-background">
          <div className="h-48 bg-muted animate-pulse" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
            <div className="h-8 w-64 bg-muted animate-pulse rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">Store not found</p>
          <Button onClick={() => setLocation('/products')}>Browse Products</Button>
        </div>
      </div>
    );
  }

  const bannerImage = store.banner || store.cardImage || null;

  return (
    <>
      <Helmet>
        <title>{store.name} — Halal Grocery {store.city} | Numa Fresh</title>
        <meta name="description" content={store.description || `${store.name} — certified halal store in ${store.city}. Order fresh halal meat, groceries, and more.`} />
        <meta property="og:title" content={`${store.name} | Numa Fresh`} />
        <meta property="og:description" content={store.description || `Order fresh halal groceries from ${store.name} in ${store.city}.`} />
        <meta property="og:type" content="restaurant" />
        {store.logo && <meta property="og:image" content={store.logo} />}
        <link rel="canonical" href={`https://numafresh.com/stores/${store.slug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "GroceryStore",
          "name": store.name,
          "description": store.description || `Certified halal grocery store in ${store.city}`,
          "url": `https://numafresh.com/stores/${store.slug}`,
          "telephone": store.phone,
          "email": store.email,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": store.address,
            "addressLocality": store.city,
            "addressRegion": store.province,
            "postalCode": store.postalCode,
            "addressCountry": "US",
          },
          "geo": store.lat && store.lng ? {
            "@type": "GeoCoordinates",
            "latitude": store.lat,
            "longitude": store.lng,
          } : undefined,
          "aggregateRating": store.totalRatings > 0 ? {
            "@type": "AggregateRating",
            "ratingValue": store.rating,
            "reviewCount": store.totalRatings,
          } : undefined,
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Halal Groceries",
          },
          "servesCuisine": "Halal",
          "priceRange": "$$",
          "image": store.logo || store.banner,
        })}</script>
      </Helmet>

      {/* Floating cart button */}
      {itemCount > 0 && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setCartOpen(true)}
          className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-40 hg-gradient-primary text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-2 font-semibold"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>{itemCount} items</span>
        </motion.button>
      )}

      {/* Banner — Task 3: bigger hero + product search overlay.
          Outer wrapper has NO overflow-hidden so the product search dropdown
          can extend below the banner. The image (which uses scale-105) lives
          in its own clipped layer. */}
      <div className="relative h-72 md:h-[420px] bg-muted">
        {/* Image / gradient layer (clipped) */}
        <div className="absolute inset-0 overflow-hidden">
          {bannerImage && !bannerErrored ? (
            <img
              src={bannerImage}
              alt={store.name}
              className="w-full h-full object-cover scale-105"
              onError={() => setBannerErrored(true)}
            />
          ) : (
            <div className="w-full h-full hg-gradient-primary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
        </div>
        {/* Back button */}
        <div className="absolute top-4 left-4">
          <Link href="/">
            <button className="w-9 h-9 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
        </div>
        {/* Hero overlay: store name + product search */}
        <div className="absolute inset-x-0 bottom-0 pb-10 md:pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl relative z-20">
              <p className="text-white/85 text-xs md:text-sm font-semibold tracking-widest uppercase mb-1.5 drop-shadow">
                {store.city}{store.province ? `, ${store.province}` : ''}
              </p>
              <h1 className="font-serif text-3xl md:text-5xl font-bold text-white drop-shadow mb-4 md:mb-5 leading-tight">
                {store.name}
              </h1>
              <ProductSearchOverlay storeSlug={storeSlug} storeName={store.name} />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Store info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="bg-card border border-border/50 rounded-2xl p-5 hg-shadow-sm mb-6">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="w-16 h-16 rounded-2xl overflow-hidden hg-gradient-primary flex items-center justify-center text-white font-bold text-xl font-serif flex-shrink-0 shadow-lg">
              {store.logo && !logoErrored ? (
                <img
                  src={store.logo}
                  alt={`${store.name} logo`}
                  className="w-full h-full object-cover"
                  onError={() => setLogoErrored(true)}
                />
              ) : (
                <span>{store.name[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-serif text-2xl font-bold">{store.name}</h1>
                {(store as any).branchName && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{(store as any).branchName}</span>
                )}
                {store.isHalalCertified && <HalalBadge size="sm" />}
              </div>
              {(store as any).tagline && (
                <p className="text-sm text-muted-foreground italic mb-1">{(store as any).tagline}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="font-semibold text-foreground">{store.rating?.toFixed(1) || '—'}</span>
                  {store.totalRatings && <span>({store.totalRatings})</span>}
                </span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{store.address}, {store.city}</span>
                {store.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{store.phone}</span>}
              </div>
            </div>
          </div>

          {/* Service pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Clock className="w-3 h-3" /> ~{store.avgPrepTimeMinutes || 25} min prep
            </span>
            {store.pickupAvailable && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-medium">
                <Package className="w-3 h-3" /> Pickup {store.convenienceFee ? `· $${store.convenienceFee}` : '· Free'}
              </span>
            )}
            {store.curbsideAvailable && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-medium">
                🚗 Curbside {store.curbsideFee ? `· $${store.curbsideFee}` : ''}
              </span>
            )}
            {store.deliveryAvailable && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-medium">
                <Truck className="w-3 h-3" /> Delivery · ${store.deliveryFee}
              </span>
            )}
            {store.minOrderAmount && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs">
                Min ${store.minOrderAmount}
              </span>
            )}
            {store.isHalalCertified && store.halalCertNumber && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                <ShieldCheck className="w-3 h-3" /> {store.halalCertNumber}
              </span>
            )}
          </div>
        </div>


        {/* Not accepting orders banner */}
        {(store as any).isActiveManual === false && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm mt-4">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>This store is <strong>not currently accepting orders</strong>. You can still browse, but checkout is unavailable. Check back later.</span>
          </div>
        )}

        {/* ── FRESH MEAT SPOTLIGHT ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6 rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0D3327 0%, #1B4D3E 60%, #1E5C4D 100%)' }}
        >
          {(() => {
            const s = store as any;
            const badgeTitle = s.premiumFreshBadgeTitle || 'Premium Fresh Cuts';
            const heading = s.premiumFreshHeading || 'Cut Fresh, Just For You';
            const desc = s.premiumFreshDesc || 'Our certified halal butchers cut meat to your exact specs — boneless, bone-in, ground, or cubed.';
            const tags: string[] = Array.isArray(s.premiumFreshCutTags) && s.premiumFreshCutTags.length > 0
              ? s.premiumFreshCutTags
              : ['🐑 Lamb', '🐄 Beef', '🐐 Goat', '🐔 Chicken', '🥩 Veal'];
            const bullets = [s.premiumFreshBullet1, s.premiumFreshBullet2, s.premiumFreshBullet3].filter(Boolean) as string[];
            const defaultBullets = ['Custom cut to your specifications', 'Halal certified (ISNA & IFANCA)', 'Ready for express pickup in 60 seconds'];
            const activeBullets = bullets.length > 0 ? bullets : defaultBullets;
            const bulletIcons = [CheckCircle, ShieldCheck, Zap];
            const images: Array<{ src: string; tag: string; label: string; price: string }> = Array.isArray(s.premiumFreshImages) && s.premiumFreshImages.length > 0
              ? s.premiumFreshImages
              : [
                  { src: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=300&q=80', label: 'Boneless Lamb', price: '$16.99/lb', tag: 'Best Seller' },
                  { src: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=300&q=80&fit=crop', label: 'Whole Chicken', price: '$4.99/lb', tag: 'Fresh Daily' },
                  { src: 'https://images.unsplash.com/photo-1544025162-d76538775a9b?w=300&q=80', label: 'Beef Cubes', price: '$9.99/lb', tag: 'Premium Cut' },
                  { src: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&q=80', label: 'Goat Pieces', price: '$10.99/lb', tag: 'Customer Fav' },
                ];
            return (
              <div className="p-6 grid md:grid-cols-2 gap-6 items-center">
                {/* Left: Text content */}
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border border-[#D4AF37]/50 text-[#D4AF37]">
                    <Award className="w-3 h-3" /> {badgeTitle}
                  </span>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-white leading-tight">
                    {heading}
                  </h3>
                  <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(m => (
                      <span key={m} className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-medium">{m}</span>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {activeBullets.map((text, i) => {
                      const Icon = bulletIcons[i] || CheckCircle;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                          <span className="text-white/75 text-xs">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Right: Meat item images */}
                <div className="grid grid-cols-2 gap-2">
                  {images.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1/1' }}>
                      <img src={item.src} alt={item.label} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&q=80'; }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute top-2 left-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#D4AF37] text-white text-[9px] font-bold">{item.tag}</span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-white text-xs font-semibold leading-tight">{item.label}</p>
                        <p className="text-[#D4AF37] text-[10px] font-bold">{item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </motion.div>

        {/* ── BROWSE BY CATEGORY ── */}
        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 bg-card border border-border/50 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-primary mb-0.5">Shop by Type</p>
                <h3 className="font-serif text-lg font-bold">Browse by Category</h3>
              </div>
            </div>
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none -mx-1 px-1">
              {categories.map((cat, i) => {
                const EMOJI_FALLBACK: Record<string, string> = {
                  'Fresh Meat': '🥩', 'Halal Meat': '🥩', 'Spices & Seasonings': '🌶️',
                  'Rice & Grains': '🌾', 'Fresh Produce': '🥬', 'Dairy & Eggs': '🥛',
                  'Oils & Ghee': '🫙', 'Lentils & Pulses': '🫘', 'Bread & Bakery': '🥖',
                  'Beverages': '🧃', 'Snacks': '🍿', 'Frozen Foods': '🧊',
                  'Dried Fruits & Nuts': '🥜', 'Condiments': '🥫', 'Packaged Goods': '📦',
                  'Sweets & Desserts': '🍯', 'Chicken': '🐔', 'Lamb': '🐑',
                };
                const defCat = storeDefinedCats?.find(c => c.name === cat);
                const emoji = defCat?.emoji || EMOJI_FALLBACK[cat] || '🛒';
                const imageUrl = defCat?.imageUrl;
                return (
                  <motion.button
                    key={cat}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => scrollToCategory(cat)}
                    className="group flex-shrink-0 flex flex-col items-center gap-1.5 p-2 w-20 rounded-xl border-2 border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer"
                  >
                    {imageUrl ? (
                      <div className="w-9 h-9 rounded-lg overflow-hidden">
                        <img src={imageUrl} alt={cat} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                      </div>
                    ) : (
                      <span className="text-2xl leading-none group-hover:scale-110 transition-transform duration-200">
                        {emoji}
                      </span>
                    )}
                    <span className="text-[9px] font-semibold text-center leading-tight text-foreground line-clamp-2">
                      {cat}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="menu">
          <TabsList className="mb-6 h-auto p-1 bg-muted/40 rounded-xl">
            <TabsTrigger value="menu" className="rounded-lg">Menu</TabsTrigger>
            <TabsTrigger value="info" className="rounded-lg">Info</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-lg">Reviews</TabsTrigger>
          </TabsList>

          {/* MENU TAB */}
          <TabsContent value="menu">
            {/* Search within store */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category pills */}
            {categories.length > 1 && !searchQuery && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
                {categories.filter(cat => (grouped[cat]?.length ?? 0) > 0).map(cat => (
                  <button
                    key={cat}
                    onClick={() => scrollToCategory(cat)}
                    className="flex-shrink-0 px-4 py-2 rounded-xl bg-muted text-sm font-medium hover:bg-primary hover:text-white transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Products by category */}
            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">No products found</p>
                <p className="text-sm">Try a different search</p>
              </div>
            ) : (
              <div className="space-y-10">
                {categories.filter(cat => (grouped[cat]?.length ?? 0) > 0).map(cat => (
                  <div key={cat} ref={el => { categoryRefs.current[cat] = el; }}>
                    <h2 className="font-serif text-xl font-semibold mb-4 pb-2 border-b border-border/50">{cat}</h2>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 snap-x snap-mandatory">
                      {grouped[cat].map(product => (
                        <div key={product.id} className="flex-shrink-0 w-44 snap-start">
                          <ProductCard
                            product={product}
                            storeId={store.id}
                            storeSlug={store.slug}
                            storeName={store.name}
                            onMeatClick={setMeatProduct}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* INFO TAB */}
          <TabsContent value="info">
            {/* Connect with Store — prominent action card */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Button
                variant="outline"
                className="flex-1 rounded-2xl h-12 gap-2 font-semibold border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => setShowReviewModal(true)}
              >
                <PenLine className="w-4 h-4" /> Write a Review
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
                <h3 className="font-serif text-lg font-semibold">About</h3>
                {store.description && <p className="text-sm text-muted-foreground leading-relaxed">{store.description}</p>}
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><span>{store.address}, {store.city}, {store.province} {store.postalCode}</span></div>
                  {store.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /><a href={`tel:${store.phone}`} className="hover:text-primary">{store.phone}</a></div>}
                  {store.email && <div className="flex items-center gap-2"><Info className="w-4 h-4 text-primary" /><a href={`mailto:${store.email}`} className="hover:text-primary">{store.email}</a></div>}
                </div>
                {store.isHalalCertified && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Halal Certified</p>
                      {store.halalCertNumber && <p className="text-xs text-amber-600">Cert: {store.halalCertNumber}</p>}
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5">
                <h3 className="font-serif text-lg font-semibold mb-4">Opening Hours</h3>
                {store.openingHoursJson && typeof store.openingHoursJson === 'object' && Object.keys(store.openingHoursJson as object).length > 0 ? (
                  <div className="space-y-2">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                      const hours = (store.openingHoursJson as Record<string, { open: string; close: string; closed?: boolean }>)[day];
                      if (!hours) return null;
                      return (
                        <div key={day} className="flex justify-between text-sm">
                          <span className="font-medium capitalize">{day}</span>
                          <span className="text-muted-foreground">
                            {hours.closed ? 'Closed' : `${hours.open} – ${hours.close}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Hours not available</p>
                )}
              </div>
            </div>

            {/* Services / Amenities / Map row */}
            {(((store as any).servicesOffered?.length ?? 0) > 0 ||
              ((store as any).amenityTags?.length ?? 0) > 0 ||
              (store as any).googleMapsLink) && (
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                {((store as any).servicesOffered?.length ?? 0) > 0 && (
                  <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <h3 className="font-serif text-lg font-semibold mb-3">Services Offered</h3>
                    <div className="flex flex-wrap gap-2">
                      {((store as any).servicesOffered as string[]).map((s, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {((store as any).amenityTags?.length ?? 0) > 0 && (
                  <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <h3 className="font-serif text-lg font-semibold mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {((store as any).amenityTags as string[]).map((a, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-medium">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(() => {
                  const raw = (store as any).googleMapsLink as string | null | undefined;
                  if (!raw) return null;
                  let safeUrl: string | null = null;
                  try {
                    const u = new URL(raw);
                    if (u.protocol === 'https:' && /(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)$/i.test(u.hostname)) {
                      safeUrl = u.toString();
                    }
                  } catch { /* invalid URL → hide */ }
                  if (!safeUrl) return null;
                  return (
                    <div className="bg-card border border-border/50 rounded-2xl p-5 md:col-span-2">
                      <h3 className="font-serif text-lg font-semibold mb-3">Find Us</h3>
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <MapPin className="w-4 h-4" /> Open in Google Maps
                      </a>
                    </div>
                  );
                })()}
              </div>
            )}
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews">
            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-center">
                  <p className="text-5xl font-bold font-serif">{store.rating?.toFixed(1) || '—'}</p>
                  <StarRating rating={store.rating || 0} />
                  <p className="text-sm text-muted-foreground mt-1">{store.totalRatings || 0} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(star => {
                    const pct = store.totalRatings ? Math.random() * 70 + (star === 5 ? 30 : 5) : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-sm">
                        <span className="w-4 text-right">{star}</span>
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full hg-gradient-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Button onClick={() => setShowReviewModal(true)} size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
                <PenLine className="w-3.5 h-3.5" /> Write a Review
              </Button>
            </div>

            {/* Live community reviews */}
            {storeReviews.length === 0 ? (
              <div className="text-center py-8">
                <UserCircle2 className="w-10 h-10 text-muted-foreground/25 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No reviews yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Be the first to share your experience!</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {storeReviews.map(r => (
                  <div key={r.id} className="bg-muted/30 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full hg-gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
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
                    {r.comment && <p className="text-sm text-foreground leading-relaxed mt-2">"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom spacing */}
      <div className="h-32 md:h-8" />

      {/* Review modal */}
      {showReviewModal && store && (
        <ReviewModal
          targetType="store"
          storeId={store.id}
          targetName={store.name}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => { refetchReviews(); }}
        />
      )}

      {/* Meat customizer modal */}
      <MeatCustomizerModal
        product={meatProduct}
        storeId={store.id}
        storeSlug={store.slug}
        storeName={store.name}
        onClose={() => setMeatProduct(null)}
      />

      {/* Cart drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
