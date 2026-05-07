import { db } from "@workspace/db";
import { usersTable, storesTable, productsTable, pickupSlotsTable } from "@workspace/db/schema";
import bcrypt from "bcryptjs";

async function expand() {
  console.log("🌱 Expanding to 10 USA stores with 50+ products...");

  const ownerHash = await bcrypt.hash("Owner@123", 12);

  const openingHours = {
    monday: { open: "09:00", close: "21:00" },
    tuesday: { open: "09:00", close: "21:00" },
    wednesday: { open: "09:00", close: "21:00" },
    thursday: { open: "09:00", close: "21:00" },
    friday: { open: "09:00", close: "22:00" },
    saturday: { open: "08:00", close: "22:00" },
    sunday: { open: "10:00", close: "20:00" },
  };

  // Create 7 new USA store owners
  const owners = await db.insert(usersTable).values([
    { email: "owner4@halalmarket.com", passwordHash: ownerHash, firstName: "Hassan", lastName: "Woodbridge", phone: "+1-571-555-0401", role: "STORE_OWNER", isVerified: true },
    { email: "owner5@halalmarket.com", passwordHash: ownerHash, firstName: "Yasmin", lastName: "Alexandria", phone: "+1-703-555-0501", role: "STORE_OWNER", isVerified: true },
    { email: "owner6@halalmarket.com", passwordHash: ownerHash, firstName: "Bilal", lastName: "DC", phone: "+1-202-555-0601", role: "STORE_OWNER", isVerified: true },
    { email: "owner7@halalmarket.com", passwordHash: ownerHash, firstName: "Tariq", lastName: "Chicago", phone: "+1-773-555-0701", role: "STORE_OWNER", isVerified: true },
    { email: "owner8@halalmarket.com", passwordHash: ownerHash, firstName: "Nadia", lastName: "Dallas", phone: "+1-214-555-0801", role: "STORE_OWNER", isVerified: true },
    { email: "owner9@halalmarket.com", passwordHash: ownerHash, firstName: "Khalid", lastName: "Brooklyn", phone: "+1-718-555-0901", role: "STORE_OWNER", isVerified: true },
    { email: "owner10@halalmarket.com", passwordHash: ownerHash, firstName: "Salma", lastName: "LosAngeles", phone: "+1-310-555-1001", role: "STORE_OWNER", isVerified: true },
  ]).onConflictDoNothing().returning();

  if (!owners || owners.length === 0) {
    console.log("USA store owners already exist, skipping...");
    return;
  }

  const [o4, o5, o6, o7, o8, o9, o10] = owners;

  // Insert 7 new USA stores
  const newStores = await db.insert(storesTable).values([
    {
      ownerId: o4.id,
      slug: "numa-fresh-woodbridge-va",
      name: "Numa Fresh Woodbridge",
      description: "Your neighborhood halal market in Woodbridge, VA. Fresh meats, South Asian groceries, Middle Eastern specialties.",
      phone: "+1 (571) 264-5687",
      email: "woodbridge@numafresh.com",
      address: "4773 Charter Ct",
      city: "Woodbridge",
      province: "VA",
      postalCode: "22192",
      lat: 38.6479, lng: -77.2550,
      isActive: true, isApproved: true, isHalalCertified: true,
      halalCertNumber: "ISNA-US-2024-0101",
      commissionRate: 7.0, convenienceFee: 2.99, minOrderAmount: 15.00, avgPrepTimeMinutes: 20,
      deliveryAvailable: true, deliveryFee: 3.99, deliveryRadiusKm: 10.0,
      pickupAvailable: true, curbsideAvailable: true, curbsideFee: 1.49,
      rating: 4.9, totalRatings: 287,
      openingHoursJson: openingHours,
      isMasjidAffiliated: true, masjidName: "Islamic Center of Woodbridge",
    },
    {
      ownerId: o5.id,
      slug: "baraka-halal-market-alexandria-va",
      name: "Baraka Halal Market",
      description: "Alexandria's finest halal butcher and grocery. Serving the Muslim community of Northern Virginia since 2010.",
      phone: "+1 (703) 555-5001",
      email: "info@barakahalal.com",
      address: "5830 N Kings Hwy",
      city: "Alexandria",
      province: "VA",
      postalCode: "22303",
      lat: 38.7840, lng: -77.0750,
      isActive: true, isApproved: true, isHalalCertified: true,
      halalCertNumber: "IFANCA-US-2024-0202",
      commissionRate: 7.5, convenienceFee: 2.49, minOrderAmount: 20.00, avgPrepTimeMinutes: 25,
      deliveryAvailable: true, deliveryFee: 4.99, deliveryRadiusKm: 8.0,
      pickupAvailable: true, curbsideAvailable: true, curbsideFee: 0.99,
      rating: 4.7, totalRatings: 412,
      openingHoursJson: openingHours,
      isMasjidAffiliated: false,
    },
    {
      ownerId: o6.id,
      slug: "zaytoun-halal-foods-dc",
      name: "Zaytoun Halal Foods",
      description: "Washington DC's premier halal grocery and deli. Certified halal meats, Mediterranean specialties, and fresh produce.",
      phone: "+1 (202) 555-6001",
      email: "info@zaytoundc.com",
      address: "4600 Georgia Ave NW",
      city: "Washington",
      province: "DC",
      postalCode: "20011",
      lat: 38.9650, lng: -77.0230,
      isActive: true, isApproved: true, isHalalCertified: true,
      halalCertNumber: "ISNA-US-2024-0303",
      commissionRate: 8.0, convenienceFee: 2.99, minOrderAmount: 25.00, avgPrepTimeMinutes: 30,
      deliveryAvailable: true, deliveryFee: 5.99, deliveryRadiusKm: 6.0,
      pickupAvailable: true, curbsideAvailable: false,
      rating: 4.8, totalRatings: 634,
      openingHoursJson: openingHours,
      isMasjidAffiliated: true, masjidName: "Masjid Muhammad DC",
    },
    {
      ownerId: o7.id,
      slug: "crescent-halal-market-chicago",
      name: "Crescent Halal Market",
      description: "Chicago's most loved halal superstore. Three decades of serving the Muslim communities of the Greater Chicago area.",
      phone: "+1 (773) 555-7001",
      email: "info@crescenthalal.com",
      address: "2345 N Milwaukee Ave",
      city: "Chicago",
      province: "IL",
      postalCode: "60647",
      lat: 41.9200, lng: -87.7050,
      isActive: true, isApproved: true, isHalalCertified: true,
      halalCertNumber: "IFANCA-US-2024-0404",
      commissionRate: 7.0, convenienceFee: 2.99, minOrderAmount: 20.00, avgPrepTimeMinutes: 25,
      deliveryAvailable: true, deliveryFee: 4.99, deliveryRadiusKm: 12.0,
      pickupAvailable: true, curbsideAvailable: true, curbsideFee: 1.49,
      rating: 4.8, totalRatings: 891,
      openingHoursJson: openingHours,
      isMasjidAffiliated: true, masjidName: "Islamic Foundation North",
    },
    {
      ownerId: o8.id,
      slug: "texas-halal-grocers-dallas",
      name: "Texas Halal Grocers",
      description: "Dallas's go-to halal destination. Huge selection of fresh meats, South Asian, Middle Eastern and African groceries.",
      phone: "+1 (214) 555-8001",
      email: "info@texashalalgrocers.com",
      address: "9870 Webb Chapel Rd",
      city: "Dallas",
      province: "TX",
      postalCode: "75220",
      lat: 32.8600, lng: -96.8780,
      isActive: true, isApproved: true, isHalalCertified: true,
      halalCertNumber: "ISNA-US-2024-0505",
      commissionRate: 7.0, convenienceFee: 2.49, minOrderAmount: 15.00, avgPrepTimeMinutes: 20,
      deliveryAvailable: true, deliveryFee: 3.99, deliveryRadiusKm: 15.0,
      pickupAvailable: true, curbsideAvailable: true, curbsideFee: 0.99,
      rating: 4.7, totalRatings: 1204,
      openingHoursJson: openingHours,
      isMasjidAffiliated: false,
    },
    {
      ownerId: o9.id,
      slug: "brooklyn-halal-market-ny",
      name: "Brooklyn Halal Market",
      description: "Brooklyn's iconic halal market in the heart of the Muslim community. Best lamb, goat, and African groceries in NYC.",
      phone: "+1 (718) 555-9001",
      email: "info@brooklynhalal.com",
      address: "744 Fulton St",
      city: "Brooklyn",
      province: "NY",
      postalCode: "11217",
      lat: 40.6872, lng: -73.9818,
      isActive: true, isApproved: true, isHalalCertified: true,
      halalCertNumber: "IFANCA-US-2024-0606",
      commissionRate: 8.5, convenienceFee: 3.49, minOrderAmount: 25.00, avgPrepTimeMinutes: 35,
      deliveryAvailable: true, deliveryFee: 6.99, deliveryRadiusKm: 5.0,
      pickupAvailable: true, curbsideAvailable: false,
      rating: 4.9, totalRatings: 2156,
      openingHoursJson: openingHours,
      isMasjidAffiliated: true, masjidName: "Masjid Al-Taqwa",
    },
    {
      ownerId: o10.id,
      slug: "pacific-halal-foods-los-angeles",
      name: "Pacific Halal Foods",
      description: "Los Angeles' premium halal market. Fresh cuts, Persian and Afghan specialties, organic produce. Serving SoCal Muslims.",
      phone: "+1 (310) 555-1001",
      email: "info@pacifichalal.com",
      address: "3801 W Olympic Blvd",
      city: "Los Angeles",
      province: "CA",
      postalCode: "90019",
      lat: 34.0480, lng: -118.3320,
      isActive: true, isApproved: true, isHalalCertified: true,
      halalCertNumber: "ISNA-US-2024-0707",
      commissionRate: 8.0, convenienceFee: 2.99, minOrderAmount: 20.00, avgPrepTimeMinutes: 30,
      deliveryAvailable: true, deliveryFee: 5.49, deliveryRadiusKm: 10.0,
      pickupAvailable: true, curbsideAvailable: true, curbsideFee: 1.49,
      rating: 4.8, totalRatings: 934,
      openingHoursJson: openingHours,
      isMasjidAffiliated: false,
    },
  ]).returning();

  const [s4, s5, s6, s7, s8, s9, s10] = newStores;

  console.log("✅ 7 new USA stores created");

  // Products for each new store (5-8 each = ~40 more products)
  await db.insert(productsTable).values([
    // ── Numa Fresh Woodbridge (s4) ──────────────────────────────────────
    { storeId: s4.id, slug: "nfwb-whole-chicken", name: "Whole Halal Chicken", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Chicken", images: ["https://images.unsplash.com/photo-1588347818036-c3dba96e34b3?w=400"], price: 13.99, unit: "per bird", stockQty: 30, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 9.99, isHalalCertified: true, isFeatured: true, freshnessLabel: "Slaughtered Today", tags: ["chicken","halal","fresh"] },
    { storeId: s4.id, slug: "nfwb-beef-ribeye", name: "Beef Ribeye Steak", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Beef", images: ["https://images.unsplash.com/photo-1544025162-d76538775a9b?w=400"], price: 32.99, unit: "per kg", stockQty: 10, isFreshMeat: true, meatAnimalType: "beef", pricePerKg: 32.99, isHalalCertified: true, isFeatured: true, tags: ["beef","steak","premium"] },
    { storeId: s4.id, slug: "nfwb-lamb-shoulder", name: "Lamb Shoulder (Bone-In)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Lamb", images: ["https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400"], price: 29.99, unit: "per kg", stockQty: 8, isFreshMeat: true, meatAnimalType: "lamb", pricePerKg: 29.99, isHalalCertified: true, tags: ["lamb","shoulder","halal"] },
    { storeId: s4.id, slug: "nfwb-basmati-5kg", name: "Extra Long Basmati Rice 5kg", productType: "PACKAGED", category: "Rice & Grains", subcategory: "Basmati", images: ["https://images.unsplash.com/photo-1536304993881-ff86e0c9ef3b?w=400"], price: 18.99, comparePrice: 22.99, unit: "5kg", stockQty: 50, isHalalCertified: true, isFeatured: true, tags: ["basmati","rice","5kg"] },
    { storeId: s4.id, slug: "nfwb-garam-masala", name: "Whole Garam Masala Mix", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Blends", images: ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"], price: 7.99, unit: "150g", stockQty: 60, isHalalCertified: true, tags: ["garam","masala","spice"] },
    { storeId: s4.id, slug: "nfwb-medjool-dates", name: "Premium Medjool Dates", productType: "PACKAGED", category: "Dried Fruits & Nuts", subcategory: "Dates", images: ["https://images.unsplash.com/photo-1584365685547-9a5fb6f3a70c?w=400"], price: 15.99, comparePrice: 18.99, unit: "500g", stockQty: 45, isHalalCertified: true, isFeatured: true, tags: ["dates","medjool","snack"] },
    { storeId: s4.id, slug: "nfwb-desi-ghee", name: "Pure Cow Ghee", productType: "DAIRY", category: "Dairy & Eggs", subcategory: "Ghee", images: ["https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400"], price: 22.99, unit: "800g", stockQty: 25, isHalalCertified: true, tags: ["ghee","dairy","desi"] },

    // ── Baraka Halal Market Alexandria (s5) ──────────────────────────────
    { storeId: s5.id, slug: "baraka-chicken-thighs", name: "Boneless Chicken Thighs", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Chicken", images: ["https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400"], price: 16.99, unit: "per kg", stockQty: 20, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 16.99, isHalalCertified: true, isFeatured: true, tags: ["chicken","thighs","boneless"] },
    { storeId: s5.id, slug: "baraka-goat-leg", name: "Goat Leg (Raan)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Goat", images: ["https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400"], price: 26.99, unit: "per kg", stockQty: 6, isFreshMeat: true, meatAnimalType: "goat", pricePerKg: 26.99, isHalalCertified: true, tags: ["goat","raan","halal"] },
    { storeId: s5.id, slug: "baraka-zaatar", name: "Hand-picked Za'atar Blend", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Blends", images: ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400"], price: 8.99, unit: "200g", stockQty: 40, isHalalCertified: true, isFeatured: true, tags: ["zaatar","herb","middle-east"] },
    { storeId: s5.id, slug: "baraka-olive-oil", name: "Extra Virgin Olive Oil (Palestinian)", productType: "PACKAGED", category: "Oils & Ghee", subcategory: "Oils", images: ["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400"], price: 19.99, comparePrice: 24.99, unit: "500ml", stockQty: 35, isHalalCertified: true, isFeatured: true, tags: ["olive-oil","cold-pressed","palestine"] },
    { storeId: s5.id, slug: "baraka-hummus", name: "Homestyle Hummus", productType: "PACKAGED", category: "Dips & Spreads", subcategory: "Hummus", images: ["https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400"], price: 5.99, unit: "400g", stockQty: 28, isHalalCertified: true, tags: ["hummus","dip","middle-east"] },
    { storeId: s5.id, slug: "baraka-pita-bread", name: "Fresh Pita Bread (10-pack)", productType: "BAKERY", category: "Bread & Bakery", subcategory: "Pita", images: ["https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400"], price: 4.49, unit: "10 pack", stockQty: 30, isHalalCertified: true, tags: ["pita","bread","fresh"] },

    // ── Zaytoun Halal Foods DC (s6) ──────────────────────────────────────
    { storeId: s6.id, slug: "zaytoun-lamb-chops", name: "Rack of Lamb Chops", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Lamb", images: ["https://images.unsplash.com/photo-1558030006-450675393462?w=400"], price: 44.99, unit: "per kg", stockQty: 7, isFreshMeat: true, meatAnimalType: "lamb", pricePerKg: 44.99, isHalalCertified: true, isFeatured: true, tags: ["lamb","chops","premium"] },
    { storeId: s6.id, slug: "zaytoun-beef-kofta", name: "Hand-Made Beef Kofta", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Beef", images: ["https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400"], price: 21.99, unit: "per kg", stockQty: 15, isFreshMeat: true, meatAnimalType: "beef", pricePerKg: 21.99, isHalalCertified: true, isFeatured: true, tags: ["kofta","beef","ground"] },
    { storeId: s6.id, slug: "zaytoun-falafel-mix", name: "Authentic Falafel Mix", productType: "PACKAGED", category: "Ready Meals", subcategory: "Falafel", images: ["https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400"], price: 7.99, unit: "500g", stockQty: 40, isHalalCertified: true, tags: ["falafel","mix","middle-east"] },
    { storeId: s6.id, slug: "zaytoun-sumac", name: "Ground Sumac Spice", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Ground Spices", images: ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"], price: 6.99, unit: "100g", stockQty: 50, isHalalCertified: true, tags: ["sumac","spice","middle-east"] },
    { storeId: s6.id, slug: "zaytoun-labneh", name: "Labneh Cheese (Lebanese)", productType: "DAIRY", category: "Dairy & Eggs", subcategory: "Cheese", images: ["https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400"], price: 8.99, unit: "400g", stockQty: 22, isHalalCertified: true, isFeatured: true, tags: ["labneh","cheese","lebanese"] },
    { storeId: s6.id, slug: "zaytoun-pomegranate-molasses", name: "Pomegranate Molasses", productType: "PACKAGED", category: "Condiments", subcategory: "Sauces", images: ["https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400"], price: 9.49, unit: "250ml", stockQty: 30, isHalalCertified: true, tags: ["pomegranate","molasses","sauce"] },

    // ── Crescent Halal Market Chicago (s7) ──────────────────────────────
    { storeId: s7.id, slug: "crescent-chicken-tikka", name: "Chicken Tikka Boneless", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Marinated", images: ["https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400"], price: 19.99, unit: "per kg", stockQty: 20, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 19.99, isHalalCertified: true, isFeatured: true, tags: ["tikka","marinated","chicken"] },
    { storeId: s7.id, slug: "crescent-goat-karahi", name: "Goat Karahi Cut", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Goat", images: ["https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400"], price: 23.99, unit: "per kg", stockQty: 12, isFreshMeat: true, meatAnimalType: "goat", pricePerKg: 23.99, isHalalCertified: true, tags: ["goat","karahi","halal"] },
    { storeId: s7.id, slug: "crescent-biryani-masala", name: "Premium Biryani Masala Kit", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Blends", images: ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"], price: 11.99, unit: "300g", stockQty: 55, isHalalCertified: true, isFeatured: true, tags: ["biryani","masala","kit"] },
    { storeId: s7.id, slug: "crescent-toor-dal", name: "Organic Toor Dal", productType: "PACKAGED", category: "Lentils & Pulses", subcategory: "Dal", images: ["https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400"], price: 13.99, unit: "2kg", stockQty: 40, isHalalCertified: true, tags: ["dal","toor","lentil"] },
    { storeId: s7.id, slug: "crescent-coconut-milk", name: "Organic Coconut Milk", productType: "PACKAGED", category: "Canned Goods", subcategory: "Coconut", images: ["https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400"], price: 3.49, unit: "400ml", stockQty: 60, isHalalCertified: true, tags: ["coconut","milk","organic"] },
    { storeId: s7.id, slug: "crescent-naan", name: "Freshly Baked Garlic Naan", productType: "BAKERY", category: "Bread & Bakery", subcategory: "Naan", images: ["https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400"], price: 4.99, unit: "4 pack", stockQty: 25, isHalalCertified: true, isFeatured: true, tags: ["naan","garlic","bread"] },

    // ── Texas Halal Grocers Dallas (s8) ──────────────────────────────────
    { storeId: s8.id, slug: "texas-beef-brisket", name: "Texas Beef Brisket", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Beef", images: ["https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400"], price: 22.99, unit: "per kg", stockQty: 15, isFreshMeat: true, meatAnimalType: "beef", pricePerKg: 22.99, isHalalCertified: true, isFeatured: true, tags: ["brisket","beef","texas"] },
    { storeId: s8.id, slug: "texas-whole-chicken", name: "Free-Range Whole Chicken", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Chicken", images: ["https://images.unsplash.com/photo-1588347818036-c3dba96e34b3?w=400"], price: 14.99, unit: "per bird", stockQty: 25, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 10.99, isHalalCertified: true, isFeatured: true, freshnessLabel: "Farm Fresh", tags: ["chicken","free-range","fresh"] },
    { storeId: s8.id, slug: "texas-lamb-ribs", name: "Lamb Spare Ribs", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Lamb", images: ["https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400"], price: 27.99, unit: "per kg", stockQty: 10, isFreshMeat: true, meatAnimalType: "lamb", pricePerKg: 27.99, isHalalCertified: true, tags: ["lamb","ribs","bbq"] },
    { storeId: s8.id, slug: "texas-chili-powder", name: "Smoky Halal Chili Powder", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Ground Spices", images: ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"], price: 6.49, unit: "200g", stockQty: 70, isHalalCertified: true, tags: ["chili","powder","spice"] },
    { storeId: s8.id, slug: "texas-halal-beef-jerky", name: "Halal Beef Jerky Original", productType: "PACKAGED", category: "Snacks", subcategory: "Jerky", images: ["https://images.unsplash.com/photo-1544025162-d76538775a9b?w=400"], price: 12.99, unit: "150g", stockQty: 45, isHalalCertified: true, isFeatured: true, tags: ["jerky","beef","snack"] },
    { storeId: s8.id, slug: "texas-rose-water", name: "Pure Rose Water (Kewra)", productType: "PACKAGED", category: "Condiments", subcategory: "Flavoring", images: ["https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400"], price: 4.99, unit: "200ml", stockQty: 50, isHalalCertified: true, tags: ["rose-water","kewra","flavoring"] },

    // ── Brooklyn Halal Market NY (s9) ──────────────────────────────────
    { storeId: s9.id, slug: "brooklyn-whole-goat", name: "Whole Goat (Cut to Order)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Goat", images: ["https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400"], price: 349.99, unit: "whole", stockQty: 2, isFreshMeat: true, meatAnimalType: "goat", pricePerKg: 18.99, isHalalCertified: true, isFeatured: true, tags: ["goat","qurbani","eid","whole"] },
    { storeId: s9.id, slug: "brooklyn-oxtail", name: "Oxtail (Jamaican Cut)", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Beef", images: ["https://images.unsplash.com/photo-1544025162-d76538775a9b?w=400"], price: 24.99, unit: "per kg", stockQty: 8, isFreshMeat: true, meatAnimalType: "beef", pricePerKg: 24.99, isHalalCertified: true, isFeatured: true, tags: ["oxtail","beef","jamaican"] },
    { storeId: s9.id, slug: "brooklyn-jerk-seasoning", name: "Caribbean Jerk Seasoning", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Blends", images: ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400"], price: 8.49, unit: "200g", stockQty: 55, isHalalCertified: true, tags: ["jerk","caribbean","seasoning"] },
    { storeId: s9.id, slug: "brooklyn-scotch-bonnet", name: "Fresh Scotch Bonnet Peppers", productType: "PRODUCE", category: "Fresh Produce", subcategory: "Peppers", images: ["https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?w=400"], price: 3.99, unit: "250g", stockQty: 20, isHalalCertified: true, tags: ["pepper","scotch-bonnet","hot"] },
    { storeId: s9.id, slug: "brooklyn-plantains", name: "Ripe Plantains", productType: "PRODUCE", category: "Fresh Produce", subcategory: "Fruit", images: ["https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400"], price: 2.49, unit: "each", stockQty: 30, isHalalCertified: true, isFeatured: true, tags: ["plantain","fruit","caribbean"] },
    { storeId: s9.id, slug: "brooklyn-coconut-water", name: "Pure Coconut Water (1L)", productType: "BEVERAGES", category: "Beverages", subcategory: "Juice", images: ["https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400"], price: 3.99, unit: "1L", stockQty: 40, isHalalCertified: true, tags: ["coconut","water","drink"] },

    // ── Pacific Halal Foods LA (s10) ──────────────────────────────────
    { storeId: s10.id, slug: "pacific-lamb-kabob", name: "Persian Lamb Kabob Mix", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Marinated", images: ["https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400"], price: 28.99, unit: "per kg", stockQty: 12, isFreshMeat: true, meatAnimalType: "lamb", pricePerKg: 28.99, isHalalCertified: true, isFeatured: true, tags: ["kabob","lamb","persian"] },
    { storeId: s10.id, slug: "pacific-organic-chicken", name: "Organic Halal Chicken Breast", productType: "FRESH_MEAT", category: "Fresh Meat", subcategory: "Chicken", images: ["https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400"], price: 24.99, unit: "per kg", stockQty: 18, isFreshMeat: true, meatAnimalType: "chicken", pricePerKg: 24.99, isHalalCertified: true, isFeatured: true, tags: ["organic","chicken","breast"] },
    { storeId: s10.id, slug: "pacific-saffron", name: "Persian Saffron (Premium)", productType: "SPICES", category: "Spices & Seasonings", subcategory: "Premium Spices", images: ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"], price: 29.99, comparePrice: 34.99, unit: "1g", stockQty: 20, isHalalCertified: true, isFeatured: true, tags: ["saffron","persian","premium"] },
    { storeId: s10.id, slug: "pacific-pistachios", name: "Roasted Pistachios (Unsalted)", productType: "PACKAGED", category: "Dried Fruits & Nuts", subcategory: "Nuts", images: ["https://images.unsplash.com/photo-1584365685547-9a5fb6f3a70c?w=400"], price: 21.99, comparePrice: 25.99, unit: "500g", stockQty: 35, isHalalCertified: true, isFeatured: true, tags: ["pistachio","nuts","premium"] },
    { storeId: s10.id, slug: "pacific-basmati-rice", name: "Aged Basmati Rice (Aged 2yr)", productType: "PACKAGED", category: "Rice & Grains", subcategory: "Basmati", images: ["https://images.unsplash.com/photo-1536304993881-ff86e0c9ef3b?w=400"], price: 34.99, comparePrice: 39.99, unit: "10kg", stockQty: 30, isHalalCertified: true, isFeatured: true, tags: ["basmati","rice","aged"] },
    { storeId: s10.id, slug: "pacific-dried-figs", name: "Turkish Dried Figs", productType: "PACKAGED", category: "Dried Fruits & Nuts", subcategory: "Dried Fruit", images: ["https://images.unsplash.com/photo-1584365685547-9a5fb6f3a70c?w=400"], price: 11.99, unit: "400g", stockQty: 40, isHalalCertified: true, tags: ["figs","dried","turkish"] },
    { storeId: s10.id, slug: "pacific-rose-hip-tea", name: "Rose Hip Herbal Tea", productType: "BEVERAGES", category: "Beverages", subcategory: "Tea", images: ["https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400"], price: 9.99, unit: "20 bags", stockQty: 45, isHalalCertified: true, tags: ["tea","rose-hip","herbal"] },
  ]);

  console.log("✅ 40+ products added for new stores");

  // Add pickup slots for new stores
  const now = new Date();
  const slotValues: any[] = [];
  const times = [
    { start: "10:00", end: "10:30" }, { start: "11:00", end: "11:30" },
    { start: "12:00", end: "12:30" }, { start: "14:00", end: "14:30" },
    { start: "16:00", end: "16:30" }, { start: "18:00", end: "18:30" },
  ];
  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    for (const store of [s4, s5, s6, s7, s8, s9, s10]) {
      for (const t of times) {
        slotValues.push({ storeId: store.id, date, startTime: t.start, endTime: t.end, maxOrders: 10, bookedOrders: Math.floor(Math.random() * 3) });
      }
    }
  }
  await db.insert(pickupSlotsTable).values(slotValues);

  console.log("✅ Pickup slots created for new stores");
  console.log("🎉 Expansion complete! Now 10 stores, 60+ products");
}

expand().catch(err => {
  console.error("❌ Expand failed:", err);
  process.exit(1);
});
