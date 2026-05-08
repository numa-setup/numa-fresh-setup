import { useState } from 'react';
import { Search, SlidersHorizontal, MapPin, Truck, Package, Star, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StoreCard } from '@/components/StoreCard';
import { StoreCardSkeleton } from '@/components/LoadingSkeleton';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { Store } from '@/lib/types';

interface StoreFilters {
  search: string;
  pickup: boolean;
  delivery: boolean;
  halalCertified: boolean;
  minRating: number;
  city: string;
}

const RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 4, label: '4+ Stars' },
  { value: 4.5, label: '4.5+ Stars' },
];

export default function StoresPage() {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState<StoreFilters>({
    search: '',
    pickup: false,
    delivery: false,
    halalCertified: false,
    minRating: 0,
    city: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery<{ stores: Store[]; total: number }>({
    queryKey: ['stores-browse', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filters.search) params.set('search', filters.search);
      if (filters.pickup) params.set('pickup', 'true');
      if (filters.delivery) params.set('delivery', 'true');
      if (filters.halalCertified) params.set('halalCertified', 'true');
      if (filters.minRating > 0) params.set('minRating', String(filters.minRating));
      if (filters.city) params.set('city', filters.city);
      return api.get<{ stores: Store[]; total: number }>(`/stores?${params.toString()}`);
    },
  });

  const stores = data?.stores ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(f => ({ ...f, search: inputValue }));
  };

  const clearFilters = () => {
    setInputValue('');
    setFilters({ search: '', pickup: false, delivery: false, halalCertified: false, minRating: 0, city: '' });
  };

  const activeFilterCount = [
    filters.pickup, filters.delivery, filters.halalCertified, filters.minRating > 0, !!filters.city,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl mb-2">Browse Stores</h1>
          <p className="text-muted-foreground">
            {data ? `${data.total} halal-certified store${data.total !== 1 ? 's' : ''} available` : 'Discover halal-certified grocery stores near you'}
          </p>
        </div>

        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Search by name or city..."
                className="pl-9"
              />
            </div>
            <Button type="submit" className="hg-gradient-primary border-0 text-white">Search</Button>
          </form>
          <Button
            variant="outline"
            onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="hg-gradient-primary text-white text-xs px-1.5 py-0 h-5 min-w-5 justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-card border border-border/60 rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setFilters(f => ({ ...f, pickup: !f.pickup }))}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${filters.pickup ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/50'}`}
            >
              <Package className="h-3.5 w-3.5" />
              Pickup
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, delivery: !f.delivery }))}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${filters.delivery ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/50'}`}
            >
              <Truck className="h-3.5 w-3.5" />
              Delivery
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, halalCertified: !f.halalCertified }))}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${filters.halalCertified ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/50'}`}
            >
              Halal Certified
            </button>

            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <select
                value={filters.minRating}
                onChange={e => setFilters(f => ({ ...f, minRating: Number(e.target.value) }))}
                className="text-sm border border-border rounded-full px-3 py-1.5 bg-background outline-none"
              >
                {RATING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filters.city}
                onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
                placeholder="City..."
                className="h-8 text-sm w-32 rounded-full"
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground ml-auto"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => <StoreCardSkeleton key={i} />)}
          </div>
        ) : stores.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {stores.map(store => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏪</div>
            <h3 className="font-serif font-semibold text-xl mb-2">No Stores Found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
            <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
          </div>
        )}
      </div>
    </div>
  );
}
