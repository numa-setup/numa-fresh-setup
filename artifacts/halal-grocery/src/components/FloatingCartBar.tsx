import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useLocation } from 'wouter';

export function FloatingCartBar() {
  const { itemCount, subtotal, storeName } = useCart();
  const [location] = useLocation();

  /* Only show on store/product pages, not on cart/checkout itself */
  const hideOn = ['/cart', '/checkout', '/orders', '/account', '/admin', '/store-portal', '/store-login', '/login', '/signup'];
  const shouldHide = hideOn.some(p => location.startsWith(p));

  const convenienceFee = 2.99;
  const total = subtotal + convenienceFee;

  return (
    <AnimatePresence>
      {itemCount > 0 && !shouldHide && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 260 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
        >
          <Link href="/cart">
            <div className="hg-gradient-primary rounded-2xl shadow-2xl shadow-primary/40 px-4 py-3 flex items-center gap-3 cursor-pointer hover:opacity-95 active:scale-95 transition-all">
              {/* Cart icon + count badge */}
              <div className="relative shrink-0">
                <ShoppingCart className="w-6 h-6 text-white" />
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-primary text-[11px] font-black flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-none">
                  {storeName ? `${storeName}` : 'Your cart'}
                </p>
                <p className="text-white/70 text-xs mt-0.5">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
              </div>

              {/* Total + chevron */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-white font-bold text-base">${total.toFixed(2)}</span>
                <ChevronRight className="w-5 h-5 text-white/80" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
