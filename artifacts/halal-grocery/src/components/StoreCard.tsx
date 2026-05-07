import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { MapPin, Clock, Star, Truck, Package, CheckCircle2, Heart, Store as StoreIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Store } from '@/lib/types';

interface StoreCardProps {
  store: Store;
  featured?: boolean;
}

export function StoreCard({ store, featured }: StoreCardProps) {
  const initialImage = store.cardImage || store.banner || store.logo || null;
  const [imgSrc, setImgSrc] = useState<string | null>(initialImage);

  useEffect(() => {
    setImgSrc(initialImage);
  }, [initialImage]);

  return (
    <Link href={`/stores/${store.slug}`} className="group block">
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border/50 overflow-hidden hg-shadow-sm hover:hg-shadow-lg transition-all duration-300 hover:-translate-y-0.5">
        {/* Image */}
        <div className="relative h-28 sm:h-44 overflow-hidden bg-muted">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={store.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImgSrc(null)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center hg-gradient-primary">
              <div className="flex flex-col items-center gap-2 text-white">
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-serif font-bold text-2xl">
                  {store.name?.[0]?.toUpperCase() ?? <StoreIcon className="w-6 h-6" />}
                </div>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Badges */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5">
            {store.isHalalCertified && (
              <span className="flex items-center gap-0.5 sm:gap-1 bg-primary text-white text-[9px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Halal
              </span>
            )}
          </div>

          {featured && (
            <div className="absolute top-3 right-3">
              <span className="hg-gold-badge text-[11px] font-semibold px-2 py-0.5 rounded-full">
                Featured
              </span>
            </div>
          )}

          {/* Rating overlay */}
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3">
            <div className="flex items-center gap-0.5 sm:gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-amber-400 text-amber-400" />
              {store.rating?.toFixed(1) ?? '—'}
              <span className="text-white/70 hidden sm:inline">({store.totalRatings?.toLocaleString()})</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-4">
          <h3 className="font-serif font-semibold text-xs sm:text-base leading-snug group-hover:text-primary transition-colors line-clamp-1 mb-0.5 sm:mb-1">
            {store.name}
          </h3>

          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{store.address}, {store.city}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              ~{store.avgPrepTimeMinutes}m
            </span>
            {store.deliveryAvailable ? (
              <span className="flex items-center gap-0.5 sm:gap-1 text-primary">
                <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden xs:inline">Delivery</span>
                <span className="xs:hidden">Del</span>
              </span>
            ) : (
              <span className="flex items-center gap-0.5 sm:gap-1">
                <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Pickup
              </span>
            )}
            {store.minOrderAmount > 0 && (
              <span className="hidden sm:inline">Min ${store.minOrderAmount}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
