import { useState, useRef, useEffect } from 'react';
import { X, Search, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCart, type ReplacementPreference } from '@/contexts/CartContext';
import type { CartItem } from '@/contexts/CartContext';

interface ChooseReplacementModalProps {
  item: CartItem | null;
  storeProducts?: Array<{
    id: string;
    name: string;
    price: number;
    unit: string;
    images?: string[];
    category?: string;
  }>;
  onClose: () => void;
}

const OPTION_EMOJIS = {
  specific: '🔍',
  best_match: '🤝',
  refund: '💰',
};

export function ChooseReplacementModal({ item, storeProducts = [], onClose }: ChooseReplacementModalProps) {
  const { updateReplacement } = useCart();
  const [selection, setSelection] = useState<ReplacementPreference>(item?.replacementPreference ?? null);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(item?.replacementProductId);
  const [search, setSearch] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);

  /* Body lock */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* Backdrop click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!item) return null;

  const handleSave = () => {
    if (selection) {
      updateReplacement(item.product.id, selection, selectedProductId);
    } else {
      updateReplacement(item.product.id, null, undefined);
    }
    onClose();
  };

  const img = item.product.images?.[0] || '';
  const alternatives = storeProducts
    .filter(p => p.id !== item.product.id && (!search || p.name.toLowerCase().includes(search.toLowerCase())))
    .slice(0, 6);

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[70] backdrop-blur-sm"
        />

        {/* Bottom Sheet */}
        <motion.div
          ref={sheetRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[71] bg-background rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-2 pb-4 border-b border-border/40">
            {img && (
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
                <img src={img} alt={item.product.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight line-clamp-1">{item.product.name}</p>
              <p className="text-xs text-muted-foreground">{item.product.unit} · {item.quantity} ct</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <p className="font-bold text-base">If out of stock…</p>

            {/* Option 1: Replace with specific item */}
            <div
              className={`rounded-2xl border-2 transition-all cursor-pointer ${selection === 'specific' ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border/70'}`}
              onClick={() => setSelection('specific')}
            >
              <div className="flex items-center gap-3 p-4">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selection === 'specific' ? 'border-primary' : 'border-muted-foreground/40'}`}>
                  {selection === 'specific' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Replace with specific item</p>
                </div>
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>

              {/* Product alternatives */}
              <AnimatePresence>
                {selection === 'specific' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Search for replacement..."
                          className="w-full text-sm pl-8 pr-3 py-2 rounded-xl border border-border/50 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>

                      {alternatives.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-3">No alternatives found</p>
                      ) : (
                        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar snap-x">
                          {alternatives.map(alt => {
                            const altImg = alt.images?.[0] || '';
                            const isSelected = selectedProductId === alt.id;
                            return (
                              <button
                                key={alt.id}
                                onClick={e => { e.stopPropagation(); setSelectedProductId(isSelected ? undefined : alt.id); }}
                                className={`flex-none w-28 rounded-xl border-2 overflow-hidden text-left snap-start transition-all ${isSelected ? 'border-primary shadow-md' : 'border-border/40 hover:border-border/70'}`}
                              >
                                <div className="relative w-full aspect-square bg-muted">
                                  {altImg ? (
                                    <img src={altImg} alt={alt.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl">🛒</div>
                                  )}
                                  {isSelected && (
                                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                      <span className="text-white text-[10px] font-bold">✓</span>
                                    </div>
                                  )}
                                </div>
                                <div className="p-2">
                                  <p className="font-bold text-xs">${alt.price.toFixed(2)}</p>
                                  <p className="text-[11px] leading-tight line-clamp-2 text-foreground">{alt.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{alt.unit}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Option 2: Replace with best match */}
            <div
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selection === 'best_match' ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border/70'}`}
              onClick={() => setSelection('best_match')}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selection === 'best_match' ? 'border-primary' : 'border-muted-foreground/40'}`}>
                {selection === 'best_match' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="font-semibold text-sm">Replace with best match</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your shopper will look for the most similar item.</p>
              </div>
              <RefreshCw className="w-4 h-4 text-muted-foreground ml-auto shrink-0 mt-0.5" />
            </div>

            {/* Option 3: Refund */}
            <div
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selection === 'refund' ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border/70'}`}
              onClick={() => setSelection('refund')}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selection === 'refund' ? 'border-primary' : 'border-muted-foreground/40'}`}>
                {selection === 'refund' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="font-semibold text-sm">Refund this item</p>
                <p className="text-xs text-muted-foreground mt-0.5">Item will be refunded, not replaced.</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border/40 bg-background">
            <Button
              className="w-full hg-gradient-primary border-0 text-white rounded-2xl font-semibold"
              style={{ height: 52 }}
              onClick={handleSave}
              disabled={!selection}
            >
              Save
            </Button>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
