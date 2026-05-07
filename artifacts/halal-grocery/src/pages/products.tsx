import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { useLocation } from 'wouter';

const PRODUCT_TYPES = [
  { value: '_all', label: 'All Types' },
  { value: 'FRESH_MEAT', label: '🥩 Fresh Meat' },
  { value: 'PRODUCE', label: '🌿 Produce' },
  { value: 'SPICES', label: '🌶️ Spices' },
  { value: 'PACKAGED', label: '📦 Packaged' },
  { value: 'DAIRY', label: '🥛 Dairy' },
  { value: 'BAKERY', label: '🥖 Bakery' },
  { value: 'FROZEN', label: '🧊 Frozen' },
  { value: 'BEVERAGES', label: '🥤 Beverages' },
];

export default function ProductsPage() {
  const [loc] = useLocation();
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : loc.split('?')[1] || ''
  );
  const initialType = params.get('productType') || '';
  const initialSearch = params.get('search') || '';

  const [search, setSearch] = useState(initialSearch);
  const [inputValue, setInputValue] = useState(initialSearch);
  const [productType, setProductType] = useState(initialType);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useProducts({ search, productType: productType || undefined, page, limit: 20 });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue);
    setPage(1);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif font-bold text-3xl mb-1">All Products</h1>
          <p className="text-muted-foreground">Browse our full selection of halal-certified products</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>
            <Button type="submit" className="hg-gradient-primary border-0 text-white">Search</Button>
          </form>
          <Select value={productType || '_all'} onValueChange={v => { setProductType(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : data?.products && data.products.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {data.total.toLocaleString()} product{data.total !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {data.products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {data.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {data.totalPages}</span>
                <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={page === data.totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-serif font-semibold text-xl mb-2">No Products Found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
