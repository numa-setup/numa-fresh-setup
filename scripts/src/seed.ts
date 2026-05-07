import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  usersTable, storesTable, productsTable, ordersTable, orderItemsTable,
  orderStatusHistoryTable, reviewsTable, promoCodesTable, pickupSlotsTable
} from "@workspace/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding Halal Grocery database...");

  // 1. Admin user
  const adminHash = await bcrypt.hash("Admin@123", 12);
  const [admin] = await db.insert(usersTable).values({
    email: "admin@halalgrocery.com",
    passwordHash: adminHash,
    firstName: "Admin",
    lastName: "HalalGrocery",
    role: "ADMIN",
    isVerified: true,
  }).onConflictDoNothing().returning();
  console.log("✅ Admin created");

  // 2. Store owners
  const owner1Hash = await bcrypt.hash("Owner@123", 12);
  const [owner1] = await db.insert(usersTable).values({
    email: "owner1@halalmarket.com",
    passwordHash: owner1Hash,
    firstName: "Ahmed",
    lastName: "Al-Rashid",
    phone: "+1-647-555-0101",
    role: "STORE_OWNER",
    isVerified: true,
  }).onConflictDoNothing().returning();

  const [owner2] = await db.insert(usersTable).values({
    email: "owner2@halalmarket.com",
    passwordHash: owner1Hash,
    firstName: "Fatima",
    lastName: "Khan",
    phone: "+1-905-555-0202",
    role: "STORE_OWNER",
    isVerified: true,
  }).onConflictDoNothing().returning();

  const [owner3] = await db.insert(usersTable).values({
    email: "owner3@halalmarket.com",
    passwordHash: owner1Hash,
    firstName: "Ibrahim",
    lastName: "Siddiqui",
    phone: "+1-416-555-0303",
    role: "STORE_OWNER",
    isVerified: true,
  }).onConflictDoNothing().returning();

  console.log("✅ Store owners created");

  // 3. Customer users
  const custHash = await bcrypt.hash("Customer@123", 12);
  const customers = await db.insert(usersTable).values([
    { email: "customer1@example.com", passwordHash: custHash, firstName: "Zara", lastName: "Ahmed", phone: "+1-416-555-1001", role: "CUSTOMER", isVerified: true, loyaltyPoints: 250 },
    { email: "customer2@example.com", passwordHash: custHash, firstName: "Omar", lastName: "Malik", phone: "+1-647-555-1002", role: "CUSTOMER", isVerified: true, loyaltyPoints: 750 },
    { email: "customer3@example.com", passwordHash: custHash, firstName: "Aisha", lastName: "Rahman", phone: "+1-905-555-1003", role: "CUSTOMER", isVerified: true, loyaltyPoints: 1200 },
    { email: "customer4@example.com", passwordHash: custHash, firstName: "Yusuf", lastName: "Hassan", phone: "+1-416-555-1004", role: "CUSTOMER", isVerified: true, loyaltyPoints: 50 },
    { email: "customer5@example.com", passwordHash: custHash, firstName: "Maryam", lastName: "Ali", phone: "+1-647-555-1005", role: "CUSTOMER", isVerified: true, loyaltyPoints: 0 },
  ]).onConflictDoNothing().returning();
  console.log("✅ Customers created");

  if (!owner1 || !owner2 || !owner3) {
    console.log("Owners already exist, skipping store seeding...");
    return;
  }

  // 4. Halal Stores
  const openingHours = {
    monday: { open: "09:00", close: "21:00" },
    tuesday: { open: "09:00", close: "21:00" },
    wednesday: { open: "09:00", close: "21:00" },
    thursday: { open: "09:00", close: "21:00" },
    friday: { open: "09:00", close: "22:00" },
    saturday: { open: "08:00", close: "22:00" },
    sunday: { open: "10:00", close: "20:00" },
  };

  const [store1] = await db.insert(storesTable).values({
    ownerId: owner1.id,
    slug: "al-madina-halal-mississauga",
    name: "Al Madina Halal Market",
    nameUrdu: "المدینہ حلال بازار",
    description: "Premium halal meats and fresh produce serving the Mississauga community since 2005. Certified by ISNA Canada.",
    phone: "+1-905-555-2001",
    email: "info@almadinahalal.com",
    address: "2150 Dundas St E, Unit 5",
    city: "Mississauga",
    province: "ON",
    postalCode: "L4X 2T3",
    lat: 43.6150,
    lng: -79.5772,
    isActive: true,
    isApproved: true,
    storeStatus: "approved",
    isHalalCertified: true,
    halalCertNumber: "ISNA-2024-0891",
    commissionRate: 7.0,
    convenienceFee: 2.99,
    minOrderAmount: 15.00,
    avgPrepTimeMinutes: 25,
    deliveryAvailable: true,
    deliveryFee: 4.99,
    deliveryRadiusKm: 8.0,
    pickupAvailable: true,
    curbsideAvailable: true,
    curbsideFee: 1.49,
    rating: 4.8,
    totalRatings: 342,
    openingHoursJson: openingHours,
    isMasjidAffiliated: true,
    masjidName: "Masjid Al-Noor",
  }).returning();

  const [store2] = await db.insert(storesTable).values({
    ownerId: owner2.id,
    slug: "khan-halal-grocers-brampton",
    name: "Khan's Halal Grocers",
    nameUrdu: "خان حلال گروسرز",
    description: "Your one-stop halal superstore in Brampton. Fresh daily cuts, spices from Pakistan & Middle East.",
    phone: "+1-905-555-3001",
    email: "info@khanhalalgrocers.com",
    address: "460 Rutherford Rd N, Unit 12",
    city: "Brampton",
    province: "ON",
    postalCode: "L6R 3G5",
    lat: 43.7315,
    lng: -79.7624,
    isActive: true,
    isApproved: true,
    storeStatus: "approved",
    isHalalCertified: true,
    halalCertNumber: "HALAL-CA-2024-1234",
    commissionRate: 7.5,
    convenienceFee: 2.49,
    minOrderAmount: 20.00,
    avgPrepTimeMinutes: 30,
    deliveryAvailable: false,
    pickupAvailable: true,
    curbsideAvailable: true,
    curbsideFee: 0.99,
    rating: 4.6,
    totalRatings: 218,
    openingHoursJson: openingHours,
    isMasjidAffiliated: false,
  }).returning();

  const [store3] = await db.insert(storesTable).values({
    ownerId: owner3.id,
    slug: "siddiqui-fresh-halal-toronto",
    name: "Siddiqui Fresh Halal",
    nameUrdu: "صدیقی فریش حلال",
    description: "Specialty halal butcher serving Toronto's Muslim community. Known for lamb, goat, and free-range chicken.",
    phone: "+1-416-555-4001",
    email: "info@siddiquihalal.com",
    address: "1280 Danforth Ave",
    city: "Toronto",
    province: "ON",
    postalCode: "M4J 1M9",
    lat: 43.6890,
    lng: -79.3320,
    isActive: true,
    isApproved: true,
    storeStatus: "approved",
    isHalalCertified: true,
    halalCertNumber: "IFANCA-2024-5678",
    commissionRate: 6.5,
    convenienceFee: 1.99,
    minOrderAmount: 10.00,
    avgPrepTimeMinutes: 20,
    deliveryAvailable: false,
    pickupAvailable: true,
    curbsideAvailable: false,
    rating: 4.9,
    totalRatings: 567,
    openingHoursJson: openingHours,
    isMasjidAffiliated: true,
    masjidName: "Masjid Toronto East",
  }).returning();

  console.log("✅ Stores created");

  // 5. Products - Store 1 (Al Madina)
  const store1Products = await db.insert(productsTable).values([
    // Fresh Meats
    { storeId: store1.id, slug: `al-madina-whole-chicken`, name: "Whole Halal Chicken", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Chicken", images: ["https://images.unsplash.com/photo-1588347818036-c3dba96e34b3?w=400"], price: 12.99, unit: "per bird", stockQty: 25, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 8.99, isHalalCertified: true, isFeatured: true, tags: ["chicken", "halal", "fresh"], freshnessLabel: "Slaughtered Today" },
    { storeId: store1.id, slug: `al-madina-boneless-chicken`, name: "Boneless Chicken Breast", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Chicken", images: ["https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400"], price: 18.99, unit: "per kg", stockQty: 15, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 18.99, isHalalCertified: true, tags: ["chicken", "halal", "boneless"] },
    { storeId: store1.id, slug: `al-madina-lamb-leg`, name: "Leg of Lamb", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Lamb", images: ["https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400"], price: 34.99, unit: "per kg", stockQty: 8, isFreshMeat: true, meatAnimalType: "lamb", pricePerKg: 34.99, isHalalCertified: true, isFeatured: true, tags: ["lamb", "halal", "premium"] },
    { storeId: store1.id, slug: `al-madina-ground-beef`, name: "Premium Ground Beef (Lean)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Beef", images: ["https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400"], price: 14.99, unit: "per kg", stockQty: 20, isFreshMeat: true, meatAnimalType: "beef", pricePerKg: 14.99, isHalalCertified: true, tags: ["beef", "ground", "halal"] },
    { storeId: store1.id, slug: `al-madina-goat-curry-cut`, name: "Goat Curry Cut", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Goat", images: ["https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400"], price: 22.99, unit: "per kg", stockQty: 12, isFreshMeat: true, meatAnimalType: "goat", pricePerKg: 22.99, isHalalCertified: true, isFeatured: true, tags: ["goat", "halal", "curry"] },
    // Spices
    { storeId: store1.id, slug: `al-madina-biryani-masala`, name: "House Special Biryani Masala", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Blends", images: ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"], price: 8.99, unit: "200g", stockQty: 50, isHalalCertified: true, isFeatured: true, tags: ["biryani", "spice", "masala"], description: "Secret blend of 22 spices for authentic biryani" },
    { storeId: store1.id, slug: `al-madina-cumin-whole`, name: "Whole Cumin Seeds (Zeera)", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Whole Spices", images: ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400"], price: 5.99, unit: "250g", stockQty: 80, isHalalCertified: true, tags: ["cumin", "zeera", "spice"] },
    // Produce
    { storeId: store1.id, slug: `al-madina-fresh-coriander`, name: "Fresh Coriander (Dhaniya)", productType: "PRODUCE", category: "Fresh Produce", subcategory: "Herbs", images: ["https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400"], price: 1.99, unit: "bunch", stockQty: 30, isHalalCertified: true, tags: ["coriander", "herb", "fresh"] },
    { storeId: store1.id, slug: `al-madina-bitter-gourd`, name: "Bitter Gourd (Karela)", productType: "PRODUCE", category: "Fresh Produce", subcategory: "Vegetables", images: ["https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?w=400"], price: 3.99, unit: "per kg", stockQty: 15, isHalalCertified: true, tags: ["karela", "bitter", "vegetable"] },
    // Packaged
    { storeId: store1.id, slug: `al-madina-basmati-rice-10kg`, name: "Royal Supreme Basmati Rice 10kg", productType: "PACKAGED", category: "Rice & Grains", subcategory: "Basmati", images: ["https://images.unsplash.com/photo-1536304993881-ff86e0c9ef3b?w=400"], price: 29.99, comparePrice: 34.99, unit: "10kg bag", stockQty: 40, isHalalCertified: true, isFeatured: true, tags: ["basmati", "rice", "premium"] },
    { storeId: store1.id, slug: `al-madina-mustard-oil`, name: "Mustard Oil (Cold Pressed)", productType: "PACKAGED", category: "Oils & Ghee", subcategory: "Oils", images: ["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400"], price: 12.99, unit: "1L", stockQty: 35, isHalalCertified: true, tags: ["mustard", "oil", "cold-pressed"] },
    { storeId: store1.id, slug: `al-madina-desi-ghee`, name: "Pure Desi Ghee", productType: "DAIRY", category: "Dairy & Eggs", subcategory: "Ghee", images: ["https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400"], price: 24.99, comparePrice: 27.99, unit: "1kg", stockQty: 20, isHalalCertified: true, isFeatured: true, tags: ["ghee", "desi", "butter"] },
  ].map((p) => ({ ...p, isApproved: true, approvalStatus: "approved" })) as (typeof productsTable.$inferInsert)[]).returning();

  // Store 2 Products (Khan's Halal)
  const store2Products = await db.insert(productsTable).values([
    { storeId: store2.id, slug: `khans-chicken-tikka-boneless`, name: "Chicken Tikka (Boneless)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Marinated", images: ["https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400"], price: 19.99, unit: "per kg", stockQty: 18, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 19.99, isHalalCertified: true, isFeatured: true, tags: ["tikka", "marinated", "chicken"] },
    { storeId: store2.id, slug: `khans-beef-brisket`, name: "Beef Brisket (Nihari Cut)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Beef", images: ["https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400"], price: 16.99, unit: "per kg", stockQty: 10, isFreshMeat: true, meatAnimalType: "beef", pricePerKg: 16.99, isHalalCertified: true, tags: ["beef", "nihari", "brisket"] },
    { storeId: store2.id, slug: `khans-karahi-masala`, name: "Premium Karahi Masala", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Blends", images: ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"], price: 9.99, unit: "300g", stockQty: 60, isHalalCertified: true, tags: ["karahi", "masala", "spice"] },
    { storeId: store2.id, slug: `khans-toor-dal`, name: "Yellow Toor Dal (Split Pigeon Peas)", productType: "PACKAGED", category: "Lentils & Pulses", subcategory: "Dal", images: ["https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400"], price: 11.99, unit: "2kg", stockQty: 45, isHalalCertified: true, isFeatured: true, tags: ["dal", "toor", "lentil"] },
    { storeId: store2.id, slug: `khans-medjool-dates`, name: "Medjool Dates (Premium)", productType: "PACKAGED", category: "Dried Fruits & Nuts", subcategory: "Dates", images: ["https://images.unsplash.com/photo-1584365685547-9a5fb6f3a70c?w=400"], price: 16.99, comparePrice: 19.99, unit: "500g", stockQty: 55, isHalalCertified: true, isFeatured: true, tags: ["dates", "medjool", "ramadan"] },
    { storeId: store2.id, slug: `khans-naan-bread`, name: "Fresh Naan Bread (6 pack)", productType: "BAKERY", category: "Bread & Bakery", subcategory: "Naan", images: ["https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400"], price: 3.99, unit: "6 pack", stockQty: 25, isHalalCertified: true, tags: ["naan", "bread", "fresh"] },
    { storeId: store2.id, slug: `khans-whole-milk-yogurt`, name: "Full Fat Yogurt (Dahi)", productType: "DAIRY", category: "Dairy & Eggs", subcategory: "Yogurt", images: ["https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400"], price: 5.99, unit: "1kg", stockQty: 30, isHalalCertified: true, tags: ["yogurt", "dahi", "dairy"] },
  ].map((p) => ({ ...p, isApproved: true, approvalStatus: "approved" })) as (typeof productsTable.$inferInsert)[]).returning();

  // Store 3 Products (Siddiqui)
  const store3Products = await db.insert(productsTable).values([
    { storeId: store3.id, slug: `siddiqui-whole-lamb`, name: "Whole Lamb (Cut to Order)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Lamb", images: ["https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400"], price: 299.99, unit: "whole", stockQty: 3, isFreshMeat: true, meatAnimalType: "lamb", pricePerKg: 24.99, isHalalCertified: true, isFeatured: true, tags: ["qurbani", "eid", "lamb", "whole"] },
    { storeId: store3.id, slug: `siddiqui-free-range-chicken-legs`, name: "Free-Range Chicken Legs", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Chicken", images: ["https://images.unsplash.com/photo-1616659417066-9edffc0c9eed?w=400"], price: 13.99, unit: "per kg", stockQty: 20, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 13.99, isHalalCertified: true, isFeatured: true, tags: ["chicken", "free-range", "legs"] },
    { storeId: store3.id, slug: `siddiqui-ox-tail`, name: "Oxtail Pieces", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Beef", images: ["https://images.unsplash.com/photo-1544025162-d76694265947?w=400"], price: 28.99, unit: "per kg", stockQty: 6, isFreshMeat: true, meatAnimalType: "beef", pricePerKg: 28.99, isHalalCertified: true, tags: ["oxtail", "beef", "halal"] },
    { storeId: store3.id, slug: `siddiqui-lamb-chops`, name: "Rack of Lamb Chops", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Lamb", images: ["https://images.unsplash.com/photo-1558030006-450675393462?w=400"], price: 42.99, unit: "per kg", stockQty: 8, isFreshMeat: true, meatAnimalType: "lamb", pricePerKg: 42.99, isHalalCertified: true, isFeatured: true, tags: ["lamb", "chops", "premium"] },
    { storeId: store3.id, slug: `siddiqui-zaatar-blend`, name: "Authentic Za'atar Blend", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Blends", images: ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400"], price: 7.99, unit: "150g", stockQty: 35, isHalalCertified: true, tags: ["zaatar", "herb", "middle-east"] },
  ].map((p) => ({ ...p, isApproved: true, approvalStatus: "approved" })) as (typeof productsTable.$inferInsert)[]).returning();

  console.log("✅ Products created");

  // 6. Pickup slots for next 7 days (store 1 & 2)
  const now = new Date();
  const slotValues: any[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const times = [
      { start: "10:00", end: "10:30" },
      { start: "10:30", end: "11:00" },
      { start: "11:00", end: "11:30" },
      { start: "12:00", end: "12:30" },
      { start: "14:00", end: "14:30" },
      { start: "16:00", end: "16:30" },
      { start: "18:00", end: "18:30" },
    ];
    for (const t of times) {
      slotValues.push({ storeId: store1.id, date, startTime: t.start, endTime: t.end, maxOrders: 10, bookedOrders: Math.floor(Math.random() * 4) });
      slotValues.push({ storeId: store2.id, date, startTime: t.start, endTime: t.end, maxOrders: 8, bookedOrders: Math.floor(Math.random() * 3) });
    }
  }

  await db.insert(pickupSlotsTable).values(slotValues);
  console.log("✅ Pickup slots created");

  // 7. Promo codes
  await db.insert(promoCodesTable).values([
    { code: "WELCOME10", discountType: "PERCENTAGE", discountValue: 10, minOrder: 25, maxUses: 500, isActive: true },
    { code: "HALAL5", discountType: "FIXED", discountValue: 5, minOrder: 30, maxUses: 1000, isActive: true },
    { code: "EID2024", discountType: "PERCENTAGE", discountValue: 15, minOrder: 50, maxUses: 200, expiryDate: new Date("2025-12-31"), isActive: true },
  ]).onConflictDoNothing();
  console.log("✅ Promo codes created");

  // 8. Sample orders
  if (customers.length > 0) {
    const customer = customers[0];
    const [order1] = await db.insert(ordersTable).values({
      orderNumber: "HG-ABC123-XY",
      customerId: customer.id,
      storeId: store1.id,
      status: "COMPLETED",
      orderType: "EXPRESS_PICKUP",
      subtotal: 47.98,
      convenienceFee: 2.99,
      deliveryFee: 0,
      curbsideFee: 0,
      discount: 0,
      tip: 0,
      estimatedTotal: 50.97,
      finalTotal: 50.97,
      paymentStatus: "paid",
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    }).returning();

    await db.insert(orderItemsTable).values([
      { orderId: order1.id, productId: store1Products[0].id, name: "Whole Halal Chicken", productType: "FRESH_MEAT", quantity: 2, unit: "per bird", unitPrice: 12.99, totalPrice: 25.98, isFreshMeat: true },
      { orderId: order1.id, productId: store1Products[5].id, name: "House Special Biryani Masala", productType: "SPICES", quantity: 1, unit: "200g", unitPrice: 8.99, totalPrice: 8.99, isFreshMeat: false },
      { orderId: order1.id, productId: store1Products[9].id, name: "Royal Supreme Basmati Rice 10kg", productType: "PACKAGED", quantity: 1, unit: "10kg bag", unitPrice: 29.99, totalPrice: 29.99, isFreshMeat: false },
    ]);

    await db.insert(orderStatusHistoryTable).values([
      { orderId: order1.id, status: "PENDING", note: "Order placed", createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
      { orderId: order1.id, status: "STORE_CONFIRMED", note: "Store confirmed", createdAt: new Date(Date.now() - 24.5 * 60 * 60 * 1000) },
      { orderId: order1.id, status: "COMPLETED", note: "Pickup completed", createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    ]);

    await db.insert(reviewsTable).values({
      userId: customer.id,
      storeId: store1.id,
      orderId: order1.id,
      rating: 5,
      comment: "Amazing service and quality meat! Will definitely come back.",
      isPublic: true,
    });

    // Update store rating
    await db.update(storesTable).set({ rating: 4.8, totalRatings: 343 }).where(eq(storesTable.id, store1.id));
  }

  console.log("✅ Sample orders and reviews created");
  console.log("🎉 Seeding complete!");
  console.log("\n📌 Login Credentials:");
  console.log("  Admin: admin@halalGrocery.com / Admin@123");
  console.log("  Store Owner: owner1@halalmarket.com / Owner@123");
  console.log("  Customer: customer1@example.com / Customer@123");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
