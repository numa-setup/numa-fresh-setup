import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import type { Product } from '@/lib/types';

export type ReplacementPreference = 'specific' | 'best_match' | 'refund' | null;

export interface CartItem {
  product: Product;
  quantity: number;
  selectedCut?: string;
  cutInstructions?: string;
  weightKg?: number;
  replacementPreference?: ReplacementPreference;
  replacementProductId?: string;
  /** Round 10 / Fix #4 — generic per-item note from customer to shopper. */
  noteForShopper?: string;
}

interface CartContextValue {
  items: CartItem[];
  storeId: string | null;
  storeSlug: string | null;
  storeName: string | null;
  addItem: (product: Product, quantity?: number, options?: { selectedCut?: string; cutInstructions?: string; weightKg?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateReplacement: (productId: string, pref: ReplacementPreference, replacementProductId?: string) => void;
  updateNote: (productId: string, note: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  setStoreInfo: (id: string, slug: string, name: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  const setStoreInfo = useCallback((id: string, slug: string, name: string) => {
    setStoreId(id);
    setStoreSlug(slug);
    setStoreName(name);
  }, []);

  const addItem = useCallback((
    product: Product,
    quantity = 1,
    options?: { selectedCut?: string; cutInstructions?: string; weightKg?: number }
  ) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + quantity, ...options }
            : i
        );
      }
      return [...prev, { product, quantity, ...options }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      const updated = prev.filter(i => i.product.id !== productId);
      if (updated.length === 0) {
        setStoreId(null);
        setStoreSlug(null);
        setStoreName(null);
      }
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity } : i));
  }, [removeItem]);

  const updateReplacement = useCallback((productId: string, pref: ReplacementPreference, replacementProductId?: string) => {
    setItems(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, replacementPreference: pref, replacementProductId: replacementProductId ?? i.replacementProductId }
        : i
    ));
  }, []);

  const updateNote = useCallback((productId: string, note: string) => {
    setItems(prev => prev.map(i =>
      i.product.id === productId ? { ...i, noteForShopper: note } : i
    ));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setStoreId(null);
    setStoreSlug(null);
    setStoreName(null);
  }, []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{
      items, storeId, storeSlug, storeName,
      addItem, removeItem, updateQuantity, updateReplacement, updateNote, clearCart,
      itemCount, subtotal, setStoreInfo,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
