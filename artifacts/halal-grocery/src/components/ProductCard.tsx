import { useState } from 'react';
import { Link } from 'wouter';
import { Plus, Minus, Leaf, Award, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import type { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product;
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
}

const PRODUCT_TYPE_COLORS: Record<string, string> = {
  FRESH_MEAT: 'bg-red-50 text-red-700 border-red-100',
  PRODUCE: 'bg-green-50 text-green-700 border-green-100',
  SPICES: 'bg-orange-50 text-orange-700 border-orange-100',
  PACKAGED: 'bg-blue-50 text-blue-700 border-blue-100',
  DAIRY: 'bg-sky-50 text-sky-700 border-sky-100',
  BAKERY: 'bg-amber-50 text-amber-700 border-amber-100',
  FROZEN: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  BEVERAGES: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  OTHER: 'bg-gray-50 text-gray-700 border-gray-100',
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FRESH_MEAT: 'Fresh Meat', PRODUCE: 'Produce', SPICES: 'Spices',
  PACKAGED: 'Packaged', DAIRY: 'Dairy', BAKERY: 'Bakery',
  FROZEN: 'Frozen', BEVERAGES: 'Beverages', OTHER: 'Other',
};

export function ProductCard({ product, storeId, storeSlug, storeName }: ProductCardProps) {
  const { items, addItem, updateQuantity, setStoreInfo } = useCart();
  const cartItem = items.find(i => i.product.id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const [adding, setAdding] = useState(false);

  const discount = product.comparePrice && product.comparePrice > product.price
    ? Math.round((1 - product.price / product.comparePrice) * 100)
    : null;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (storeId && storeSlug && storeName) {
      setStoreInfo(storeId, storeSlug, storeName);
    }
    addItem(product, 1);
    setAdding(true);
    setTimeout(() => setAdding(false), 600);
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, qty - 1);
  };

  const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f1f5f1"/><g fill="#9ca39c" font-family="system-ui,sans-serif" text-anchor="middle"><text x="200" y="200" font-size="48">📦</text><text x="200" y="245" font-size="14">No image</text></g></svg>`
  );
  const realImg = (product.images || []).find(u => u && u.trim()) || (product as any).imageUrl;
  const image = realImg || PLACEHOLDER_IMG;
  const productHref = `/products/${product.slug || product.id}`;
  const storeHref = storeSlug
    ? `/stores/${storeSlug}`
    : (product as any).store?.slug
      ? `/stores/${(product as any).store.slug}`
      : null;

  const displayStoreName = storeName || (product as any).store?.name;
  const displayStoreSlug = storeSlug || (product as any).store?.slug;

  return (
    <div className={`group relative bg-card rounded-xl sm:rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 flex flex-col h-full ${qty > 0 ? 'border-primary/40 shadow-md shadow-primary/10' : 'border-border/50 hover:border-border/80 hover:shadow-md'}`}>
      {/* Image area — links to product detail */}
      <Link href={productHref} className="block relative">
        <div className="relative overflow-hidden bg-muted/20 max-h-[160px] sm:max-h-none" style={{ aspectRatio: '4/3' }}>
          <img
            src={image}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                -{discount}%
              </span>
            )}
            {product.isFeatured && !discount && (
              <span className="hg-gold-badge text-[10px] font-semibold px-1.5 py-0.5 rounded-md">★ Featured</span>
            )}
          </div>

          {/* Freshness label */}
          {product.freshnessLabel && (
            <div className="absolute bottom-2 left-2">
              <span className="flex items-center gap-1 bg-green-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow">
                <Leaf className="h-2.5 w-2.5" /> {product.freshnessLabel}
              </span>
            </div>
          )}

          {/* Out of stock overlay */}
          {product.stockQty === 0 && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground bg-background border border-border rounded-lg px-2 py-1">Out of Stock</span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-2 sm:p-3 flex flex-col flex-1">
        <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
          <span className={`text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded border ${PRODUCT_TYPE_COLORS[product.productType] || PRODUCT_TYPE_COLORS.OTHER}`}>
            {PRODUCT_TYPE_LABELS[product.productType] || product.productType}
          </span>
          {product.isHalalCertified && (
            <Award className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
          )}
        </div>

        <Link href={productHref}>
          <h3 className="font-medium text-xs sm:text-sm leading-snug line-clamp-2 mb-0.5 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground">{product.unit}</p>

        {/* Store name */}
        {displayStoreName && displayStoreHref(displayStoreSlug) && (
          <Link href={displayStoreHref(displayStoreSlug)!} onClick={e => e.stopPropagation()}>
            <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] text-primary/70 hover:text-primary font-medium mt-0.5 sm:mt-1 transition-colors">
              <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              {displayStoreName}
            </span>
          </Link>
        )}

        <div className="mt-auto pt-2 sm:pt-3 flex items-center justify-between">
          {/* Price */}
          <div>
            <span className="font-bold text-sm sm:text-base">${product.price.toFixed(2)}</span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span className="ml-1 text-[10px] sm:text-xs text-muted-foreground line-through">${product.comparePrice.toFixed(2)}</span>
            )}
          </div>

          {/* Cart controls */}
          <AnimatePresence mode="wait">
            {qty === 0 ? (
              <motion.button
                key="add"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: adding ? 1.15 : 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={handleAdd}
                disabled={product.stockQty === 0}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hg-gradient-primary text-white flex items-center justify-center shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </motion.button>
            ) : (
              <motion.div
                key="qty"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-0 bg-primary rounded-full overflow-hidden shadow-md shadow-primary/30"
              >
                <button
                  onClick={handleDecrease}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
                <span className="text-white font-bold text-xs sm:text-sm min-w-[18px] sm:min-w-[22px] text-center">{qty}</span>
                <button
                  onClick={handleIncrease}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Active cart indicator stripe at top */}
      {qty > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 hg-gradient-primary" />
      )}
    </div>
  );
}

function displayStoreHref(slug?: string) {
  return slug ? `/stores/${slug}` : null;
}
