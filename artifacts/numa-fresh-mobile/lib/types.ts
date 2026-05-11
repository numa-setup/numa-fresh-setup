export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'CUSTOMER' | 'STORE_OWNER' | 'ADMIN';
  loyaltyPoints?: number;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  city: string;
  province?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  logo?: string;
  banner?: string;
  cardImage?: string;
  rating?: number;
  totalRatings?: number;
  isHalalCertified?: boolean;
  pickupAvailable?: boolean;
  curbsideAvailable?: boolean;
  deliveryAvailable?: boolean;
  avgPrepTimeMinutes?: number;
  convenienceFee?: number;
  curbsideFee?: number;
  deliveryFee?: number;
  minOrderAmount?: number;
  lat?: number;
  lng?: number;
}

export interface Product {
  id: string;
  slug?: string;
  storeId: string;
  storeSlug?: string;
  store?: { id: string; name: string; slug: string };
  name: string;
  description?: string;
  category: string;
  price: number;
  comparePrice?: number;
  images?: string[];
  isActive?: boolean;
  isAvailable?: boolean;
  isFreshMeat?: boolean;
  availableCuts?: string[];
  stockQty?: number;
  unit?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unitPrice?: number;
  totalPrice?: number;
  productId: string;
  meatCutType?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  createdAt: string;
  estimatedTotal?: number;
  finalTotal?: number;
  items: OrderItem[];
  store?: { id: string; name: string; slug: string };
  statusHistory?: Array<{ status: string; createdAt: string; note?: string }>;
  pickupSlot?: { date: string; time: string };
  specialInstructions?: string;
  qrCode?: string;
}

export interface Address {
  id: string;
  line1?: string;
  street?: string;
  city: string;
  province: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface PickupSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  availableCapacity: number;
}

export interface LoyaltyTransaction {
  id: string;
  type: 'EARN' | 'SPEND';
  points: number;
  description: string;
  createdAt: string;
}

export interface LoyaltyData {
  points: number;
  pointsValue: number;
  tier: string;
  nextTierPoints: number;
  transactions: LoyaltyTransaction[];
}

export interface MealPlanIngredient {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  priceEach: number;
  totalPrice: number;
  storeSlug: string;
  storeName: string;
}

export interface MealPlan {
  planTitle?: string;
  summary?: string;
  totalEstimatedCost?: number;
  budgetSavings?: number;
  nutritionHighlights?: string[];
  tips?: string[];
  days: Array<{
    dayNumber?: number;
    dayLabel?: string;
    meals: Array<{
      mealType?: string;
      name?: string;
      description?: string;
      estimatedCost?: number;
      prepTime?: string;
      cookTime?: string;
      ingredients: MealPlanIngredient[];
    }>;
  }>;
}

export interface MealPlanProductEntry {
  id: string;
  name: string;
  price: number;
  category: string;
  images?: string[];
  storeId: string;
  storeSlug: string;
  storeName: string;
}

export interface MealPlanResponse {
  success: boolean;
  plan: MealPlan;
  metadata: Record<string, unknown>;
  productMap: Record<string, MealPlanProductEntry>;
}

export interface ServerError {
  response?: { data?: { message?: string } };
  message?: string;
}
