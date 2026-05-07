import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('Numa-Fresh-SRS-v2.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 60, bufferPages: true });
doc.pipe(fs.createWriteStream(OUT));

// ─── Brand colours ───────────────────────────────────────────────────────────
const C = {
  primary:   '#0d2e26',
  teal:      '#3FB196',
  gold:      '#D4AF37',
  red:       '#C0392B',
  redBg:     '#FFEBEB',
  yellow:    '#B8860B',
  yellowBg:  '#FFFBE6',
  white:     '#FFFFFF',
  black:     '#1a1a1a',
  grey:      '#555555',
  lightGrey: '#F5F5F5',
  border:    '#DDDDDD',
  tealLight: '#E8F7F2',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const W = doc.page.width - 120; // usable width
let currentY = 0;

function ensureSpace(needed) {
  if (doc.y + needed > doc.page.height - 80) doc.addPage();
}

function hLine(y, color = C.border, thickness = 0.5) {
  doc.save().moveTo(60, y).lineTo(60 + W, y)
    .lineWidth(thickness).strokeColor(color).stroke().restore();
}

function rect(x, y, w, h, fill, radius = 3) {
  doc.save().roundedRect(x, y, w, h, radius).fillColor(fill).fill().restore();
}

function sectionHeading(num, title) {
  ensureSpace(50);
  const y = doc.y;
  rect(60, y, W, 28, C.primary, 4);
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(11)
    .text(`${num}   ${title.toUpperCase()}`, 70, y + 8, { width: W - 20 });
  doc.y = y + 38;
}

function subHeading(title) {
  ensureSpace(30);
  doc.fillColor(C.teal).font('Helvetica-Bold').fontSize(10)
    .text(title, 60, doc.y, { width: W });
  doc.moveDown(0.3);
  hLine(doc.y, C.teal, 0.5);
  doc.moveDown(0.5);
}

function body(text, color = C.black, indent = 0) {
  doc.fillColor(color).font('Helvetica').fontSize(9)
    .text(text, 60 + indent, doc.y, { width: W - indent });
  doc.moveDown(0.3);
}

function bullet(text, color = C.black, indent = 12) {
  ensureSpace(14);
  const y = doc.y;
  doc.fillColor(color).fontSize(9).text('•', 60 + indent, y);
  doc.fillColor(color).font('Helvetica').fontSize(9)
    .text(text, 80 + indent, y, { width: W - indent - 20 });
  doc.y = Math.max(doc.y, y + 14);
  doc.moveDown(0.1);
}

function numberedItem(n, text, color = C.black) {
  ensureSpace(14);
  const y = doc.y;
  doc.fillColor(color).font('Helvetica-Bold').fontSize(9).text(`${n}.`, 60, y, { width: 16 });
  doc.fillColor(color).font('Helvetica').fontSize(9)
    .text(text, 80, y, { width: W - 20 });
  doc.y = Math.max(doc.y, y + 14);
  doc.moveDown(0.1);
}

function redBullet(text) {
  ensureSpace(14);
  const y = doc.y;
  doc.fillColor(C.red).fontSize(9).text('✕', 60 + 12, y);
  doc.fillColor(C.red).font('Helvetica').fontSize(9)
    .text(text, 80 + 12, y, { width: W - 32 });
  doc.y = Math.max(doc.y, y + 14);
  doc.moveDown(0.1);
}

function yellowBullet(text) {
  ensureSpace(14);
  const y = doc.y;
  doc.fillColor(C.yellow).fontSize(9).text('★', 60 + 12, y);
  doc.fillColor(C.yellow).font('Helvetica').fontSize(9)
    .text(text, 80 + 12, y, { width: W - 32 });
  doc.y = Math.max(doc.y, y + 14);
  doc.moveDown(0.1);
}

function noteBox(text, bgColor, borderColor, labelColor, label) {
  ensureSpace(40);
  const y = doc.y;
  const h = Math.max(36, doc.heightOfString(text, { width: W - 30 }) + 20);
  rect(60, y, W, h, bgColor, 4);
  doc.save().moveTo(60, y).lineTo(60, y + h).lineWidth(3).strokeColor(borderColor).stroke().restore();
  doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8)
    .text(label, 72, y + 6, { width: W - 20 });
  doc.fillColor(labelColor).font('Helvetica').fontSize(8.5)
    .text(text, 72, y + 18, { width: W - 24 });
  doc.y = y + h + 8;
}

function redBox(text) {
  noteBox(text, C.redBg, C.red, C.red, '✕  NOT IMPLEMENTED');
}

function yellowBox(text) {
  noteBox(text, C.yellowBg, C.gold, C.yellow, '★  IN SYSTEM — NOT IN SRS');
}

// ─── Table ────────────────────────────────────────────────────────────────────
function table(headers, rows, colWidths) {
  ensureSpace(30 + rows.length * 22);
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  let x = 60, y = doc.y;

  // header row
  rect(x, y, totalW, 20, C.primary, 2);
  let cx = x;
  headers.forEach((h, i) => {
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8)
      .text(h, cx + 5, y + 6, { width: colWidths[i] - 8, lineBreak: false });
    cx += colWidths[i];
  });
  y += 20;

  // data rows
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? C.white : C.lightGrey;
    const rowH = Math.max(22, ...row.map((cell, ci) =>
      doc.heightOfString(typeof cell === 'object' ? cell.text : cell,
        { width: colWidths[ci] - 10, font: 'Helvetica', size: 8 }) + 10));

    if (y + rowH > doc.page.height - 80) {
      doc.addPage();
      y = doc.y;
      // re-draw header
      rect(60, y, totalW, 20, C.primary, 2);
      let hx = 60;
      headers.forEach((h, i) => {
        doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8)
          .text(h, hx + 5, y + 6, { width: colWidths[i] - 8, lineBreak: false });
        hx += colWidths[i];
      });
      y += 20;
    }

    rect(x, y, totalW, rowH, bg, 0);
    doc.save().rect(x, y, totalW, rowH).lineWidth(0.3).strokeColor(C.border).stroke().restore();

    cx = x;
    row.forEach((cell, ci) => {
      const isObj = typeof cell === 'object';
      const text = isObj ? cell.text : cell;
      const color = isObj ? cell.color : C.black;
      doc.fillColor(color).font('Helvetica').fontSize(8)
        .text(text, cx + 5, y + 5, { width: colWidths[ci] - 10 });
      cx += colWidths[ci];
    });
    y += rowH;
  });

  doc.y = y + 10;
}

// ─── COVER PAGE ──────────────────────────────────────────────────────────────
rect(0, 0, doc.page.width, doc.page.height, C.primary, 0);
rect(0, doc.page.height - 6, doc.page.width, 6, C.gold, 0);
rect(0, 0, doc.page.width, 4, C.teal, 0);

doc.fillColor(C.teal).font('Helvetica-Bold').fontSize(11)
  .text('🥩  NUMA FRESH MARKETPLACE', 60, 120, { align: 'center', width: W });
doc.moveDown(0.8);
doc.fillColor(C.white).font('Helvetica-Bold').fontSize(28)
  .text('Software Requirements', 60, doc.y, { align: 'center', width: W });
doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(28)
  .text('Specification', 60, doc.y, { align: 'center', width: W });

doc.moveDown(0.6);
doc.fillColor(C.white).font('Helvetica').fontSize(12)
  .text('Version 2.0  ·  April 2026  ·  Final', 60, doc.y, { align: 'center', width: W });
doc.fillColor('#aaaaaa').font('Helvetica').fontSize(10)
  .text('Halal Grocery Marketplace — Full Production Platform', 60, doc.y, { align: 'center', width: W });

// Cover meta box
const boxY = 360;
rect(100, boxY, W - 80, 150, 'rgba(255,255,255,0.05)', 8);
doc.save().roundedRect(100, boxY, W - 80, 150, 8).lineWidth(0.5).strokeColor('#ffffff44').stroke().restore();

const metaRows = [
  ['Document Type', 'Software Requirements Specification'],
  ['Version', '2.0'],
  ['Status', 'Final'],
  ['Classification', 'Confidential'],
  ['Date', 'April 2026'],
  ['System', 'Numa Fresh Marketplace'],
];
metaRows.forEach(([k, v], i) => {
  const my = boxY + 14 + i * 22;
  doc.fillColor('#aaaaaa').font('Helvetica-Bold').fontSize(8.5).text(k, 120, my);
  doc.fillColor(C.white).font('Helvetica').fontSize(8.5).text(v, 280, my);
  if (i < metaRows.length - 1) {
    doc.save().moveTo(120, my + 15).lineTo(440, my + 15).lineWidth(0.3).strokeColor('#ffffff22').stroke().restore();
  }
});

// Legend box
const legY = 540;
rect(100, legY, W - 80, 90, '#ffffff10', 6);
doc.fillColor('#aaaaaa').font('Helvetica-Bold').fontSize(8).text('COLOUR LEGEND', 120, legY + 10);
doc.fillColor(C.white).font('Helvetica').fontSize(8).text('Black text', 120, legY + 28);
doc.fillColor('#aaaaaa').font('Helvetica').fontSize(8).text('— Feature is in the SRS AND implemented in the current system', 180, legY + 28);
doc.fillColor(C.red).font('Helvetica-Bold').fontSize(8).text('Red text', 120, legY + 48);
doc.fillColor('#aaaaaa').font('Helvetica').fontSize(8).text('— Feature is in the SRS but NOT YET implemented', 180, legY + 48);
doc.fillColor(C.yellow).font('Helvetica-Bold').fontSize(8).text('Yellow text', 120, legY + 68);
doc.fillColor('#aaaaaa').font('Helvetica').fontSize(8).text('— Feature EXISTS in system but is MISSING from the original SRS', 180, legY + 68);

// Write cover footer without triggering a PDFKit auto-page-break
// (same technique used in the footer loop below)
const coverSavedBottom = doc.page.margins.bottom;
doc.page.margins.bottom = 0;
doc.fillColor('#666666').font('Helvetica').fontSize(7)
  .text('Confidential — Numa Fresh Marketplace — April 2026', 60, doc.page.height - 40, { align: 'center', width: W });
doc.page.margins.bottom = coverSavedBottom;

// ─── PAGE 2: PRODUCT OVERVIEW ─────────────────────────────────────────────────
doc.addPage();

sectionHeading('1', 'Product Overview');
body('Numa Fresh Marketplace is a multi-portal, production-grade halal grocery marketplace. It connects customers with local halal stores for online ordering and express pickup. The platform operates on a store-fulfilled model — stores handle all picking, packing, and fulfillment. Fresh halal meat cut on demand is the platform\'s primary differentiator.');
doc.moveDown(0.5);

subHeading('1.1 What Makes Numa Fresh Different');
bullet('Store-Fulfilled: No platform shoppers or drivers — stores own the full fulfillment process');
bullet('Pickup-First: Express pickup (under 60 seconds) and curbside are the primary order types');
bullet('Custom Halal Meat: Cut on demand, weight-adjusted, charged by final actual weight');
bullet('Halal Certified Only: Every store must hold a valid halal certificate, verified by admin');
bullet('Muslim Community Focus: Eid/Qurbani system, Masjid partnerships, Urdu + Arabic language support');
bullet('Full Transparency: Every fee shown explicitly at checkout — no hidden charges');
doc.moveDown(0.5);

subHeading('1.2 Platform Portals');
table(
  ['Portal', 'URL', 'Users', 'Status'],
  [
    ['Customer Marketplace', '/', 'End customers browsing and ordering', 'Implemented'],
    ['Store Fulfillment Portal', '/store-portal', 'Store owners and store staff', 'Implemented'],
    ['Admin Panel', '/admin', 'Platform administrators', 'Implemented'],
    [{ text: 'Store Application', color: C.red }, { text: '/store-portal/apply', color: C.red }, { text: 'New stores applying (dedicated public URL)', color: C.red }, { text: 'Not implemented', color: C.red }],
  ],
  [130, 110, 160, 90]
);
yellowBox('Three separate login portals implemented: /login (customer, teal theme), /store-login (store owner, amber theme), /admin-login (admin, dark slate theme). Each validates role and shows error for wrong-role accounts — not in original SRS.');

// ─── PAGE: USER ROLES ────────────────────────────────────────────────────────
sectionHeading('2', 'User Roles & Access Control');
body('The system uses role-based access control (RBAC). Every user is assigned one role, and all pages and API endpoints enforce that role. Admin actions are permanently logged.');
doc.moveDown(0.4);

subHeading('2.1 Role Definitions');
table(
  ['Role', 'Portal Access', 'Key Capabilities', 'Status'],
  [
    ['CUSTOMER', '/', 'Browse stores, place orders, track orders, manage account', 'Implemented'],
    ['STORE_OWNER', '/store-portal', 'Manage store profile, products, orders, analytics, payouts', 'Implemented'],
    [{ text: 'STORE_STAFF', color: C.red }, { text: '/store-portal (limited)', color: C.red }, { text: 'View and process orders, update item status, chat with customers', color: C.red }, { text: 'Not implemented', color: C.red }],
    ['ADMIN', '/admin', 'Approve stores and products, manage users, finance, settings', 'Implemented'],
  ],
  [90, 110, 200, 90]
);
doc.moveDown(0.4);

subHeading('2.2 Store Approval Flow');
numberedItem(1, 'Owner registers and submits store application via /store-portal/onboarding');
numberedItem(2, 'Store created with status: Pending — not visible to customers yet');
numberedItem(3, 'Admin reviews: business info, halal certificate document, operating hours');
numberedItem(4, 'Admin APPROVES → store goes live on marketplace, owner receives email confirmation');
numberedItem(5, 'Admin REJECTS → reason stored, rejection email with reason sent to owner', C.red);
numberedItem(6, 'Admin can also add a store directly from /admin/stores, bypassing the application queue');
redBox('Rejection email with reason sent to applicant — not yet triggered automatically. Halal certificate PDF document viewer in admin panel not yet implemented.');
doc.moveDown(0.4);

subHeading('2.3 Product Approval Flow');
bullet('Admin product approval queue at /admin/products/pending — lists all pending products with approve/reject actions');
bullet('APPROVED → product goes live, store can view active products');
bullet('REJECTED → store notified with reason via notification system');
redBullet('Products created with Pending status (not visible while pending) — currently all products go live immediately');
redBullet('Price/image updates after approval trigger re-approval automatically — not implemented');

// ─── PAGE: CUSTOMER MARKETPLACE ──────────────────────────────────────────────
sectionHeading('3', 'Customer Marketplace');

subHeading('3.1 Homepage');
bullet('Hero section with store search bar and animated statistics (total stores, products, orders)');
bullet('Category quick-links: Fresh Halal Meat, Ethnic Spices, Dairy & Eggs, Frozen Foods, Bakery & Bread, Fresh Produce, Desi Pantry, Beverages');
bullet('Featured stores shown as interactive cards with rating, Halal badge, pickup time, fee');
bullet('"Fresh Meat Cut For You" promotional section explaining custom meat process');
bullet('How It Works section: 3 visual steps (Choose Store → Add to Cart → Pickup)');
redBullet('Google Maps autocomplete in address/store search bar — text-based search only currently');
redBullet('Seasonal Eid/Qurbani banner auto-displayed 30 days before Eid ul Adha — page exists but auto-trigger not implemented');
redBullet('Language switcher in footer: English / Urdu / Arabic — i18n infrastructure exists but footer toggle not yet rendered');
yellowBox('AI Meal Planner feature cards on homepage (1-Day, 3-Day, Weekly, Monthly quick-launch). Functional site-wide product search bar navigating to /products?search=QUERY. Stats counter shows 10+ certified stores and 300+ products.');
doc.moveDown(0.4);

subHeading('3.2 Store Discovery (/stores)');
bullet('Only approved and active stores shown to customers');
bullet('Filters: Open Now, Pickup Available, Curbside Available, Delivery Available, Halal Certified (default ON), Minimum Rating, Maximum Fee');
bullet('Sort options: Top Rated, Fastest Pickup, Lowest Fee');
bullet('Each store card: banner image, name, rating, Halal Certified badge (gold), Masjid Affiliated badge (if applicable), estimated pickup time, convenience fee, minimum order');
redBullet('Sort by Nearest — location-based distance sort not implemented (requires geolocation API)');
bullet('City-based browsing URLs implemented: /stores/city/:city with a horizontal city-pill browsing strip on /stores — SEO-friendly, shows stores per city');
doc.moveDown(0.4);

subHeading('3.3 Store Detail Page (/stores/[store-slug])');
bullet('Store banner with unique image per store, name, rating, operating hours, service type badges');
bullet('Halal certification badge with certification number and issuing body displayed');
bullet('Sticky horizontal category navigation — clicking smooth-scrolls to that product section');
bullet('Product grid with responsive columns (mobile / tablet / desktop)');
bullet('In-store search with instant filtering');
bullet('Tabs: Products, Reviews, Store Info');
redBullet('Product name displayed in English and Urdu — only English names currently');
bullet('Compare/sale price displayed on product cards — struck-through compare price shown when comparePrice field set — IMPLEMENTED');
bullet('Low stock badge on product cards when qty ≤ lowStockThreshold — IMPLEMENTED');
redBullet('Separate Operating Hours tab — hours shown inside Store Info tab only');
yellowBox('All 10 stores have unique working banner images (distinct Unsplash photos in listing and detail). 300+ products across 10 stores (35–42 per store, 9+ categories each including store-specific specialty items).');
doc.moveDown(0.4);

subHeading('3.4 Fresh Meat Product — Custom Order Modal');
body('When a customer taps a Fresh Meat product, a 3-step customization modal opens:');
bullet('Step 1 — Cut Type: Visual selection cards — Whole / Half / Quarter / Boneless / Bone-In / Cubed / Ground / Custom');
bullet('Step 2 — Quantity: Weight selector (0.5 kg, 1 kg, 1.5 kg, 2 kg, or custom), estimated price auto-calculated');
bullet('Step 3 — Instructions: Marination preference, packaging preference, free-text special instructions');
noteBox('Fresh meat is priced by final actual weight. The amount shown is an estimate. The card is pre-authorized — final charge applied after cutting and weighing.', '#FFF8E1', C.gold, '#5a4a00', 'ℹ  IMPORTANT');
doc.moveDown(0.4);

subHeading('3.5 Substitution Preferences (Packaged Items Only)');
redBox('Substitution preferences at checkout are NOT yet implemented. Required: For every packaged item the customer selects one of four options — (1) No Replacement: remove item, partial refund auto-issued; (2) Replace with Similar: store picks best alternative; (3) Choose Specific: customer selects specific alternate product; (4) Contact Me First: store must message customer via chat before any change. Fresh meat items are never subject to substitution.');
doc.moveDown(0.4);

subHeading('3.6 Checkout');
body('Current system combines order type, tips, promo code, loyalty, and special instructions in a premium cart page. The full 4-step checkout specification is partially implemented:');
table(
  ['Checkout Item / Fee', 'Status'],
  [
    ['Step 1 — Order Type (Express Pickup, Scheduled, Curbside, Home Delivery)', 'Implemented'],
    ['Step 1 — Curbside vehicle entry (make/model/colour/plate)', 'Implemented'],
    [{ text: 'Step 2 — Substitution Preferences (per packaged item)', color: C.red }, { text: 'Not implemented', color: C.red }],
    ['Subtotal, Convenience Fee ($2.99), Curbside Fee ($1.49), Delivery Fee ($4.99)', 'Implemented'],
    ['Promo Discount, Loyalty Discount (range slider), Tip (None/$1/$2/$3/$5/Custom)', 'Implemented'],
    ['Estimated Total — clearly labelled as Estimated for meat orders', 'Implemented'],
    ['Step 4 — Animated confirmation with QR code, store address, pickup time', 'QR code displayed on order tracking page (scannable order ID) — Implemented'],
  ],
  [340, 150]
);
doc.moveDown(0.4);

subHeading('3.7 Order Tracking (/account/orders/:id/track)');
bullet('Animated status progress bar: Order Placed → Confirmed → In Preparation → Ready → Completed');
bullet('Status updates pushed in real time via Socket.IO');
bullet('"I\'m Here" button for Curbside orders — sends vehicle confirmation to store');
bullet('QR code (scannable order ID) displayed on order tracking page for express pickup at store counter — IMPLEMENTED');
redBullet('Substitution Approval popup with 5-minute timer — not implemented');
redBullet('Live in-app chat with store during order preparation — Socket.IO infrastructure exists but chat UI not built');
redBullet('Items summary accordion: real-time status of each item (Found / Out of Stock / Substituted) — not implemented');
doc.moveDown(0.4);

subHeading('3.8 Customer Account Pages');
table(
  ['Route', 'Status'],
  [
    ['/account', 'Dashboard: active orders, loyalty points balance, quick stats — Implemented'],
    ['/account/orders', 'Full order history with one-click Reorder button (POST /api/orders/:id/reorder) — Implemented'],
    ['/account/addresses', 'Saved addresses with add/edit/delete — Implemented'],
    [{ text: '/account/addresses — Google Maps autocomplete', color: C.red }, { text: 'Not implemented', color: C.red }],
    ['/account/membership', 'Subscription plan management page — all 4 plans shown (Free/$0, Basic/$4.99, Premium/$9.99, Family/$14.99) — Implemented (Stripe billing pending)'],
    ['/account/loyalty', 'Loyalty points balance, tier level, full transaction history — Implemented'],
    ['/account/meal-planner', 'AI Halal Meal Planner — Implemented'],
    ['/account/scheduled-orders', 'Recurring orders management page with pause/resume/cancel actions — IMPLEMENTED'],
    ['/account/chat', 'Customer live chat support inbox page — IMPLEMENTED'],
    ['/account/notifications', 'Notification preferences page — Implemented'],
  ],
  [250, 240]
);

// ─── PAGE: STORE PORTAL ──────────────────────────────────────────────────────
sectionHeading('4', 'Store Fulfillment Portal');
body('The store portal is designed for use on Android tablets in-store (primary) and desktop browsers. All elements use large touch targets and simplified navigation.');
redBullet('Offline mode — order data cached locally and syncs when connection is restored — not implemented');
doc.moveDown(0.4);

subHeading('4.1 Store Application (/store-portal/onboarding)');
body('Multi-step onboarding wizard — current system has 4 of the 6 specified steps:');
table(
  ['Step', 'Description', 'Status'],
  [
    ['Step 1 — Basic Info', 'Store name, phone, email, address, logo and banner image upload', 'Implemented'],
    ['Step 2 — Halal Cert', 'Certificate number, issuing body, expiry date, document upload', 'Implemented'],
    ['Step 3 — Hours', 'Per day open/closed toggle, opening/closing times, pickup slot duration, max orders per slot', 'Implemented'],
    ['Step 4 — Services', 'Pickup, Curbside (+ fee), Delivery (+ fee + radius), minimum order amount', 'Implemented'],
    [{ text: 'Step 5 — Banking', color: C.red }, { text: 'Stripe Connect onboarding to receive payouts', color: C.red }, { text: 'Not in onboarding wizard', color: C.red }],
    [{ text: 'Step 6 — Submit', color: C.red }, { text: 'Full summary review. Status: Pending Admin Review. Admin notified instantly.', color: C.red }, { text: 'Submits directly — no pending state', color: C.red }],
  ],
  [90, 260, 110]
);
doc.moveDown(0.4);

subHeading('4.2 Live Order Dashboard (/store-portal)');
bullet('Online/Offline toggle prominently displayed at top of screen');
bullet('Incoming order queue updates in real time — new orders appear via Socket.IO');
bullet('Each order card: order number, order type badge, pickup slot time, customer name, item list preview, estimated total');
bullet('One-tap Accept or Reject — Reject requires a reason to be selected');
bullet('Active orders section with status indicators and countdown timers');
bullet('Today\'s summary: Pending / In Preparation / Ready / Completed count, Total Revenue, Average Prep Time');
bullet('Audio alert for new incoming orders — implemented via Web Audio API triple-tone beep; fires when new order card appears in queue');
doc.moveDown(0.4);

subHeading('4.3 Order Processing Screen (/store-portal/orders/:id)');
bullet('Full-screen, tablet-optimized view with large touch targets');
bullet('Item checklist: each item is a large card — staff taps FOUND, OUT OF STOCK, or SUBSTITUTE');
bullet('Mark Ready: customer receives push notification and SMS simultaneously');
redBullet('Actual weight entry for fresh meat + automatic charge recalculation via Stripe — not implemented');
redBullet('Partial refund auto-triggered when item removed via No Replacement — not automated');
redBullet('Substitution flow (Replace Similar, Choose Specific, Contact First) — not implemented');
redBullet('Final Summary confirmation sent to customer before marking Ready — not implemented');
bullet('Curbside mode: vehicle info (make/model/colour/plate) entered at checkout; displayed on store portal order detail — IMPLEMENTED');
bullet('Print Slip button on store portal order detail — window.print() with formatted slip — IMPLEMENTED');
doc.moveDown(0.4);

subHeading('4.4 Product Management (/store-portal/products)');
bullet('Product fields: name, type, category, price, unit, stock quantity, images (up to 5)');
bullet('Fresh Meat extra fields: animal type, available cut types, price per kg, estimated weight range');
bullet('Halal Certified toggle per product — defaults ON');
bullet('Inventory buffer: system prevents orders beyond available stock quantity');
redBullet('Status badges: Pending Approval / Approved — Live / Rejected — all products go live immediately currently');
bullet('Product name in Urdu field — urduName field added to store portal product form — IMPLEMENTED');
bullet('Compare/sale price field with struck-through display on product cards — IMPLEMENTED');
bullet('Barcode and SKU fields in product form — IMPLEMENTED');
redBullet('Freshness label field (free text e.g. "Cut this morning") — system generates FRESH TODAY badge automatically');
bullet('Nutrition facts (calories, protein, carbs, fat, sodium) JSON field in product form — IMPLEMENTED');
redBullet('Bulk CSV import: template download, upload, preview, error report — not implemented');
redBullet('Quick inline stock edit (tap stock number to update without opening full form) — not implemented');
doc.moveDown(0.4);

subHeading('4.5 Analytics (/store-portal/analytics)');
bullet('Date range picker: Today / This Week / This Month / Custom range');
bullet('Revenue over time — line chart');
bullet('Order volume — bar chart');
bullet('Top best-selling products — chart');
bullet('Order type breakdown — chart (Express / Curbside / Delivery)');
bullet('Peak hours heatmap grid (7 days × 24 hours, colour intensity = busiest times) — 7×24 grid backed by GET /api/store/analytics/peak-hours — IMPLEMENTED');
redBullet('Average preparation time trend over selected period — not implemented');
bullet('Export: "Export CSV" button on analytics page downloads revenue/orders data — CSV export IMPLEMENTED; PDF export pending');
doc.moveDown(0.4);

subHeading('4.6 Payouts (/store-portal/payouts)');
bullet('Shows: Gross Revenue, Platform Commission (7%), Net Payout Amount');
bullet('Payout schedule: weekly via Stripe Connect');
bullet('Full payout history with dates and amounts');
redBullet('Chat with admin directly from payouts screen — not implemented');

// ─── PAGE: ADMIN PANEL ────────────────────────────────────────────────────────
sectionHeading('5', 'Admin Panel');

subHeading('5.1 Admin Dashboard (/admin)');
bullet('KPI cards: Total GMV, Platform Revenue, Total Orders Today, Active Stores, Pending Approvals, Open Support Tickets');
bullet('Live activity feed: new orders, store approvals pending, refund requests — colour-coded');
bullet('Charts: GMV trend (30-day area chart), Orders per day (bar chart), Revenue by source (stacked chart)');
bullet('Pending action panel: store applications, product approvals, refund requests — all one-click actionable');
doc.moveDown(0.4);

subHeading('5.2 Store Management (/admin/stores)');
bullet('Tabs: Pending Applications / Active Stores / Suspended / All Stores');
bullet('Pending application view: full store details, expandable info');
bullet('[APPROVE] → store goes live, owner\'s role updated, confirmation email sent');
bullet('[REJECT] → reason required, rejection email sent to applicant');
bullet('[Add Store Directly] → admin fills store form, store created as Approved immediately');
bullet('Per active store: edit details, adjust commission rate, suspend/unsuspend, view analytics, trigger manual payout');
redBullet('Halal certificate document viewer (PDF and image in-browser) in admin store management — not implemented');
redBullet('Direct chat with store applicant from admin panel — not implemented');
doc.moveDown(0.4);

subHeading('5.3 Product Approvals (/admin/products/pending)');
bullet('Dedicated product approval queue page at /admin/products/pending — implemented');
bullet('[APPROVE] → product status updated to Approved, store notified');
bullet('[REJECT + Reason] → store owner notified with reason; product marked rejected');
redBullet('Products pending approval are still visible to customers — pending-status visibility gating not yet applied');
doc.moveDown(0.4);

subHeading('5.4 Order Management (/admin/orders)');
bullet('Full order list with filters: Status, Store, Date Range, Order Type, Amount Range');
bullet('Order detail view: all items, full status timeline, fee breakdown, payment info');
bullet('Admin interventions: Issue full refund, Issue partial refund, Cancel order, Force-complete order');
bullet('Refund queue: pending refund requests — admin approves, partially approves, or rejects with reason');
doc.moveDown(0.4);

subHeading('5.5 User Management (/admin/users)');
bullet('Filter by role: All / Customers / Store Owners / Admins');
bullet('Per user: view full profile and order history, suspend with reason and duration, permanently ban, verify manually, change role');
doc.moveDown(0.4);

subHeading('5.6 Finance (/admin/finance)');
bullet('Revenue breakdown: Total GMV, commission collected (7%), convenience fees, net platform revenue — per period');
bullet('Store payouts table: store name, period, gross amount, commission deducted, net payout, status');
bullet('[Trigger Payout] → initiates bank transfer to store\'s connected Stripe account');
redBullet('Monthly P&L summary exportable as CSV — not implemented');
doc.moveDown(0.4);

subHeading('5.7 Platform Settings (/admin/settings)');
table(
  ['Setting', 'Default', 'Status'],
  [
    ['Commission Rate (default 7%, overridable per store)', '7%', 'Implemented'],
    ['Convenience Fee (platform-wide, shown at checkout)', 'Configurable', 'Implemented'],
    ['Curbside Fee (optional, can be $0)', 'Configurable', 'Implemented'],
    ['Loyalty Points Rate (points per $1 spent)', '1 point / $1', 'Implemented'],
    [{ text: 'Subscription Pricing (Basic, Premium, Family)', color: C.red }, { text: '$4.99–$14.99', color: C.red }, { text: 'Settings field exists; customer billing not wired', color: C.red }],
    ['Payout Schedule (weekly or bi-weekly)', 'Weekly', 'Implemented'],
    [{ text: 'Supported Cities (add/remove cities)', color: C.red }, { text: '—', color: C.red }, { text: 'Not implemented', color: C.red }],
    [{ text: 'Email Templates editor', color: C.red }, { text: '—', color: C.red }, { text: 'Email system exists; template editor not built', color: C.red }],
    [{ text: 'Maintenance Mode toggle', color: C.red }, { text: '—', color: C.red }, { text: 'Not implemented', color: C.red }],
  ],
  [220, 90, 180]
);
doc.moveDown(0.4);

subHeading('5.8 Chat, Support & Audit');
bullet('Support Tickets (/admin/support): ticket queue with Open / In Progress / Resolved tabs, admin replies, closes, or escalates');
bullet('Audit Log (/admin/audit): every admin action permanently logged with admin name, action, target, old/new value, IP address, timestamp — append-only');
bullet('Admin Chat (/admin/chat): conversation list + reply composer page built and added to admin sidebar — IMPLEMENTED (full Socket.IO real-time integration pending)');

// ─── PAGE: REAL-TIME SYSTEM ───────────────────────────────────────────────────
sectionHeading('6', 'Real-Time System & Chat');
body('The platform uses Socket.IO WebSocket connections for all real-time features, initialized with /customer, /store, and /admin namespaces with JWT authentication middleware.');
doc.moveDown(0.4);

subHeading('6.1 Chat System');
noteBox('Chat UI pages built: /account/chat (customer inbox), /admin/chat (admin interface). Full real-time features (typing indicators, read receipts, image sharing) still pending. Socket.IO infrastructure with /customer, /store, /admin namespaces is active. Chat rooms linked to orders and /store-portal/chat remain to be built.', C.yellowBg, C.gold, C.yellow, '⚠  PARTIALLY IMPLEMENTED');
doc.moveDown(0.4);

subHeading('6.2 Real-Time Order Events');
table(
  ['Event', 'Triggered When', 'Received By', 'Status'],
  [
    ['New Order', 'Customer places order', 'Store — animated card + audio triple-tone beep', 'Implemented'],
    ['Order Status Update', 'Store advances status', 'Customer — status bar updates live', 'Implemented'],
    ['Order Ready', 'Store marks ready', 'Customer — push notification + SMS', 'Implemented'],
    [{ text: 'Substitution Request', color: C.red }, { text: 'Store marks item out of stock', color: C.red }, { text: 'Customer — approval popup with timer', color: C.red }, { text: 'Not implemented', color: C.red }],
    ['I\'m Here (Curbside)', 'Customer taps I\'m Here', 'Store — vehicle info alert', 'Implemented via Socket.IO'],
    [{ text: 'New Message (Chat)', color: C.yellow }, { text: 'Any party sends message', color: C.yellow }, { text: 'Recipient — live delivery, unread badge', color: C.yellow }, { text: 'Chat UI pages built; real-time delivery pending', color: C.yellow }],
    ['Store Approval Needed', 'New application submitted', 'Admin — notification', 'Implemented'],
    ['Product Approval Needed', 'Store submits new product', 'Admin — queue increments', 'Implemented — /admin/products/pending approval queue with approve/reject'],
    ['Order Cancelled', 'Customer cancels before prep', 'Store — order removed from queue', 'Implemented'],
  ],
  [110, 130, 140, 110]
);

// ─── PAGE: ORDER LIFECYCLE ────────────────────────────────────────────────────
sectionHeading('7', 'Order Lifecycle & Special Flows');

subHeading('7.1 Order Status Flow');
table(
  ['Status', 'Meaning', 'Status'],
  [
    ['PENDING', 'Order placed — awaiting store confirmation', 'Implemented'],
    ['STORE_CONFIRMED', 'Store accepted — preparation begins', 'Implemented'],
    ['IN_PREPARATION', 'Staff is actively picking and packing', 'Implemented'],
    [{ text: 'REPLACEMENT_HANDLING', color: C.red }, { text: 'One or more items unavailable — substitution process active', color: C.red }, { text: 'Not implemented', color: C.red }],
    ['READY_FOR_PICKUP', 'Order packed — customer notified via push + SMS', 'Implemented'],
    ['OUT_FOR_DELIVERY', 'Store\'s driver has picked up the order (delivery orders)', 'Status exists'],
    ['COMPLETED', 'QR code scanned / curbside delivered / delivery confirmed', 'Implemented'],
    ['CANCELLED', 'Cancelled before IN_PREPARATION — only cancellation window', 'Implemented'],
    ['REFUNDED', 'Admin processed a refund after completion', 'Implemented'],
  ],
  [160, 220, 110]
);
noteBox('Cancellation is ONLY allowed while order status is PENDING or STORE_CONFIRMED. Once preparation begins, cancellation is not possible. Automatic partial refunds are issued for items removed due to No Replacement substitution preference.', '#E8F5E9', C.teal, '#1a4a3e', 'ℹ  CANCELLATION RULE');
doc.moveDown(0.4);

subHeading('7.2 Fresh Meat Payment Flow');
redBox('Fresh meat pre-authorization flow not yet implemented. Required: (1) Customer places order → Stripe pre-authorizes estimated amount (card hold, not a charge). (2) Store cuts meat and enters actual weight on tablet. (3) System recalculates: final price = actual weight × price per kg. (4) Stripe PaymentIntent updated to final amount. (5) Final amount captured when order marked Completed. (6) If final weight exceeds estimate by more than 10%, customer is notified before capture.');
doc.moveDown(0.4);

subHeading('7.3 Automated Recurring Orders');
redBox('Automated recurring orders are not yet implemented. Required: Customer creates recurring order (store, items, frequency: weekly/bi-weekly/monthly, preferred day and time). System automatically places order at scheduled time. Customer receives notification 24 hours before each occurrence. Customer can skip, pause, or cancel from /account/scheduled-orders.');

// ─── PAGE: AI MEAL PLANNER ────────────────────────────────────────────────────
sectionHeading('8', 'AI Halal Meal Planner');
body('The AI Meal Planner is an intelligent grocery planning tool built exclusively for the halal market. It helps customers plan weekly meals, auto-generates a grocery list, and allows them to order everything with a single tap.');
doc.moveDown(0.4);

subHeading('8.1 How It Works');
table(
  ['Step', 'Description', 'Status'],
  [
    ['Step 1 — Set Preferences', 'Cuisine type (Pakistani / Middle Eastern / African / Mixed Halal), dietary style (Standard / Low-carb / High-protein / Diabetic-friendly), family size (1–10), weekly grocery budget', 'Implemented'],
    ['Step 2 — Generated Meal Plan', 'AI generates halal meal plan: breakfast, lunch, dinner per day. All recipes use halal-certified ingredients. Customer can swap individual meals via "Swap Meal" button (POST /api/meal-planner/swap-meal).', 'Implemented — including individual meal swap'],
    ['Step 3 — Auto Grocery List', 'Ingredients extracted from plan, duplicates combined, quantities summed, full list with estimated cost per item shown', 'Implemented'],
    ['Step 4 — Select Store & Order', 'Customer selects preferred nearby store. Available items auto-matched. "Add All to Cart" proceeds to checkout.', 'Implemented; store selection per plan not yet built'],
  ],
  [110, 250, 130]
);
doc.moveDown(0.4);

subHeading('8.2 Meal Plan Features');
bullet('Partial cart: if some items unavailable at selected store, available items added — missing items shown separately');
bullet('Saved meal plans: customer can name and save any generated plan (e.g. "Ramadan Plan"), view all saved plans, load into active view, or delete — fully implemented (POST/GET/DELETE /api/meal-planner/plans)');
redBullet('Auto-order toggle: saved plan set to auto-order weekly — not implemented');
redBullet('Seasonal suggestions: Eid-specific meal plans during Eid season — not implemented');
bullet('Nutritional overview: estimated weekly calories, protein, carbs, and fat macro panel displayed under generated meal plan — IMPLEMENTED');
yellowBox('Plan duration selector beyond weekly: 1-Day (3 meals), 3-Day (9 meals), Weekly (21 meals), Monthly (90 meals). Protein preference multi-selector (Chicken, Beef, Lamb, Goat, Fish/Seafood, Vegetarian). Per-meal "Add to Cart" button. Budget utilization progress bar. Per-day accordion with prep/cook time and ingredient count. Budget presets ($50–$400). Generating animation with AI scanning 300+ products text.');

// ─── PAGE: PAYMENTS & SUBSCRIPTIONS ─────────────────────────────────────────
sectionHeading('9', 'Payment System & Subscriptions');

subHeading('9.1 Customer Payments');
bullet('All payments processed via Stripe — card details never touch platform servers (PCI compliant)');
bullet('Stripe webhook signatures verified on every incoming webhook event');
bullet('Full refunds: admin-processed from order management');
redBullet('Standard orders: payment captured upon store confirmation — currently captured at checkout');
redBullet('Meat orders: pre-authorization hold placed, actual charge after final weight — not implemented');
redBullet('Partial refunds: automatically issued when items removed via No Replacement — not automated');
doc.moveDown(0.4);

subHeading('9.2 Store Payouts');
bullet('Each store connects bank account via Stripe Connect at onboarding');
bullet('Platform calculates: Gross Revenue − 7% Commission = Net Payout Amount');
bullet('Payouts processed weekly (Monday) via cron job — automatically');
bullet('Admin can trigger manual payout from /admin/finance at any time');
bullet('All payout records stored — stores view full history from /store-portal/payouts');
doc.moveDown(0.4);

subHeading('9.3 Subscription Plans');
redBox('Subscription plans are defined in admin settings but the customer-facing subscription flow is not yet built. Plans: Free ($0/month, standard access); Basic ($4.99/month, free delivery on orders over $35); Premium ($9.99/month, free delivery over $25 + 5% cashback); Family ($14.99/month, all Premium benefits + 3 linked family accounts). /account/membership page for plan management does not yet exist.');
doc.moveDown(0.4);

subHeading('9.4 Loyalty Points System');
bullet('Customers earn 1 point per $1 spent on every order');
bullet('Points redeemable at checkout — 100 points = $1 off (range slider in cart)');
bullet('Tiers based on total lifetime points: Bronze / Silver / Gold / Platinum');
bullet('Points expire after 12 months of account inactivity — 7-day warning notification sent (cron job implemented)');
bullet('200 bonus loyalty points awarded on first-ever order — backend checks order count, applies bonus automatically on POST /api/orders');
bullet('Referral bonus: unique code (NUMA + UUID prefix) shown on /account; POST /api/users/apply-referral awards 100 pts to referee, 50 pts to referrer — IMPLEMENTED');
redBullet('Eid special order bonus points (extra 50 pts during Eid window) — not yet implemented');

// ─── PAGE: NOTIFICATIONS ─────────────────────────────────────────────────────
sectionHeading('10', 'Notification System');
body('The platform delivers notifications via in-app (stored and retrievable), email (Nodemailer with branded HTML templates), and SMS (Twilio scaffold with env vars and SMS templates).');
doc.moveDown(0.4);

table(
  ['Event', 'In-App', 'Email', 'SMS', 'Status'],
  [
    ['Order Confirmed by Store', '✓', '✓', '—', 'Implemented'],
    ['Order In Preparation', '✓', '—', '—', 'Implemented'],
    [{ text: 'Substitution Request Needs Approval', color: C.red }, { text: '✓', color: C.red }, { text: '—', color: C.red }, { text: '✓', color: C.red }, { text: 'Not implemented (substitution system not built)', color: C.red }],
    ['Order Ready for Pickup', '✓', '✓', '✓', 'Implemented'],
    ['Order Completed — Receipt', '✓', '✓', '—', 'Implemented'],
    ['Refund Processed', '✓', '✓', '—', 'Implemented'],
    [{ text: 'Product Approved / Rejected', color: C.red }, { text: '✓', color: C.red }, { text: '✓', color: C.red }, { text: '—', color: C.red }, { text: 'Email not fully triggered (no approval queue)', color: C.red }],
    ['Store Approved / Rejected', '✓', '✓', '—', 'Partial — email template exists'],
    ['Loyalty Points Earned', '✓', '—', '—', 'Implemented'],
    ['Points Expiring Soon', '✓', '✓', '—', 'Implemented (cron job)'],
    ['Weekly Store Earnings Summary', '—', '✓', '—', 'Implemented (weekly cron)'],
    [{ text: 'Recurring Order Reminder (24hrs before)', color: C.red }, { text: '✓', color: C.red }, { text: '✓', color: C.red }, { text: '—', color: C.red }, { text: 'Not implemented (recurring orders not built)', color: C.red }],
  ],
  [160, 50, 50, 50, 180]
);
redBullet('All notifications stored with English and Urdu versions — bilingual content not yet implemented');

// ─── PAGE: EID SPECIALS ───────────────────────────────────────────────────────
sectionHeading('11', 'Eid Specials & Qurbani System');

subHeading('11.1 Eid/Qurbani Ordering (/eid-specials)');
bullet('Seasonal landing page at /eid-specials — exists as customer-facing page');
bullet('Eid grocery bundles: curated product bundles shown from stores');
redBullet('Automatically displayed / promoted 30 days before Eid ul Adha — auto-trigger banner not implemented');
redBullet('Advance Qurbani pre-orders: whole animal / half / quarter with preferred cut style — not implemented');
redBullet('Family name for dedication/niyyah recorded on the order — not implemented');
redBullet('Eid pickup date selection: preferred Eid morning pickup slot — not implemented');
redBullet('Arabic calligraphy header and Eid Mubarak greeting in English, Urdu, and Arabic — not implemented');
bullet('Countdown timer to Eid ul-Adha shown prominently on /eid-specials — live real-time DD:HH:MM:SS display, auto-calculated from next Eid date');
doc.moveDown(0.4);

subHeading('11.2 Masjid Partnerships');
bullet('Stores can be marked as Masjid Affiliated — special badge shown on store card');
bullet('Masjid name shown on store detail page');
redBullet('Jumma Day Specials: stores can set Friday-specific promotions — not implemented');
redBullet('Community bulk orders: group order feature for Masjid communities — not implemented');

// ─── PAGE: SEO, MULTILINGUAL ──────────────────────────────────────────────────
sectionHeading('12', 'SEO, Multilingual & Accessibility');

subHeading('12.1 URL Structure & SEO');
table(
  ['URL', 'Status'],
  [
    ['/ (Homepage)', 'Implemented — SEO title, meta description, OG tags'],
    ['/stores (All stores)', 'Implemented — indexable, 84-URL sitemap confirmed'],
    ['/stores/city/[city] (City-specific store list)', 'Implemented — /stores/city/:city page with city browsing pill strip; shows count + store grid per city'],
    ['/stores/[store-slug] (Store detail)', 'Implemented — JSON-LD LocalBusiness + AggregateRating'],
    ['/products/[product-slug] (Product detail)', 'Implemented — /products/:slug with JSON-LD Product schema, meta tags, add-to-cart, compare price, barcode'],
    ['/halal-meat', 'Implemented — indexable landing page'],
    ['/eid-specials', 'Implemented — indexable seasonal page'],
    ['/api/sitemap.xml', 'Implemented — auto-generated XML sitemap (84 URLs)'],
    ['/api/robots.txt', 'Implemented — public pages allowed, private portals blocked'],
  ],
  [230, 260]
);
doc.moveDown(0.4);

subHeading('12.2 Multilingual Support');
bullet('Languages: English (default), Urdu, Arabic — i18n infrastructure with i18next exists');
bullet('Language toggle in navigation header — EN/UR/AR selector rendered in navbar; RTL layout activated for Arabic and Urdu via localStorage + html dir attribute');
bullet('Arabic/Urdu RTL layout implemented — direction set document-wide when user selects RTL language');
redBullet('Product names and email templates support bilingual content — not yet implemented');
redBullet('Store names can be entered in both English and Urdu — only English name field exists');
doc.moveDown(0.4);

subHeading('12.3 Accessibility');
bullet('Minimum touch target size on all interactive elements (critical for tablet store portal)');
bullet('Keyboard navigation supported throughout all portals');
redBullet('Screen reader support: ARIA labels on all interactive components — partial, not systematically implemented');
redBullet('Colour contrast ratios meet WCAG 2.1 AA standards — not formally audited');
redBullet('Skeleton loaders used instead of spinners — spinners used currently; skeleton loaders not systematically implemented');

// ─── PAGE: REVENUE MODEL ─────────────────────────────────────────────────────
sectionHeading('13', 'Revenue Model');
table(
  ['Revenue Stream', 'Default Amount', 'Details', 'Status'],
  [
    ['Store Commission', '7% of subtotal', 'Deducted from store gross at payout. Admin can set per-store rates.', 'Implemented'],
    ['Convenience Fee', 'Platform setting', 'Charged to customer per order. Shown transparently at checkout.', 'Implemented'],
    ['Curbside Fee', 'Optional (can be $0)', 'Added to customer total only for curbside orders.', 'Implemented'],
    ['Delivery Fee', 'Store-set amount', 'For store-managed delivery. Commission still applies.', 'Implemented'],
    [{ text: 'Subscription Plans', color: C.red }, { text: '$4.99–$14.99/mo', color: C.red }, { text: 'Basic, Premium, Family plans billed through Stripe Subscriptions', color: C.red }, { text: 'Settings defined; billing not wired', color: C.red }],
    [{ text: 'Advertising (Phase 2)', color: C.red }, { text: 'CPM / CPC', color: C.red }, { text: 'Halal CPG brands pay for sponsored placements — Phase 2 feature', color: C.red }, { text: 'Not yet built', color: C.red }],
  ],
  [110, 100, 180, 100]
);

// ─── PAGE: SECURITY & COMPLIANCE ─────────────────────────────────────────────
sectionHeading('14', 'Security & Compliance');

subHeading('14.1 Authentication & Authorization');
bullet('All user sessions managed with JSON Web Tokens — access tokens expire in 15 minutes, refresh tokens in 7 days');
bullet('Passwords stored using bcrypt hashing — raw passwords never stored');
bullet('Every API endpoint enforces role check — unauthorized access returns 403');
bullet('All admin actions permanently recorded in the audit log');
bullet('Google OAuth implemented as alternative login method — GET /api/auth/google initiates OAuth flow; callback exchanges code for JWT tokens and redirects to app; "Continue with Google" button on login page');
doc.moveDown(0.4);

subHeading('14.2 Data & API Security');
bullet('Security headers applied to all responses via Helmet.js (prevents clickjacking, XSS, MIME sniffing)');
bullet('Rate limiting on all endpoints — auth endpoints especially restricted (express-rate-limit)');
bullet('All user inputs validated and sanitized before processing (Zod validation + express-mongo-sanitize)');
bullet('Payment card data never stored on platform — entirely handled by Stripe (PCI compliant)');
bullet('Stripe webhook signatures verified on every incoming webhook event');
redBullet('File uploads restricted: type validation, maximum 5 MB per file — explicit size enforcement not yet implemented');
doc.moveDown(0.4);

subHeading('14.3 Privacy Compliance (CCPA — USA)');
bullet('Privacy policy page at /privacy — 11 sections covering CCPA data rights, retention, cookies, third-party sharing');
bullet('Cookie consent banner — sliding CCPA/privacy-compliant banner on first visit with Accept/Decline; preference persisted in localStorage');
bullet('Account deletion — DELETE /api/users/me soft-deletes and anonymizes user (email → deleted_USER_ID@deleted.com, name/phone cleared, account marked inactive)');
bullet('Personal data export — GET /api/users/me/export returns complete JSON download of all stored personal data as an attachment');
bullet('Every transactional email includes an unsubscribe link and Privacy Policy link in the footer template — IMPLEMENTED');
redBullet('Order financial data explicitly retained for 7 years per US financial regulations — retention policy not enforced in DB');

// ─── PAGE: TECHNICAL ARCHITECTURE (YELLOW — in system, not in SRS) ───────────
sectionHeading('16', 'Technical Architecture (System — Not in Original SRS)');
doc.fillColor(C.yellow).font('Helvetica-Bold').fontSize(9)
  .text('This entire section describes the current technical stack — not included in the original SRS.', 60, doc.y, { width: W });
doc.moveDown(0.5);

subHeading('16.1 Technology Stack');
table(
  ['Layer', 'Technology'],
  [
    ['Frontend', 'React 18 + TypeScript, Vite, TailwindCSS, shadcn/ui, Framer Motion, React Query'],
    ['Backend', 'Node.js + Express, TypeScript, Drizzle ORM, PostgreSQL'],
    ['Real-Time', 'Socket.IO 4 with /customer, /store, /admin namespaces + JWT auth middleware'],
    ['Payments', 'Stripe (PaymentIntent, Stripe Connect, Webhooks)'],
    ['Email', 'Nodemailer with branded HTML email templates'],
    ['SMS', 'Twilio scaffold (env vars configured, templates ready)'],
    ['AI', 'OpenAI GPT — AI Halal Meal Planner generation'],
    ['Cron Jobs', 'node-cron — pickup-slots, analytics-rollup, weekly-payouts, loyalty-expiry'],
    ['Security', 'Helmet.js, express-rate-limit, bcrypt, Zod validation, express-mongo-sanitize'],
    ['SEO', 'React Helmet, JSON-LD structured data, sitemap.xml (84 URLs), robots.txt'],
    ['i18n', 'i18next — English, Urdu, Arabic translation files (RTL pending)'],
    ['Monorepo', 'pnpm workspace — @workspace/api-server, @workspace/halal-grocery'],
  ],
  [130, 360]
);
doc.moveDown(0.4);

subHeading('16.2 Key System Components Built');
yellowBullet('10 halal grocery stores with unique store profiles, banners, operating hours, service types');
yellowBullet('300+ products across all 10 stores (35–42 per store, 9+ categories each)');
yellowBullet('Three separate login portals: /login (customer), /store-login (store owner), /admin-login (admin)');
yellowBullet('Full admin panel with dashboard, store/order/user/finance management, settings, audit log');
yellowBullet('Store onboarding 4-step wizard with halal certificate upload');
yellowBullet('AI Meal Planner: 4 plan types (1-Day, 3-Day, Weekly, Monthly) + protein preference selector');
yellowBullet('Premium cart page: sticky sidebar, loyalty slider, tip options, order type selection, trust badges');
yellowBullet('Cron jobs for pickup slot generation, analytics rollup, weekly payouts, loyalty point expiry');
yellowBullet('Socket.IO real-time engine with JWT auth across 3 namespaces');
yellowBullet('Stripe integration: PaymentIntent, Stripe Connect onboarding, webhook verification');
yellowBullet('SEO: 84-URL sitemap, robots.txt, JSON-LD LocalBusiness + AggregateRating on store pages');

// ─── PAGE: FUTURE ROADMAP ─────────────────────────────────────────────────────
sectionHeading('15', 'Future Roadmap');

subHeading('Phase 2 — Planned');
body('The following features are planned for Phase 2 development:');
redBullet('Multi-Store Cart: allow customers to order from multiple stores in one checkout');
redBullet('Native Mobile Apps: iOS and Android apps');
redBullet('Store-Managed Delivery Network: stores onboard their own drivers through the platform');
redBullet('Full Qurbani System: advance whole-animal bookings, family niyyah, Eid-day pickup slots');
redBullet('Advertising Platform: halal CPG brands run sponsored product placements within marketplace');
doc.moveDown(0.5);

subHeading('Phase 3 — Planned');
redBullet('POS Integration: automated inventory sync with Square, Shopify, and Clover POS systems');
redBullet('Health Benefits Integration: insurance and employer-funded grocery benefit programs');
redBullet('AI Substitution Learning: substitution recommendations improve over time based on acceptance history');
redBullet('Geographic Expansion: UK, Australia, UAE markets');

// ─── PAGE: SUMMARY TABLE ──────────────────────────────────────────────────────
sectionHeading('APPENDIX', 'Summary of Implementation Gaps');

subHeading('All Implemented Features (Green)');
const newlyImplemented = [
  ['✓', 'Language toggle (EN/UR/AR) in Navbar; RTL layout set for Arabic/Urdu via localStorage', '12.2'],
  ['✓', 'Cookie consent banner (sliding, with accept/decline, CCPA/privacy-compliant)', '14.3'],
  ['✓', 'Privacy Policy page (/privacy) — 11 sections covering CCPA/US privacy rights', '14.3'],
  ['✓', '/account/membership page — all 4 plans (Free/$0, Basic/$4.99, Premium/$9.99, Family/$14.99)', '9.3'],
  ['✓', 'Product approval queue (/admin/products/pending) — approve/reject flow with POST endpoints', '2.2, 5.3'],
  ['✓', 'One-click Reorder button on order history — re-adds items to cart via POST /api/orders/:id/reorder', '3.8'],
  ['✓', 'Audio alert (Web Audio API triple-tone) for new orders in store portal dashboard', '4.2'],
  ['✓', 'Eid ul-Adha countdown timer on /eid-specials — live real-time DD:HH:MM:SS display', '11.1'],
  ['✓', 'Bonus 200 loyalty points for first-ever order (backend, POST /api/orders)', '9.4'],
  ['✓', 'Eid Specials link added to Navbar (desktop + mobile) with moon icon', '11.1'],
  ['✓', 'Membership Plans link in Navbar user dropdown and in Footer', '9.3'],
  ['✓', 'Product Approvals link in Admin sidebar navigation (Package icon)', '2.2'],
  ['✓', 'Footer: Privacy Policy link updated to /privacy; Membership Plans added', '14.3'],
  ['✓', 'Saved Meal Plans — customers can name, save, load, and delete plans; meal_plans DB table + POST/GET/DELETE /api/meal-planner/plans', '8.2'],
  ['✓', 'City-based store URLs — /stores/city/:city page with count + store grid; city browsing pill strip on /stores page', '3.2, 12.1'],
  ['✓', 'CCPA data export — GET /api/users/me/export returns full JSON of personal data as downloadable attachment', '14.3'],
  ['✓', 'CCPA account deletion — DELETE /api/users/me soft-deletes and anonymizes user record (email, name, phone cleared)', '14.3'],
  ['✓', 'Google OAuth — GET /api/auth/google + /api/auth/google/callback; JWT tokens issued; "Continue with Google" button on login page', '14.1'],
  ['✓', 'QR code (order ID) on order tracking page — customers can scan to confirm pickup at counter', '3.6'],
  ['✓', 'Vehicle info (make/model/colour/plate) fields at curbside checkout; displayed on store-portal-order detail', '3.6'],
  ['✓', 'Product fields in store portal: Urdu name, compare price (strike-through), barcode, SKU, nutrition JSON, low stock threshold', '4.4'],
  ['✓', 'Store CSV Export: store-portal analytics "Export CSV" downloads revenue + orders chart; admin finance "Export CSV" downloads payout table', '4.5, 5.6'],
  ['✓', 'Peak Hours Heatmap — 7×24 grid in store analytics; backend GET /api/store/analytics/peak-hours (90-day rolling window)', '4.5'],
  ['✓', 'Individual Meal Swap — "Swap Meal" button per meal card; AI regenerates single meal via POST /api/meal-planner/swap-meal', '8.1'],
  ['✓', 'Nutritional Overview — estimated macro panel (calories, protein, carbs, fat) rendered under generated meal plan', '8.2'],
  ['✓', 'Product Detail Pages — /products/:slug with full info, JSON-LD Product schema, meta tags, add-to-cart, compare price, barcode', '12.1'],
  ['✓', 'Print Slip — "Print Slip" button on store-portal order detail calls window.print() with formatted slip', '4.3'],
  ['✓', 'Referral Code — unique NUMA+UUID code shown on /account; POST /api/users/apply-referral awards 100 pts to referee + 50 pts to referrer', '9.4'],
  ['✓', '/account/chat — customer live chat inbox page with support widget UI', '3.8'],
  ['✓', '/account/scheduled-orders — recurring orders management page with pause/resume/cancel actions', '3.8, 7.3'],
  ['✓', '/admin/chat — admin live chat interface with conversation list + reply composer; added to admin sidebar', '5.8'],
  ['✓', 'Unsubscribe link + Privacy Policy link in every transactional email footer template', '14.3'],
  ['✓', 'CCPA/CPRA privacy preferences — GET/PATCH /api/users/me/privacy-preferences; doNotSell + limitSensitiveData columns in DB; toggles in account.tsx', '14.3'],
  ['✓', 'CCPA/CPRA privacy policy page — 14 sections covering CCPA rights, Do Not Sell, Limit Sensitive Data, CAN-SPAM, 7-year retention, breach notification', '14.3'],
  ['✓', '"Do Not Sell or Share My Personal Information" link in Footer legal strip; CCPA quick-rights cards on privacy page', '14.3'],
];
table(
  ['', 'Feature Implemented', 'SRS Section'],
  newlyImplemented.map(([n, f, s]) => [
    { text: n, color: '#3FB196' },
    { text: f, color: '#3FB196' },
    { text: s, color: '#3FB196' },
  ]),
  [20, 390, 80]
);

doc.moveDown(0.8);
subHeading('Features in SRS Still Not Implemented (Red)');
const gaps = [
  ['1',  'STORE_STAFF role and limited portal access', '2'],
  ['2',  'Store approval: rejection email notifications to store owner', '2.1'],
  ['3',  'Google Maps autocomplete in address entry and store search', '3.1, 3.8'],
  ['4',  'Substitution preferences at checkout (4 options per packaged item)', '3.5, 3.6'],
  ['5',  'Substitution approval popup with 5-minute countdown on tracking page', '3.7'],
  ['6',  'Store portal tablet offline mode with local cache sync', '4'],
  ['7',  'Actual weight entry for fresh meat + automatic charge recalculation', '4.3, 7.2'],
  ['8',  'Bulk product CSV import in store portal', '4.4'],
  ['9',  'Chat with admin from payouts screen', '4.6'],
  ['10', 'Halal cert PDF/image document viewer in admin store management', '5.2'],
  ['11', 'Full chat system: typing indicators, read receipts, image sharing via Socket.IO', '6.1'],
  ['12', 'Stripe pre-authorization hold for fresh meat; final capture after weight entry', '7.2, 9.1'],
  ['13', 'Automated recurring orders with cron scheduling (UI exists; backend scheduling pending)', '7.3'],
  ['14', 'Stripe billing integration for membership plans (UI complete, Stripe pending)', '9.3'],
  ['15', 'Auto-order toggle on saved meal plans (nutritional overview implemented; auto-order not yet)', '8.2'],
  ['16', 'Jumma Day Specials and community bulk/group orders for Masjids', '11.2'],
  ['17', 'ARIA labels, WCAG 2.1 AA audit, skeleton loaders on all pages', '12.3'],
  ['18', 'Monthly P&L CSV export in admin finance', '5.6'],
  ['19', 'All roadmap items (Phase 2 & 3)', '15'],
];
table(
  ['#', 'Feature / Requirement', 'SRS Section'],
  gaps.map(([n, f, s]) => [
    { text: n, color: C.red },
    { text: f, color: C.red },
    { text: s, color: C.red },
  ]),
  [30, 370, 90]
);

doc.moveDown(0.6);
subHeading('Features in System Not in Original SRS (Yellow)');
const additions = [
  ['1', 'Three separate login portals (/login, /store-login, /admin-login) with distinct visual themes and role enforcement'],
  ['2', 'AI Meal Planner — 4 plan durations: 1-Day, 3-Day, Weekly, Monthly (SRS only specified 7-day weekly)'],
  ['3', 'Protein preference multi-selector in Meal Planner (Chicken, Beef, Lamb, Goat, Fish/Seafood, Vegetarian)'],
  ['4', 'Per-meal "Add to Cart" button — add individual meal\'s ingredients without adding full plan'],
  ['5', 'Budget utilization progress bar in Meal Planner showing % of budget consumed'],
  ['6', 'AI Meal Planner feature cards on homepage (1-Day, 3-Day, Weekly, Monthly quick-launch)'],
  ['7', '300+ products across 10 stores (35–42 per store, 9+ categories, store-specific specialty items)'],
  ['8', 'All 10 stores have unique banner images in both listing cards and store detail pages'],
  ['9', 'Functional site-wide product search bar on homepage navigating to /products?search='],
  ['10', 'Cart: sticky sidebar, category image fallbacks, trust badges, Custom tip option, savings summary'],
  ['11', 'Socket.IO with /customer, /store, /admin namespaces + JWT auth middleware'],
  ['12', 'Cron jobs: pickup-slots, analytics-rollup, weekly-payouts, loyalty-expiry'],
  ['13', 'Separate Technical Architecture section documenting stack and components'],
];
table(
  ['#', 'Feature Added to System (not in original SRS)'],
  additions.map(([n, f]) => [
    { text: n, color: C.yellow },
    { text: f, color: C.yellow },
  ]),
  [30, 460]
);

// ─── PAGE NUMBERS & FOOTERS ───────────────────────────────────────────────────
// Fix: temporarily set margins.bottom = 0 so text at footY doesn't trigger
// a new page (PDFKit overflow check: doc.y > page.height - margins.bottom)
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(pages.start + i);
  if (i === 0) continue; // skip cover
  const footY = doc.page.height - 36;

  // Allow writing below the bottom margin without overflow
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  // Footer rule
  doc.save()
    .moveTo(60, footY - 8)
    .lineTo(60 + W, footY - 8)
    .lineWidth(0.3)
    .strokeColor(C.border)
    .stroke()
    .restore();

  doc.fillColor('#aaaaaa').font('Helvetica').fontSize(7);
  doc.text(
    'Confidential — Numa Fresh Marketplace — SRS v2.0 — April 2026',
    60, footY,
    { width: W - 60, align: 'left', lineBreak: false }
  );
  doc.text(
    `Page ${i + 1}`,
    60, footY,
    { width: W, align: 'right', lineBreak: false }
  );

  // Restore margin
  doc.page.margins.bottom = savedBottom;
}

doc.end();
console.log(`\n✅ PDF generated: ${OUT}`);
