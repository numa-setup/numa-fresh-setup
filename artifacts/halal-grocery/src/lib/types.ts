export type UserRole = 'CUSTOMER' | 'STORE_OWNER' | 'STORE_STAFF' | 'ADMIN';
export type OrderStatus = 'PENDING' | 'STORE_CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type OrderType = 'EXPRESS_PICKUP' | 'SCHEDULED_PICKUP' | 'CURBSIDE' | 'DELIVERY';
export type ProductType = 'FRESH_MEAT' | 'PRODUCE' | 'SPICES' | 'PACKAGED' | 'DAIRY' | 'BAKERY' | 'FROZEN' | 'BEVERAGES' | 'OTHER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  role: UserRole;
  loyaltyPoints: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  nameUrdu?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  lat?: number | null;
  lng?: number | null;
  logo?: string | null;
  banner?: string | null;
  cardImage?: string | null;
  isActive: boolean;
  isApproved: boolean;
  isHalalCertified: boolean;
  halalCertNumber?: string | null;
  halalCertBody?: string | null;
  rating: number;
  totalRatings: number;
  commissionRate: number;
  convenienceFee: number;
  minOrderAmount: number;
  avgPrepTimeMinutes: number;
  deliveryAvailable: boolean;
  deliveryFee: number;
  deliveryRadiusKm?: number | null;
  pickupAvailable: boolean;
  curbsideAvailable: boolean;
  curbsideFee: number;
  openingHoursJson?: Record<string, { open: string; close: string }> | null;
  storeCategories?: Array<{ name: string; emoji?: string; imageUrl?: string }> | null;
  isMasjidAffiliated: boolean;
  masjidName?: string | null;
  productsCount?: number;
  recentReviews?: Review[];
}

export interface Product {
  id: string;
  storeId: string;
  slug: string;
  name: string;
  description?: string | null;
  images?: string[];
  productType: ProductType;
  category: string;
  subcategory?: string | null;
  price: number;
  comparePrice?: number | null;
  unit: string;
  stockQty: number;
  isFreshMeat: boolean;
  meatAnimalType?: string | null;
  pricePerKg?: number | null;
  availableCuts?: string[];
  freshnessLabel?: string | null;
  isHalalCertified: boolean;
  isFeatured: boolean;
  isActive: boolean;
  tags?: string[];
  createdAt: string;
  store?: { id: string };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  storeId: string;
  status: OrderStatus;
  orderType: OrderType;
  subtotal: number;
  convenienceFee: number;
  deliveryFee: number;
  curbsideFee: number;
  discount: number;
  tip: number;
  estimatedTotal: number;
  finalTotal: number;
  paymentStatus: string;
  specialInstructions?: string | null;
  completedAt?: string | null;
  createdAt: string;
  items: OrderItem[];
  store?: Store;
  statusHistory?: OrderStatusHistory[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  name: string;
  productType: ProductType;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  isFreshMeat: boolean;
  selectedCut?: string | null;
  cutInstructions?: string | null;
  weightKg?: number | null;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  note?: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  storeId: string;
  orderId?: string | null;
  rating: number;
  comment?: string | null;
  reply?: string | null;
  isPublic: boolean;
  createdAt: string;
  user?: { firstName: string; lastName: string; avatar?: string | null };
}

export interface PickupSlot {
  id: string;
  storeId: string;
  date: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  bookedOrders: number;
  spotsLeft: number;
  isAvailable: boolean;
}

export interface PromoValidation {
  valid: boolean;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedCut?: string;
  cutInstructions?: string;
  weightKg?: number;
}
