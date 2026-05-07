# Numa Fresh — Premium Halal Grocery Marketplace

## Overview

A full-stack Halal Grocery SaaS marketplace (Phases 1–7 complete) built as a pnpm workspace monorepo using TypeScript. Features a premium aesthetic, complete customer-facing flows, a tablet-first Store Owner Portal, a full Admin Panel, and expanded USA coverage with 10 certified stores and 300+ products.

### Phase 8 additions (latest)
- **Logout confirmation**: Navbar logout button shows an AlertDialog to confirm before signing out.
- **Portal route guard (PortalGuard)**: Store portal routes now wrapped with `PortalGuard` — unauthenticated users see StoreLoginPage; admin users are redirected to `/admin`.
- **Full-page reload fixes**: `admin-stores.tsx` and `useRealtimeNotifications.ts` replaced `window.location.href` with Wouter `setLocation()`.
- **Refund system (store portal)**: `store-portal-order.tsx` now shows an "Issue Refund" button for COMPLETED orders, opening a modal with refund amount + reason fields; confirms by patching status to REFUNDED.
- **Admin products — table + bulk actions + pagination**: "All Products" tab in `admin-products.tsx` fully rewritten from card grid to a sortable table with per-row checkboxes, select-all, bulk toggle/delete bar, page-based pagination (20 per page), and CSV export.
- **Chat system removed**: `/account/chat`, `/admin/chat`, `/store-portal/support` routes removed from `App.tsx`; nav items removed from `AdminLayout` and `PortalLayout`; `ChatBot` component removed from all layouts; orphaned page files annotated with `/* CHAT_REMOVED */` comments; DB schema preserved.
- **Login/Create Account cleanup**: `/login` and `/signup` routes now render as standalone pages (no Navbar/Footer). Google OAuth button and flow removed from `login.tsx` and `store-login.tsx`.
- **CSV export — admin portal**: Export CSV buttons added to admin Orders, Users, Stores, and Products pages — downloads current visible data as a `.csv` file.

### Phase 7 additions
- **Product image upload**: ProductDrawer in store portal has dual-mode image section — "Image URL" (paste URL) and "Upload File" (presigned GCS upload via object storage). Images display on product cards.
- **Bulk CSV/Excel import**: "Import CSV/Excel" button in store portal products toolbar opens a modal with drag-drop, preview table (up to 5 rows), column reference, template download, and per-row error reporting. Calls `POST /api/store/products/bulk-import` (max 500 rows).
- **Inventory management page**: `/store-portal/inventory` — KPI cards (Total Products, Low Stock, Out of Stock, Inventory Value), searchable/filterable stock table, inline qty editing with Save button. Added to portal sidebar nav.
- **Real-time persistent chat**: `order_chat_messages` table created; `GET/POST /api/chat/:orderId/messages` endpoints; admin-chat.tsx wired to `/api/chat/admin/conversations`; account-chat.tsx shows customer's orders → per-order chat panel.
- **Admin Products Management**: `/admin/products` — combined page with "Pending Approval" tab (approve/reject queue) and "All Products" tab (browse/search all store products with delete + suspend controls). New admin API endpoints: `GET /admin/products`, `DELETE /admin/products/:id`, `PATCH /admin/products/:id/toggle-active`.
- **Bug fixes**: React hooks ordering fix in account.tsx; store orders multi-status filter fix (STORE_CONFIRMED,IN_PREPARATION now handled with Drizzle `inArray`).

### Phase 6 improvements
- **Three separate login portals**: `/login` (customer, green), `/store-login` (store owner, amber/orange), `/admin-login` (admin, dark slate) — each validates role and redirects wrong-role users to correct portal
- **300+ products** across all 10 stores (35–42 per store) covering 9+ categories each
- **Product availability fixed**: API returns `isAvailable = isActive && stockQty > 0`; UI correctly renders Add to Cart or Unavailable badge
- **Store images updated**: All 10 stores have unique, working Unsplash images in both store listing cards and store detail banners (Pacific Halal Foods fixed)
- **Cart page redesigned**: Premium visual with sticky sidebar, category-based image fallbacks, range-based loyalty point slider, tip options including Custom, trust badges, and animated remove
- **AI Meal Planner API fixed**: Product `images` field now included in the generate endpoint so meal plan ingredients add with images to cart

### Phase 5 additions
- **10 USA stores** — Woodbridge VA, Alexandria VA, Washington DC, Chicago IL, Dallas TX, Brooklyn NY, Los Angeles CA (plus 3 Canadian stores)
- **Socket.IO, Stripe, Email/SMS, Cron Jobs, SEO, Security, i18n** — all integrated
- **Functional product search** — home page search bar navigates to `/products?search=QUERY`
- **AI Halal Meal Planner** — 4 plan types (1-Day, 3-Day, Weekly, Monthly), budget slider, family size, cuisine & protein preferences, add-all-to-cart

## Architecture

- **Frontend**: React 19 + Vite + TailwindCSS 4 + React Query + Framer Motion + react-helmet-async + i18next (`artifacts/halal-grocery`)
- **Backend**: Express 5 API server (`artifacts/api-server`)
- **Database**: PostgreSQL (Neon.tech external, shared across dev + production) + Drizzle ORM (`lib/db`). Connection resolved via `NEON_URL` env var (shared, takes precedence) with `DATABASE_URL` as fallback. Production also has `DATABASE_URL` set explicitly in artifact run env.
- **Auth**: JWT (bcryptjs + jsonwebtoken), tokens in localStorage with refresh logic
- **Monorepo**: pnpm workspaces

## Running Credentials (Development)

| Role         | Email                       | Password     |
|--------------|-----------------------------|--------------|
| Admin        | admin@numafreshmarketplace.com      | Admin@123    |
| Store Owner  | owner1@halalmarket.com      | Owner@123    |
| Customer     | customer1@example.com       | Customer@123 |

## Key API Endpoints

- `GET /api/healthz` — health check
- `POST /api/auth/login` — login (returns `{ user, accessToken, refreshToken }`)
- `POST /api/auth/signup` — signup
- `GET /api/auth/me` — get current user (requires Bearer token)
- `POST /api/auth/refresh` — refresh access token
- `GET /api/stores/featured` — featured stores (public, returns array)
- `GET /api/stores` — all stores with filters (returns `{ stores, total, page, totalPages }`)
- `GET /api/stores/:slugOrId` — store detail
- `GET /api/stores/:storeSlug/products` — store products (returns `{ products, total, page, totalPages }`)
- `GET /api/products/featured` — featured products (returns `{ freshMeat, produce, spices, packaged, eidSpecials }`)
- `GET /api/products` — all products with filters (returns `{ products, total, page, totalPages }`)
- `GET /api/slots/:storeId` — pickup slots for a store
- `GET /api/promos/validate` — validate promo code
- `GET /api/users/profile` — user profile (auth required)
- `PATCH /api/users/profile` — update profile (auth required)
- `GET /api/users/addresses` — user addresses (auth required)
- `POST /api/users/addresses` — add address (accepts `street` or `line1`, auth required)
- `PATCH /api/users/addresses/:id` — update/set default address (auth required)
- `DELETE /api/users/addresses/:id` — delete address (auth required)
- `GET /api/users/loyalty` — loyalty points + transactions (auth required, returns `{ points, tier, transactions }`)
- `GET /api/orders` — customer orders (auth required)
- `POST /api/orders` — place order (auth required)
- `GET /api/orders/:orderId` — order detail (auth required)
- `POST /api/orders/:orderId/cancel` — cancel order (auth required)
- `POST /api/orders/:orderId/rate` — rate order (auth required)
- `POST /api/orders/:orderId/im-here` — curbside arrival notification (auth required)
- `GET /api/orders/store-portal/list` — store owner's orders (STORE_OWNER/ADMIN, legacy)
- `GET /api/admin/dashboard` — platform stats (ADMIN only)
- `GET /api/platform/stats` — platform stats (ADMIN only)

### Store Portal API (Phase 3) — all require STORE_OWNER/ADMIN
- `GET /api/store/dashboard` — live stats: pendingOrders, preparingOrders, readyOrders, todayRevenue, completedToday
- `GET /api/store/orders` — paginated orders list with optional `?status=` filter
- `GET /api/store/orders/:id` — order detail with items + customer
- `PATCH /api/store/orders/:id/confirm` — accept a pending order
- `PATCH /api/store/orders/:id/reject` — decline a pending order
- `PATCH /api/store/orders/:id/status` — advance order status
- `PATCH /api/store/orders/:id/item-status` — mark individual item FOUND/OUT_OF_STOCK/SUBSTITUTED
- `PATCH /api/store/orders/:id/meat-weight` — record actual weight for fresh meat items
- `POST /api/store/orders/:id/mark-ready` — mark order READY_FOR_PICKUP
- `GET /api/store/products` — store's product catalog
- `POST /api/store/products` — create product
- `PUT /api/store/products/:id` — update product
- `DELETE /api/store/products/:id` — delete product
- `PATCH /api/store/products/:id/stock` — toggle active/update stock qty
- `GET /api/store/analytics?period=today|week|month` — revenue + order charts
- `GET /api/store/payouts?period=week|month` — payout summary + history
- `GET /api/store/settings` — store configuration
- `PUT /api/store/settings` — update store settings

## Frontend Pages

| Path | Description |
|------|-------------|
| `/` | Animated homepage: hero, categories, nearby stores, meat spotlight, how-it-works, testimonials, Eid banner |
| `/stores` | Browse stores with filter sidebar (pickup/delivery/halal/rating/fee), sort, mobile sheet |
| `/stores/:storeSlug` | Store detail: sticky category nav, product grid with sections, meat customizer modal, cart drawer |
| `/products` | Browse all products |
| `/halal-meat` | Fresh halal meat landing page with certification info |
| `/eid-specials` | Eid & Qurbani special packages |
| `/cart` | Shopping cart |
| `/checkout` | 4-step checkout: order type → substitutions → review → confirmation with QR code |
| `/orders/:orderId/track` | Order tracking with status timeline, QR display, curbside "I'm Here" button, rating |
| `/login` | Login page |
| `/signup` | Signup page (customer or store owner) |
| `/orders` | Customer order history |
| `/orders/:orderId` | Order detail |
| `/account` | Account hub page with navigation cards to sub-pages |
| `/account/loyalty` | Loyalty points, tier progress (Bronze/Silver/Gold/Platinum), earn history |
| `/account/addresses` | Manage delivery addresses (add/delete/set default) |
| `/account/notifications` | Email/Push/SMS notification preferences (stored in localStorage) |
| `/account/meal-planner` | Meal planner stub (Coming Soon) with weekly preview grid |
| `/store-portal` | Live dashboard: incoming order queue (accept/decline), active orders, stats grid (5s polling) |
| `/store-portal/orders` | All orders list with search + status filter |
| `/store-portal/orders/:id` | Order processing: item checklist, fresh meat weight input, status progression, QR code |
| `/store-portal/products` | Product grid with add/edit drawer (EN+Urdu, all types, fresh meat cuts) |
| `/store-portal/analytics` | Recharts: revenue line, orders bar, top products, order type pie + metric cards |
| `/store-portal/payouts` | Payout summary (gross, 7% commission, net) + payout history |
| `/store-portal/onboarding` | 7-step setup wizard: Business, Halal Cert, Hours, Services, Fees, Banking, Review |
| `/store-portal/settings` | Store settings (Store/Notifications/Security tabs) |
| `/admin` | Admin dashboard (platform stats, store management) |

## Components

### Layout
- `Navbar` — transparent on homepage, solid on scroll, cart drawer integrated, language switcher
- `Footer` — full footer with links
- `BottomNav` — mobile-only fixed bottom nav (md:hidden)
- `AccountSidebar` — desktop sidebar for account sub-pages with user card + nav links
- `PortalLayout` (`components/portal/PortalLayout.tsx`) — full-screen tablet-first layout for store portal. Sidebar (Dashboard/Orders/Products/Analytics/Payouts/Setup/Settings nav, OPEN/CLOSED toggle, user card), top bar (clock, notifications bell with badge, staff name). Portal pages use this instead of AppLayout.

### Feature Components
- `CartDrawer` — Radix Sheet-based slide-out cart
- `MeatCustomizerModal` — meat cut/weight customizer dialog
- `PickupSlotSelector` — date/time slot picker for pickup orders
- `QRCodeDisplay` — QR code for order pickup with download
- `FeeBreakdown` — itemized fee display with tooltip info
- `OrderStatusBadge` — colored status badge for all order statuses
- `HalalBadge` — certified halal badge
- `StarRating` — interactive/display star rating
- `EmptyState` — empty state with icon + CTA
- `LoadingSkeleton` — various skeleton variants (card, list, product)
- `LanguageSwitcher` — EN/UR/AR language switcher (compact + transparent props)

## Design System

- **Brand color**: `#3FB196` (halal green), Accent: `#D4AF37` (gold)
- **Headings**: Playfair Display (serif)
- **Body**: Inter (sans-serif)
- **Arabic/Urdu**: Amiri font
- **CSS vars**: `--primary` (teal), utility classes: `hg-gradient-primary`, `hg-shadow-*`
- **Premium aesthetic**: Non-typical SaaS design with Arabic calligraphy, warm off-white backgrounds

## Seed Data

- 3 stores: Al Madina Halal Market (Mississauga), Siddiqui Fresh Halal (Toronto), Khan's Halal Grocers (Brampton)
- 24 products across stores (meats, produce, spices, etc.)
- 5 customers, 3 store owners, 1 admin
- Promo codes: `WELCOME10` (10% off), `NEWUSER` (5% off)
- Pickup slots pre-seeded for each store

## Structure

```text
workspace/
├── artifacts/
│   ├── api-server/         # Express 5 API server (port 8080)
│   │   └── src/
│   │       ├── routes/     # auth, stores, products, orders, users, slots, promos, analytics
│   │       ├── middlewares/ # authenticate, authorize
│   │       └── lib/        # auth helpers (JWT, bcrypt)
│   ├── halal-grocery/      # React frontend
│   │   └── src/
│   │       ├── pages/      # all customer pages + account sub-pages
│   │       ├── components/ # Navbar, Footer, BottomNav, AccountSidebar, CartDrawer, MeatCustomizerModal, etc.
│   │       ├── contexts/   # AuthContext, CartContext
│   │       ├── hooks/      # useStores, useProducts, useOrders, useUser
│   │       └── lib/        # api.ts (JWT fetch client), types.ts, i18n.ts
│   └── mockup-sandbox/     # Component preview server (canvas)
├── lib/
│   └── db/                 # Drizzle ORM schema + DB connection
└── scripts/                # Seed script (pnpm --filter @workspace/scripts run seed)
```

## Database Schema Tables

- `users` — id, email, password_hash, role (CUSTOMER/STORE_OWNER/STORE_STAFF/ADMIN), firstName, lastName, phone, loyalty_points
- `stores` — id, owner_id, slug, name, city, province, halal_cert_number, rating, pickup/delivery flags, opening_hours_json
- `products` — id, store_id, slug, name, category, price, is_fresh_meat, available_cuts, is_available
- `orders` — id, customer_id, store_id, status (PENDING/STORE_CONFIRMED/IN_PREPARATION/REPLACEMENT_HANDLING/READY_FOR_PICKUP/OUT_FOR_DELIVERY/COMPLETED/CANCELLED/REFUNDED), order_type (EXPRESS_PICKUP/CURBSIDE_PICKUP/STORE_DELIVERY), items, promo_code, loyalty_points_used, tip
- `order_items` — id, order_id, product_id, quantity, cut_instructions
- `order_status_history` — audit trail
- `promo_codes` — code, discount_type, discount_value, min_order_amount
- `pickup_slots` — store_id, date, time, capacity, booked_count
- `addresses` — user delivery addresses (line1, city, province, postalCode, isDefault)
- `loyalty_transactions` — points earn/spend history (API returns as `transactions` field)
- `store_reviews` — store ratings

## Important API Response Notes

- `GET /api/stores` returns `{ stores: [], total, page, totalPages }` — NOT a plain array
- `GET /api/products` returns `{ products: [], total, page, totalPages }` — NOT a plain array
- `GET /api/products/featured` returns `{ freshMeat, produce, spices, packaged, eidSpecials }` — NOT a flat array
- `GET /api/stores/:slug/products` returns `{ products: [], total, page, totalPages }` — NOT a plain array
- `GET /api/users/loyalty` returns `{ points, pointsValue, tier, nextTierPoints, transactions }` — history field is `transactions`
- `GET /api/stores/featured` returns a plain array

## TypeScript Notes

- All packages use `composite: true` and `emitDeclarationOnly` via `tsconfig.base.json`
- Typecheck: `pnpm --filter @workspace/halal-grocery run typecheck`
- API server: build with `pnpm --filter @workspace/api-server run build`
