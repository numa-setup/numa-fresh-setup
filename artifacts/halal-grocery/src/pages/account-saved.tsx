import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { Heart, Trash2, ShoppingCart, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { AccountSidebar } from '@/components/layout/AccountSidebar';
import { useSavedProducts, useToggleSaved } from '@/lib/saves';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#f1f5f1"/><g fill="#9ca39c" font-family="system-ui,sans-serif" text-anchor="middle"><text x="300" y="295" font-size="64">📦</text><text x="300" y="360" font-size="22">No image</text></g></svg>`
);

function SavedRow({ item }: { item: ReturnType<typeof useSavedProducts>['data'] extends (infer T)[] | undefined ? T : never }) {
  const { addItem, setStoreInfo } = useCart();
  const saved = useToggleSaved(item.product.id);
  const img = item.product.images?.[0] || PLACEHOLDER_IMG;
  const inStock = item.product.stockQty > 0;

  const handleAdd = () => {
    setStoreInfo(item.store.id, item.store.slug, item.store.name);
    addItem(item.product as unknown as Product, 1);
    toast.success(`${item.product.name} added to cart`);
  };

  const handleRemove = () => {
    saved.setSaved(false);
    toast.success('Removed from saved');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-card rounded-2xl border border-border/50 p-3 sm:p-4 flex gap-3 sm:gap-4"
    >
      <Link href={`/products/${item.product.slug}`}>
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted/40 flex-shrink-0 cursor-pointer">
          <img src={img} alt={item.product.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
        </div>
      </Link>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start gap-2">
          <Link href={`/products/${item.product.slug}`} className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm sm:text-base truncate hover:text-primary cursor-pointer">{item.product.name}</h3>
          </Link>
          {item.product.isHalalCertified && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] rounded-md hidden sm:inline-flex">Halal</Badge>
          )}
        </div>
        <Link href={`/store/${item.store.slug}`}>
          <p className="text-xs text-muted-foreground hover:text-primary truncate cursor-pointer">{item.store.name} · {item.store.city}</p>
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-base sm:text-lg font-bold text-primary">${item.product.price.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground"> / {item.product.unit}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive h-9 w-9 p-0"
              onClick={handleRemove}
              disabled={saved.pending}
              aria-label="Remove from saved"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="hg-gradient-primary border-0 text-white rounded-xl gap-1.5 h-9"
              onClick={handleAdd}
              disabled={!inStock}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {inStock ? 'Add' : 'Out'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AccountSavedPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: items, isLoading } = useSavedProducts();

  return (
    <>
      <Helmet><title>Saved Items · Numa Fresh</title></Helmet>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          <AccountSidebar active="saved" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              </div>
              <div>
                <h1 className="font-serif font-bold text-2xl">Saved Items</h1>
                <p className="text-xs text-muted-foreground">Products you've saved for later</p>
              </div>
            </div>

            {!user && !authLoading && (
              <div className="bg-card rounded-2xl border border-border/50 p-10 text-center">
                <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">Sign in to see your saved items</h3>
                <p className="text-sm text-muted-foreground mb-4">Tap the heart on any product to save it for later.</p>
                <Link href="/login"><Button className="rounded-xl">Sign In</Button></Link>
              </div>
            )}

            {user && isLoading && (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />)}
              </div>
            )}

            {user && !isLoading && (!items || items.length === 0) && (
              <div className="bg-card rounded-2xl border border-border/50 p-10 text-center">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">No saved items yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Tap the heart on any product to save it for later.</p>
                <Link href="/"><Button variant="outline" className="rounded-xl">Browse Stores</Button></Link>
              </div>
            )}

            {user && items && items.length > 0 && (
              <div className="space-y-3">
                {items.map(item => (
                  <SavedRow key={item.product.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
