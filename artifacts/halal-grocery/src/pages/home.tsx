import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from 'framer-motion';
import {
  ArrowRight, MapPin, Search, Star, Clock, Package, Zap,
  CheckCircle, X, Tag, Store as StoreIcon, Navigation, Loader2, PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreCard } from '@/components/StoreCard';
import { StoreCardSkeleton } from '@/components/LoadingSkeleton';
import { ReviewModal } from '@/components/ReviewModal';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCms } from '@/lib/cms';
import type { Store } from '@/lib/types';

interface SiteReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1500, bounce: 0 });
  const [display, setDisplay] = useState(0);
  useEffect(() => { if (isInView) motionValue.set(target); }, [isInView, target, motionValue]);
  useEffect(() => spring.on('change', v => setDisplay(Math.round(v))), [spring]);
  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>;
}

function useStoreColCount() {
  const getColCount = () => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  };
  const [cols, setCols] = useState(getColCount);
  useEffect(() => {
    const update = () => setCols(getColCount());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

/* ── Review card (shared between carousel and grid) ── */
function SiteReviewCard({ r }: { r: SiteReview }) {
  return (
    <div
      className="bg-card border border-border/60 rounded-2xl flex flex-col h-full"
      style={{ padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
    >
      {/* Stars row + quote icon */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-0.5">
          {Array.from({ length: Math.max(0, Math.min(5, r.rating)) }).map((_, j) => (
            <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
          ))}
        </div>
        <span
          className="font-serif leading-none select-none shrink-0"
          style={{ fontSize: '2rem', color: 'rgba(0,0,0,0.08)' }}
        >"</span>
      </div>

      {/* Review text — 3-line clamp; placeholder when empty */}
      <p
        className="text-foreground text-sm leading-relaxed flex-1"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        {r.comment
          ? `"${r.comment}"`
          : <em className="text-muted-foreground not-italic">Excellent store, highly recommended!</em>
        }
      </p>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #f0f0f0', margin: '12px 0' }} />

      {/* Author row */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full hg-gradient-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
          {r.authorName.charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-semibold flex-1 leading-tight">{r.authorName}</p>
        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
      </div>
    </div>
  );
}

/* ── Mobile carousel (touch-swipe, dot navigation) ── */
function SiteReviewCarousel({ reviews }: { reviews: SiteReview[] }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 40 && Math.abs(dx) > dy) {
      if (dx > 0) setActive(a => Math.min(a + 1, reviews.length - 1));
      else        setActive(a => Math.max(a - 1, 0));
    }
  };

  return (
    <div>
      {/* Slide track */}
      <div
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(-${active * 100}%)`,
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            willChange: 'transform',
          }}
        >
          {reviews.map((r) => (
            <div key={r.id} className="w-full shrink-0 px-1">
              <SiteReviewCard r={r} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center items-center gap-2 mt-5">
        {reviews.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`View review ${i + 1}`}
            onClick={() => setActive(i)}
            className="rounded-full transition-all duration-200"
            style={{
              height: 8,
              width: i === active ? 24 : 8,
              backgroundColor: i === active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              minHeight: 'unset',
              padding: 0,
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [, setLocation] = useLocation();
  const cms = useCms();
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [adBannerVisible, setAdBannerVisible] = useState(true);

  // ── Geolocation state for "Near You" section ──
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'error'>('idle');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  const geoWatchRef = useRef<number | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus('error'); return; }
    setGeoStatus('loading');
    // Clear any existing watch before starting a new one
    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
    }
    // watchPosition keeps the list live as the user moves
    geoWatchRef.current = navigator.geolocation.watchPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setGeoStatus('granted'); },
      () => setGeoStatus('denied'),
      { timeout: 10000, enableHighAccuracy: false },
    );
  }, []);

  // Clean up the geolocation watch when the component unmounts
  useEffect(() => {
    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
      }
    };
  }, []);

  const announcementsEnabled = cms['cms.nav'].announcementsEnabled !== false;
  const activeAnnouncements = announcementsEnabled ? cms['cms.announcements'].filter(a => a.active) : [];
  useEffect(() => {
    if (activeAnnouncements.length <= 1) return;
    const t = setInterval(() => {
      setAnnouncementIdx(i => (i + 1) % activeAnnouncements.length);
    }, 6000);
    return () => clearInterval(t);
  }, [activeAnnouncements.length]);
  const currentAnnouncement = activeAnnouncements[announcementIdx % Math.max(activeAnnouncements.length, 1)];

  const activeHeroStores = cms['cms.heroStores'].filter(s => s.active);
  const heroLarge = activeHeroStores.find(s => s.size !== 'small') || activeHeroStores[0];
  const heroSmall = activeHeroStores.filter(s => s !== heroLarge).slice(0, 2);

  // Track hero images that failed to load — by URL, so a freshly-saved URL
  // for the same slot id starts in a "not failed" state and gets a chance to
  // render. Reset whenever the CMS data changes.
  const [failedHeroUrls, setFailedHeroUrls] = useState<Set<string>>(new Set());
  const heroUrlSignature = activeHeroStores.map(s => s.imageUrl).join('|');
  useEffect(() => { setFailedHeroUrls(new Set()); }, [heroUrlSignature]);
  const markHeroFailed = (url: string) =>
    setFailedHeroUrls(prev => (prev.has(url) ? prev : new Set(prev).add(url)));

  // Task 4: load all stores (cap at 100) and paginate client-side.
  // /stores returns a paginated envelope { stores, total, page, totalPages }.
  const { data: storesData, isLoading: storesLoading } = useQuery<{ stores: Store[] }>({
    queryKey: ['stores', 'all', 'home'],
    queryFn: () => api.get<{ stores: Store[] }>('/stores?limit=100'),
  });
  const stores = storesData?.stores ?? [];

  // ── "Discover Our Stores" — all-stores filter + pagination ──
  const storeColCount = useStoreColCount();
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [storeCount, setStoreCount] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const c = w >= 1280 ? 4 : w >= 1024 ? 3 : w >= 640 ? 2 : 1;
    return c * 2;
  });
  useEffect(() => { setStoreCount(storeColCount * 2); }, [storeFilter, storeColCount]);

  // Build filter tags — type/service based only, no city tags
  const buildFilterTags = useCallback((_list: Store[]) => {
    return [
      { id: 'all',      label: 'All Stores' },
      { id: 'halal',    label: 'Halal Certified' },
      { id: 'pickup',   label: 'Pickup' },
      { id: 'curbside', label: 'Curbside' },
      { id: 'delivery', label: 'Delivery' },
    ] as Array<{ id: string; label: string }>;
  }, []);

  const storeFilterTags = useMemo(() => buildFilterTags(stores), [stores, buildFilterTags]);

  const applyFilter = useCallback((list: Store[], filter: string) => {
    if (filter === 'all') return list;
    switch (filter) {
      case 'halal':    return list.filter(s => s.isHalalCertified);
      case 'pickup':   return list.filter(s => s.pickupAvailable);
      case 'curbside': return list.filter(s => s.curbsideAvailable);
      case 'delivery': return list.filter(s => s.deliveryAvailable);
      default:         return list;
    }
  }, []);

  const filteredStores = useMemo(() => applyFilter(stores, storeFilter), [stores, storeFilter, applyFilter]);
  const visibleStores = filteredStores.slice(0, storeCount);
  const hasMoreStores = filteredStores.length > storeCount;

  // ── "Near You" — geolocation-sorted stores ──
  const [nearbyFilter, setNearbyFilter] = useState<string>('all');
  const [nearbyCount, setNearbyCount] = useState(6);
  useEffect(() => { setNearbyCount(6); }, [nearbyFilter]);


  // Stores within 50 km of the user, sorted nearest-first
  const NEARBY_RADIUS_KM = 50;
  const storesSortedByDistance = useMemo(() => {
    if (geoStatus !== 'granted' || userLat === null || userLng === null) return [];
    return [...stores]
      .map(s => ({ ...s, _distKm: (s.lat && s.lng) ? haversineKm(userLat, userLng, s.lat, s.lng) : Infinity }))
      .filter(s => (s._distKm as number) <= NEARBY_RADIUS_KM)
      .sort((a, b) => (a._distKm as number) - (b._distKm as number));
  }, [stores, geoStatus, userLat, userLng]);

  const nearbyFilterTags = useMemo(() => buildFilterTags(storesSortedByDistance), [storesSortedByDistance, buildFilterTags]);
  const filteredNearby = useMemo(() => applyFilter(storesSortedByDistance, nearbyFilter), [storesSortedByDistance, nearbyFilter, applyFilter]);
  const visibleNearby = filteredNearby.slice(0, nearbyCount);
  const hasMoreNearby = filteredNearby.length > nearbyCount;

  // Task 2: real-time store search dropdown for hero
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIdx, setSearchActiveIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounced(searchQuery, 200);
  // /stores returns a paginated envelope { stores, total, page, totalPages } — unwrap to .stores.
  const { data: searchData, isFetching: searchFetching } = useQuery<{ stores: Store[] }>({
    queryKey: ['stores', 'hero-search', debouncedQuery],
    queryFn: () =>
      api.get<{ stores: Store[] }>(
        `/stores?search=${encodeURIComponent(debouncedQuery)}&limit=8`,
      ),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });
  const searchResults = searchData?.stores ?? [];
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => { setSearchActiveIdx(-1); }, [debouncedQuery]);

  const goToStore = (slug: string) => {
    setSearchOpen(false);
    setLocation(`/stores/${slug}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchActiveIdx >= 0 && searchResults?.[searchActiveIdx]) {
      goToStore(searchResults[searchActiveIdx].slug);
      return;
    }
    setLocation(`/`);
  };

  const [showReviewModal, setShowReviewModal] = useState(false);

  const { data: platformStats } = useQuery<{ storeCount: number; productCount: number; reviewCount: number }>({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/stats'),
    staleTime: 60_000,
  });

  const { data: platformReviews = [], refetch: refetchPlatformReviews } = useQuery<SiteReview[]>({
    queryKey: ['site-reviews', 'platform'],
    queryFn: () => api.get<SiteReview[]>('/site-reviews/platform'),
  });

  return (
    <>
      <Helmet>
        <title>Numa Fresh — Fresh Halal Meat & Groceries Near You</title>
        <meta name="description" content="Order fresh halal meat, ethnic groceries, spices and more from certified halal stores near you. Express pickup, curbside, and delivery available." />
        <meta property="og:title" content="Numa Fresh — Premium Halal Grocery Marketplace" />
      </Helmet>
      {/* ── PROMO BANNER (CMS-driven sliding announcements) ── */}
      {adBannerVisible && currentAnnouncement && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-16 z-40 overflow-hidden"
          style={{
            background: `linear-gradient(90deg, ${currentAnnouncement.bgFrom || '#0D3327'} 0%, ${currentAnnouncement.bgVia || '#1B4D3E'} 40%, ${currentAnnouncement.bgTo || '#D4AF37'} 100%)`,
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center">
                <Tag className="w-3.5 h-3.5 text-[#D4AF37]" />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
                <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider shrink-0">Limited Offer</span>
                <motion.span
                  key={currentAnnouncement.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-white font-semibold text-sm truncate"
                >
                  {currentAnnouncement.text}
                </motion.span>
                {currentAnnouncement.code && (
                  <span className="hidden sm:inline text-white/60 text-xs">
                    {currentAnnouncement.codeLabel || 'Use code'}{' '}
                    <span className="font-bold text-[#D4AF37]">{currentAnnouncement.code}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {currentAnnouncement.linkUrl && currentAnnouncement.linkLabel && (
                <Link href={currentAnnouncement.linkUrl}>
                  <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#C4A032] text-white text-xs font-bold transition-colors">
                    {currentAnnouncement.linkLabel} <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
              )}
              {activeAnnouncements.length > 1 && (
                <div className="hidden md:flex items-center gap-1">
                  {activeAnnouncements.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === announcementIdx ? 'w-4 bg-[#D4AF37]' : 'w-1.5 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={() => setAdBannerVisible(false)}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── HERO ──
          Note: NO overflow-hidden on the section itself, otherwise the search
          dropdown that opens just below the search bar gets clipped. The
          decorative patterns and bottom wave each have their own clipping. */}
      <section className="relative" style={{ background: 'linear-gradient(135deg, #0D3327 0%, #1E5C4D 45%, #2A7D6A 100%)', minHeight: '90vh' }}>
        {/* Decorative background patterns */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #3FB196 0%, transparent 70%)' }} />
          <svg className="absolute top-0 right-0 w-1/2 h-full opacity-[0.03]" viewBox="0 0 600 800" fill="none">
            <path d="M300 100 L550 250 L550 550 L300 700 L50 550 L50 250 Z" stroke="white" strokeWidth="1" fill="none" />
            <path d="M300 150 L520 280 L520 520 L300 650 L80 520 L80 280 Z" stroke="white" strokeWidth="0.5" fill="none" />
            <circle cx="300" cy="400" r="180" stroke="white" strokeWidth="0.5" fill="none" />
            <circle cx="300" cy="400" r="120" stroke="white" strokeWidth="0.5" fill="none" />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-20 md:pt-5 md:pb-28">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

            {/* Left: Text + Search */}
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}>
              {/* Trust pill */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
                <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                <span className="text-sm font-medium text-white/90">Halal Certified Stores Only</span>
              </div>

              {/* Headline */}
              <h1 className="font-serif font-bold text-white leading-[1.06] tracking-tight mb-5" style={{ fontSize: 'clamp(2.8rem, 5vw, 4.5rem)' }}>
                Fresh Halal<br />
                <span className="text-[#D4AF37]">Groceries,</span><br />
                <span className="text-white/90">Delivered Fast</span>
              </h1>
              <p className="text-lg text-white/70 max-w-lg leading-relaxed mb-8">
                Shop from certified halal stores near you. Fresh meat cut to your exact specifications — boneless, bone-in, ground, cubed. Your way.
              </p>

              {/* Search Bar — Task 2: real-time store search dropdown */}
              <div ref={searchBoxRef} className="relative max-w-lg mb-8">
                <form onSubmit={handleSearch}>
                  <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-2xl">
                    <div className="flex-1 relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
                      <input
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                        onFocus={() => setSearchOpen(true)}
                        onKeyDown={e => {
                          if (!searchOpen || !searchResults?.length) return;
                          if (e.key === 'ArrowDown') { e.preventDefault(); setSearchActiveIdx(i => Math.min(i + 1, searchResults.length - 1)); }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchActiveIdx(i => Math.max(i - 1, -1)); }
                          else if (e.key === 'Escape') { setSearchOpen(false); }
                        }}
                        placeholder="Search stores by name or city..."
                        className="w-full pl-10 pr-3 py-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm font-medium"
                      />
                    </div>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-white border-0 px-5 py-3 rounded-xl font-semibold shrink-0 gap-2">
                      <Search className="w-4 h-4" /> Search
                    </Button>
                  </div>
                  <p className="text-white/40 text-xs mt-2 pl-2">Try "Al-Madina" or "Houston"</p>
                </form>

                <AnimatePresence>
                  {searchOpen && debouncedQuery.trim().length >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-[68px] bg-white rounded-2xl shadow-2xl border border-border/50 overflow-hidden z-50 max-h-[420px] overflow-y-auto"
                    >
                      {searchFetching && (
                        <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
                      )}
                      {!searchFetching && searchResults && searchResults.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No stores match "<span className="font-semibold text-foreground">{debouncedQuery}</span>".
                        </div>
                      )}
                      {!searchFetching && searchResults && searchResults.length > 0 && (
                        <ul role="listbox">
                          {searchResults.map((s, i) => (
                            <li
                              key={s.id}
                              role="option"
                              aria-selected={i === searchActiveIdx}
                              onMouseEnter={() => setSearchActiveIdx(i)}
                              onMouseDown={e => { e.preventDefault(); goToStore(s.slug); }}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border/30 last:border-0 ${i === searchActiveIdx ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                            >
                              <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {s.cardImage || s.logo ? (
                                  <img src={(s.cardImage || s.logo) as string} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <StoreIcon className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-foreground truncate">{s.name}</div>
                                <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3" />{s.city}{s.province ? `, ${s.province}` : ''}
                                </div>
                              </div>
                              {typeof s.rating === 'number' && s.rating > 0 && (
                                <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold shrink-0">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {Number(s.rating).toFixed(1)}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Stats — live from API */}
              <div className="flex flex-wrap gap-6 sm:gap-8">
                {[
                  { value: platformStats?.storeCount ?? 0, suffix: '+', label: 'Certified Stores' },
                  { value: platformStats?.productCount ?? 0, suffix: '+', label: 'Products Available' },
                  { value: platformStats?.reviewCount ?? 0, suffix: '+', label: 'Reviews' },
                ].map(stat => (
                  <div key={stat.label}>
                    <div className="text-2xl font-bold text-white font-serif"><CountUp target={stat.value} suffix={stat.suffix} /></div>
                    <div className="text-xs text-white/50 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: Product imagery collage — visible on every viewport */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative mt-10 lg:mt-0"
            >
              <div className="relative grid grid-cols-2 gap-3 mt-10">
                {/* Large top image (CMS-driven). The admin's saved URL is the
                    source of truth — on load failure we hide the slot rather
                    than swapping in any hardcoded fallback. */}
                {heroLarge && !failedHeroUrls.has(heroLarge.imageUrl) && (() => {
                  const inner = (
                    <>
                      <img
                        src={heroLarge.imageUrl}
                        alt={heroLarge.label || 'Featured store'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04] pointer-events-none"
                        onError={() => markHeroFailed(heroLarge.imageUrl)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                      {heroLarge.label && (
                        <div className="absolute bottom-4 left-4 pointer-events-none">
                          <span className="px-3 py-1.5 bg-[#D4AF37] text-white text-xs font-bold rounded-lg">{heroLarge.label}</span>
                        </div>
                      )}
                      {heroLarge.linkUrl && (
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="px-2.5 py-1 bg-white/95 text-foreground text-[11px] font-semibold rounded-full inline-flex items-center gap-1 shadow">
                            Visit store <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      )}
                    </>
                  );
                  const cls = "col-span-2 relative rounded-3xl overflow-hidden group block cursor-pointer";
                  const href = heroLarge.linkUrl || '/';
                  return (
                    <Link
                      href={href}
                      className={cls}
                      style={{ height: '240px' }}
                      aria-label={heroLarge.label ? `Visit ${heroLarge.label}` : 'Visit featured store'}
                    >{inner}</Link>
                  );
                })()}

                {/* Bottom two (CMS-driven). Same no-fallback policy. */}
                {heroSmall
                  .filter(img => !failedHeroUrls.has(img.imageUrl))
                  .map(img => {
                    const inner = (
                      <>
                        <img
                          src={img.imageUrl}
                          alt={img.label}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04] pointer-events-none"
                          onError={() => markHeroFailed(img.imageUrl)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                        {img.label && (
                          <div className="absolute bottom-3 left-3 pointer-events-none">
                            <span className="text-white text-xs font-semibold">{img.label}</span>
                          </div>
                        )}
                      </>
                    );
                    const cls = "relative rounded-2xl overflow-hidden group block cursor-pointer";
                    const href = img.linkUrl || '/';
                    return (
                      <Link
                        key={img.id}
                        href={href}
                        className={cls}
                        style={{ height: '150px' }}
                        aria-label={img.label ? `Visit ${img.label}` : 'Visit featured store'}
                      >{inner}</Link>
                    );
                  })}

                {/* Floating card: Rating — desktop only to avoid overlapping clickable images on mobile */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="hidden lg:block absolute -top-5 -right-5 z-20 bg-white rounded-2xl p-3.5 shadow-2xl border border-white/50 pointer-events-none"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">4.9 / 5.0</p>
                      <p className="text-[10px] text-muted-foreground">567 reviews</p>
                    </div>
                  </div>
                </motion.div>

                {/* Floating card: Pickup time — desktop only to avoid overlapping clickable images on mobile */}
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="hidden lg:block absolute -bottom-4 -left-5 z-20 bg-white rounded-2xl p-3.5 shadow-2xl border border-white/50 pointer-events-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">Ready in 5 minutes</p>
                      <p className="text-[10px] text-muted-foreground">Express pickup</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-auto">
            <path d="M0 60 L0 30 Q360 0 720 30 Q1080 60 1440 30 L1440 60 Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>
      {/* ── DISCOVER OUR STORES — all stores ── */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold tracking-widest uppercase text-primary mb-1">Our Network</p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold">Discover Our Stores</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">Certified, trusted, community-loved halal stores</p>
            </motion.div>
          </div>

          {/* Filter tags — single scrolling row */}
          {!storesLoading && stores.length > 0 && (
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-8">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter stores">
                {storeFilterTags.map(tag => {
                  const active = storeFilter === tag.id;
                  return (
                    <button key={tag.id} type="button" role="tab" aria-selected={active}
                      onClick={() => setStoreFilter(tag.id)}
                      className={'shrink-0 whitespace-nowrap rounded-full px-4 h-9 text-sm font-semibold border transition-colors ' + (active ? 'bg-primary text-white border-primary shadow-sm' : 'bg-card text-foreground border-border/60 hover:bg-muted')}
                    >{tag.label}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {storesLoading
              ? Array.from({ length: 6 }).map((_, i) => <StoreCardSkeleton key={i} />)
              : visibleStores.length === 0
                ? <div className="col-span-full py-12 text-center text-muted-foreground">No stores match this filter. Try a different tag.</div>
                : visibleStores.map((store, i) => (
                    <motion.div key={store.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 6) * 0.05 }}>
                      <StoreCard store={store} />
                    </motion.div>
                  ))}
          </div>

          {!storesLoading && (
            <div className="mt-10 flex justify-center">
              <Button onClick={() => setStoreCount(c => c + storeColCount)} variant="outline" disabled={!hasMoreStores}
                className="rounded-full px-8 h-11 border-primary/30 text-primary hover:bg-primary hover:text-white font-semibold gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary"
              >
                {hasMoreStores ? <>Show more <ArrowRight className="w-4 h-4" /></> : <>All Stores Shown</>}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── BROWSE BY LOCATION ── */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold tracking-widest uppercase text-primary mb-1">Browse by Location</p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold">Find Halal Stores Near You</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">Use your GPS location to find nearby halal stores</p>
            </motion.div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {geoStatus !== 'granted' && (
                <Button onClick={requestLocation}
                  className="hg-gradient-primary border-0 text-white rounded-xl h-10 px-5 gap-2 font-semibold">
                  <Navigation className="w-4 h-4" /> Use My Location
                </Button>
              )}
            </div>
          </div>

          {/* GPS states */}
          {geoStatus === 'idle' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Navigation className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Choose How to Browse</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">Share your location to see halal stores sorted by distance from you.</p>
              <Button onClick={requestLocation} className="hg-gradient-primary border-0 text-white rounded-xl h-11 px-8 gap-2 font-semibold">
                <Navigation className="w-4 h-4" /> Use My GPS Location
              </Button>
            </motion.div>
          )}

          {geoStatus === 'loading' && (
            <div className="rounded-2xl bg-muted/40 p-10 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Detecting your location…</p>
            </div>
          )}

          {(geoStatus === 'denied' || geoStatus === 'error') && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-amber-50 border border-amber-200 p-8 text-center">
              <MapPin className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <h3 className="font-semibold text-amber-900 mb-1">Location Access Unavailable</h3>
              <p className="text-amber-700 text-sm max-w-sm mx-auto mb-4">
                {geoStatus === 'denied'
                  ? 'Location permission was denied. Please enable location access in your browser settings to browse nearby stores.'
                  : 'Your browser doesn\'t support geolocation. Try using a different browser.'}
              </p>
              {geoStatus === 'denied' && (
                <Button onClick={requestLocation} variant="outline" className="rounded-xl border-amber-300 text-amber-800 hover:bg-amber-100 gap-2">
                  <Navigation className="w-4 h-4" /> Try Again
                </Button>
              )}
            </motion.div>
          )}

          {geoStatus === 'granted' && (
            <>
              {/* Filter tags */}
              {!storesLoading && storesSortedByDistance.length > 0 && (
                <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-8">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter nearby stores">
                    {nearbyFilterTags.map(tag => {
                      const active = nearbyFilter === tag.id;
                      return (
                        <button key={tag.id} type="button" role="tab" aria-selected={active}
                          onClick={() => setNearbyFilter(tag.id)}
                          className={'shrink-0 whitespace-nowrap rounded-full px-4 h-9 text-sm font-semibold border transition-colors ' + (active ? 'bg-primary text-white border-primary shadow-sm' : 'bg-card text-foreground border-border/60 hover:bg-muted')}
                        >{tag.label}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {storesLoading
                  ? Array.from({ length: 3 }).map((_, i) => <StoreCardSkeleton key={i} />)
                  : visibleNearby.length === 0
                    ? (
                      <div className="col-span-full py-12 text-center">
                        <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="font-semibold text-muted-foreground">No stores found nearby</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">There are no halal stores near your current location yet.</p>
                      </div>
                    )
                    : visibleNearby.map((store, i) => {
                        const distMi = (store as any)._distKm !== Infinity
                          ? ((store as any)._distKm * 0.621371).toFixed(1)
                          : null;
                        return (
                          <motion.div key={store.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 6) * 0.05 }}>
                            <div className="relative">
                              <StoreCard store={store} />
                              {distMi && (
                                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/65 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full pointer-events-none">
                                  <Navigation className="w-3 h-3" />
                                  {distMi} mi
                                </div>
                              )}
                              <a
                                href={store.lat && store.lng
                                  ? `https://maps.google.com/maps?q=${store.lat},${store.lng}`
                                  : `https://www.google.com/maps/search/${encodeURIComponent((store.name || '') + ' ' + (store.city || ''))}`}
                                target="_blank" rel="noopener noreferrer"
                                className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-black/65 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-black/80 transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                <MapPin className="w-3 h-3" /> Directions
                              </a>
                            </div>
                          </motion.div>
                        );
                      })
                }
              </div>

              {!storesLoading && hasMoreNearby && (
                <div className="mt-10 flex justify-center">
                  <Button onClick={() => setNearbyCount(c => c + 3)} variant="outline"
                    className="rounded-full px-8 h-11 border-primary/30 text-primary hover:bg-primary hover:text-white font-semibold gap-2">
                    Show 3 More <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-primary mb-2">Simple Process</p>
            <h2 className="font-serif text-4xl font-bold mb-2">How It Works</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Shop fresh halal groceries from certified local stores — clear, easy, and done right.</p>
          </motion.div>

          <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-6 sm:gap-8 relative">
            {/* Connector lines — visible on tablet+ */}
            <div className="hidden min-[480px]:block absolute top-10 left-1/3 right-1/3 h-px bg-border z-0" />
            {[
              { num: '01', icon: Search, color: 'bg-primary', title: 'Find Your Store', body: 'Browse nearby certified halal stores by location, ratings, or specialty. All stores are halal verified.' },
              { num: '02', icon: Package, color: 'bg-violet-500', title: 'Build Your Order', body: 'Order fresh meat with custom cut specs — boneless, bone-in, ground. Or add packaged groceries, spices, and more.' },
              { num: '03', icon: Clock, color: 'bg-amber-500', title: 'Pick Up Fast', body: 'Walk in for express pickup, stay in your car for curbside. Flash your QR code and you\'re done in seconds.' },
            ].map((step, i) => (
              <motion.div key={step.num} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative z-10 group flex min-[480px]:flex-col items-center min-[480px]:items-center gap-4 min-[480px]:gap-0 min-[480px]:text-center"
              >
                {/* Step connector for mobile — vertical line between steps */}
                {i < 2 && (
                  <div className="min-[480px]:hidden absolute left-[39px] top-[80px] w-px h-[calc(100%+24px)] bg-border z-0" />
                )}
                <div className="relative inline-block shrink-0 min-[480px]:mb-6">
                  <div className={`w-20 h-20 rounded-2xl ${step.color} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
                    <step.icon className="w-9 h-9 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shadow">{step.num}</span>
                </div>
                <div className="min-[480px]:block">
                  <h3 className="font-serif text-xl font-semibold mb-1 min-[480px]:mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed min-[480px]:max-w-[260px] min-[480px]:mx-auto">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* ── COMMUNITY REVIEWS ── */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-primary mb-2">Reviews</p>
            <h2 className="font-serif text-4xl font-bold mb-2">Loved by the Community</h2>
            <p className="text-muted-foreground">Trusted by thousands of Muslim families across the USA</p>
            <Button onClick={() => setShowReviewModal(true)} variant="outline" size="sm" className="mt-4 rounded-xl gap-1.5 text-xs">
              <PenLine className="w-3.5 h-3.5" /> Share Your Experience
            </Button>
          </motion.div>
          {platformReviews.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No reviews yet — be the first to share your experience!
            </div>
          ) : (
            <>
              {/* Mobile: 1-card-at-a-time swipe carousel */}
              <div className="md:hidden">
                <SiteReviewCarousel reviews={platformReviews} />
              </div>

              {/* Tablet (2-col) / Desktop (3-col) equal-height grid */}
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                {platformReviews.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (i % 3) * 0.08 }}
                    className="h-full"
                  >
                    <SiteReviewCard r={r} />
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {showReviewModal && (
        <ReviewModal
          targetType="platform"
          targetName="Numa Fresh"
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => refetchPlatformReviews()}
        />
      )}
      <div className="h-16 md:h-0" />
    </>
  );
}
