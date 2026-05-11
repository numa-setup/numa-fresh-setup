import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import type { Product } from '@/lib/types';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedCut?: string;
  cutInstructions?: string;
  weightKg?: number;
}

interface AddOptions {
  selectedCut?: string;
  cutInstructions?: string;
  weightKg?: number;
}

interface CartContextValue {
  items: CartItem[];
  storeId: string | null;
  storeSlug: string | null;
  storeName: string | null;
  addItem: (product: Product, quantity?: number, options?: AddOptions) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setStoreInfo: (id: string, slug: string, name: string) => void;
  promptStoreSwitchAndAdd: (
    product: Product,
    newStoreId: string,
    newStoreSlug: string,
    newStoreName: string,
    quantity?: number,
    options?: AddOptions,
  ) => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = 'numa-fresh-cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { items?: CartItem[]; storeId?: string; storeSlug?: string; storeName?: string };
          setItems(parsed.items ?? []);
          setStoreId(parsed.storeId ?? null);
          setStoreSlug(parsed.storeSlug ?? null);
          setStoreName(parsed.storeName ?? null);
        } catch {
        }
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify({ items, storeId, storeSlug, storeName }));
  }, [items, storeId, storeSlug, storeName]);

  const setStoreInfo = useCallback((id: string, slug: string, name: string) => {
    setStoreId(id);
    setStoreSlug(slug);
    setStoreName(name);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setStoreId(null);
    setStoreSlug(null);
    setStoreName(null);
  }, []);

  const addItem = useCallback(
    (product: Product, quantity = 1, options?: AddOptions): boolean => {
      if (storeId && product.storeId !== storeId) {
        return false;
      }
      setItems((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + quantity, ...(options ?? {}) }
              : i,
          );
        }
        return [...prev, { product, quantity, ...(options ?? {}) }];
      });
      return true;
    },
    [storeId],
  );

  const addItemWithStoreClear = useCallback(
    (
      product: Product,
      newStoreId: string,
      newStoreSlug: string,
      newStoreName: string,
      quantity = 1,
      options?: AddOptions,
    ) => {
      setItems([{ product, quantity, ...(options ?? {}) }]);
      setStoreId(newStoreId);
      setStoreSlug(newStoreSlug);
      setStoreName(newStoreName);
    },
    [],
  );

  const promptStoreSwitchAndAdd = useCallback(
    (
      product: Product,
      newStoreId: string,
      newStoreSlug: string,
      newStoreName: string,
      quantity = 1,
      options?: AddOptions,
    ) => {
      Alert.alert(
        'Switch Store?',
        `Your cart has items from ${storeName}. Starting a new order from ${newStoreName} will clear your current cart.`,
        [
          { text: 'Keep Cart', style: 'cancel' },
          {
            text: 'Switch Store',
            style: 'destructive',
            onPress: () =>
              addItemWithStoreClear(product, newStoreId, newStoreSlug, newStoreName, quantity, options),
          },
        ],
      );
    },
    [storeName, addItemWithStoreClear],
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.product.id !== productId);
      if (updated.length === 0) {
        setStoreId(null);
        setStoreSlug(null);
        setStoreName(null);
      }
      return updated;
    });
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }
      setItems((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)));
    },
    [removeItem],
  );

  const itemCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.product.price * i.quantity, 0), [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      storeId,
      storeSlug,
      storeName,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      setStoreInfo,
      promptStoreSwitchAndAdd,
      itemCount,
      subtotal,
    }),
    [items, storeId, storeSlug, storeName, addItem, removeItem, updateQuantity, clearCart, setStoreInfo, promptStoreSwitchAndAdd, itemCount, subtotal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
