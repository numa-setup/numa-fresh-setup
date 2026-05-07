import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  ShadingType,
  convertInchesToTwip,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { writeFileSync } from "fs";

// ────────────────────────────────────────────────────────────────
// Color constants
// ────────────────────────────────────────────────────────────────
const RED = "CC0000";
const YELLOW_HIGHLIGHT = "yellow" as const;
const BLACK = "000000";
const DARK_GREEN = "1A5276";
const MEDIUM_GRAY = "555555";
const LIGHT_GRAY_FILL = "F2F2F2";
const HEADER_FILL = "1A5276";
const HEADER_FONT_COLOR = "FFFFFF";
const ACCENT_FILL = "EAF0FB";

// ────────────────────────────────────────────────────────────────
// TextRun helpers
// ────────────────────────────────────────────────────────────────
function normal(text: string): TextRun {
  return new TextRun({ text, color: BLACK });
}
function red(text: string): TextRun {
  return new TextRun({ text, color: RED });
}
function yellow(text: string): TextRun {
  return new TextRun({ text, highlight: YELLOW_HIGHLIGHT });
}
function bold(text: string, color = BLACK): TextRun {
  return new TextRun({ text, bold: true, color });
}

// ────────────────────────────────────────────────────────────────
// Paragraph helpers
// ────────────────────────────────────────────────────────────────
function para(runs: TextRun[], spacing = 160): Paragraph {
  return new Paragraph({ children: runs, spacing: { after: spacing } });
}
function bullet(runs: TextRun[]): Paragraph {
  return new Paragraph({ children: runs, bullet: { level: 0 }, spacing: { after: 80 } });
}
function subbullet(runs: TextRun[]): Paragraph {
  return new Paragraph({ children: runs, bullet: { level: 1 }, spacing: { after: 60 } });
}
function h1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: DARK_GREEN, size: 32 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: DARK_GREEN } },
  });
}
function h2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: DARK_GREEN, size: 26 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
  });
}
function h3(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: MEDIUM_GRAY, size: 24 })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 60 },
  });
}
function pb(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}
function empty(): Paragraph {
  return new Paragraph({ children: [new TextRun("")], spacing: { after: 80 } });
}
function note(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `ℹ️  ${text}`, italics: true, color: "1A5276", size: 20 })],
    shading: { type: ShadingType.CLEAR, fill: ACCENT_FILL },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: "1A5276" } },
    spacing: { before: 80, after: 120 },
    indent: { left: convertInchesToTwip(0.15) },
  });
}

// ────────────────────────────────────────────────────────────────
// Table helpers
// ────────────────────────────────────────────────────────────────
function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: HEADER_FONT_COLOR, size: 20 })] })],
    shading: { type: ShadingType.CLEAR, fill: HEADER_FILL },
  });
}
function dataCell(runs: TextRun[], shaded = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: runs, spacing: { after: 40 } })],
    shading: shaded ? { type: ShadingType.CLEAR, fill: LIGHT_GRAY_FILL } : undefined,
  });
}

type CellContent = string | TextRun[];
function simpleTable(headers: string[], rows: CellContent[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(h => headerCell(h)),
    tableHeader: true,
  });
  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map(cell =>
        dataCell(
          Array.isArray(cell)
            ? cell
            : [new TextRun({ text: cell as string, size: 20 })],
          ri % 2 === 1
        )
      ),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// Convenience: a table cell whose content is colored runs
function rCell(text: string): TextRun[] {
  return [new TextRun({ text, color: RED, size: 20 })];
}
function yCell(text: string): TextRun[] {
  return [new TextRun({ text, highlight: YELLOW_HIGHLIGHT, size: 20 })];
}
function nCell(text: string): TextRun[] {
  return [new TextRun({ text, color: BLACK, size: 20 })];
}

// ────────────────────────────────────────────────────────────────
// Color key box
// ────────────────────────────────────────────────────────────────
function colorKeyBox(): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: "DOCUMENT COLOR KEY", bold: true, color: DARK_GREEN, size: 22 })],
      shading: { type: ShadingType.CLEAR, fill: "D6EAF8" },
      border: {
        top: { style: BorderStyle.SINGLE, size: 8, color: DARK_GREEN },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: DARK_GREEN },
        left: { style: BorderStyle.SINGLE, size: 8, color: DARK_GREEN },
        right: { style: BorderStyle.SINGLE, size: 8, color: DARK_GREEN },
      },
      spacing: { before: 120, after: 60 },
      indent: { left: convertInchesToTwip(0.15) },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "  ■  Normal (black) text", color: BLACK, bold: true }),
        new TextRun({ text: "  =  Feature exists in SRS AND is implemented in the system.", color: BLACK }),
      ],
      spacing: { after: 40 },
      indent: { left: convertInchesToTwip(0.15) },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "  ■  Red text", color: RED, bold: true }),
        new TextRun({ text: "  =  Feature appears in SRS but is ", color: BLACK }),
        new TextRun({ text: "NOT yet implemented", bold: true, color: RED }),
        new TextRun({ text: " in the current system.", color: BLACK }),
      ],
      spacing: { after: 40 },
      indent: { left: convertInchesToTwip(0.15) },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "  ■  Yellow highlight", highlight: YELLOW_HIGHLIGHT, bold: true }),
        new TextRun({ text: "  =  Feature IS implemented but was ", color: BLACK }),
        new TextRun({ text: "NOT mentioned", bold: true, color: BLACK }),
        new TextRun({ text: " in the original SRS v1.0.", color: BLACK }),
      ],
      spacing: { after: 160 },
      indent: { left: convertInchesToTwip(0.15) },
    }),
  ];
}

// ────────────────────────────────────────────────────────────────
// COVER PAGE
// ────────────────────────────────────────────────────────────────
function coverPage(): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun("")], spacing: { after: 1200 } }),
    new Paragraph({
      children: [new TextRun({ text: "🥩 NUMA FRESH MARKETPLACE", bold: true, size: 52, color: DARK_GREEN })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Software Requirements Specification", bold: true, size: 36, color: MEDIUM_GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Version 2.0 · April 2026 · Final", size: 28, color: MEDIUM_GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Halal Grocery Marketplace — Full Production Platform", size: 24, italics: true, color: MEDIUM_GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    simpleTable(
      ["Document Type", "Version", "Status", "Classification", "Date"],
      [["Software Requirements Specification", "2.0", "Final", "Confidential", "April 2026"]]
    ),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 600 } }),
    new Paragraph({
      children: [new TextRun({ text: "Confidential — Numa Fresh Marketplace — April 2026", color: MEDIUM_GRAY, italics: true, size: 18 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// TABLE OF CONTENTS
// ────────────────────────────────────────────────────────────────
function tocSection(): Paragraph[] {
  const sections = [
    "1. Product Overview",
    "2. User Roles & Access Control",
    "3. Customer Marketplace",
    "4. Store Fulfillment Portal",
    "5. Admin Panel",
    "6. Real-Time System & Chat",
    "7. Order Lifecycle & Special Flows",
    "8. AI Halal Meal Planner",
    "9. Payment System & Subscriptions",
    "10. Notification System",
    "11. Eid Specials & Qurbani System",
    "12. SEO, Multilingual & Accessibility",
    "13. Revenue Model",
    "14. Security & Compliance",
    "15. Future Roadmap",
    "16. Technical Architecture",
  ];
  return [
    h1("TABLE OF CONTENTS"),
    ...sections.map(s =>
      new Paragraph({
        children: [new TextRun({ text: s, color: DARK_GREEN })],
        spacing: { after: 80 },
        indent: { left: convertInchesToTwip(0.3) },
      })
    ),
    pb(),
    ...colorKeyBox(),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 1 — Product Overview
// ────────────────────────────────────────────────────────────────
function section1(): Paragraph[] {
  return [
    h1("1. PRODUCT OVERVIEW"),
    para([
      normal("Numa Fresh Marketplace is a multi-portal, production-grade halal grocery marketplace. It connects customers with local halal stores for online ordering and express pickup. The platform operates on a store-fulfilled model — stores handle all picking, packing, and fulfillment. Fresh halal meat cut on demand is the platform's primary differentiator."),
    ]),
    h2("1.1 What Makes Numa Fresh Different"),
    bullet([bold("Store-Fulfilled: "), normal("No platform shoppers or drivers — stores own the full fulfillment process")]),
    bullet([bold("Pickup-First: "), normal("Express pickup (under 60 seconds) and curbside are the primary order types")]),
    bullet([bold("Custom Halal Meat: "), normal("Cut on demand, weight-adjusted, charged by final actual weight")]),
    bullet([bold("Halal Certified Only: "), normal("Every store must hold a valid halal certificate, verified by admin")]),
    bullet([bold("Muslim Community Focus: "), normal("Eid/Qurbani system, Masjid partnerships, Urdu + Arabic language support")]),
    bullet([bold("Full Transparency: "), normal("Every fee shown explicitly at checkout — no hidden charges")]),
    empty(),
    h2("1.2 Platform Portals"),
    simpleTable(
      ["Portal", "URL", "Users"],
      [
        ["Customer Marketplace", "/", "End customers browsing and ordering"],
        ["Store Fulfillment Portal", "/store-portal", "Store owners and store staff"],
        ["Admin Panel", "/admin", "Platform administrators"],
        ["Store Application", "/store-portal/apply", "New stores applying to join the platform"],
      ]
    ),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 2 — User Roles & Access Control
// ────────────────────────────────────────────────────────────────
function section2(): Paragraph[] {
  return [
    h1("2. USER ROLES & ACCESS CONTROL"),
    para([normal("The system uses role-based access control (RBAC). Every user is assigned one role, and all pages and API endpoints enforce that role. Admin actions are permanently logged.")]),
    simpleTable(
      ["Role", "Portal Access", "Key Capabilities"],
      [
        ["CUSTOMER", "/ (Customer App)", "Browse stores, place orders, track orders, chat with store, manage account"],
        ["STORE_OWNER", "/store-portal", "Manage store profile, products, orders, staff, analytics, payouts"],
        ["STORE_STAFF", "/store-portal (limited)", "View and process orders, update item status, chat with customers"],
        ["ADMIN", "/admin", "Approve stores and products, manage users, finance, platform settings"],
      ]
    ),
    empty(),
    h2("2.1 Store Approval Flow"),
    bullet([normal("Owner registers, navigates to /store-portal/apply and submits store application")]),
    bullet([normal("Store created with status: Pending — not visible to customers yet")]),
    bullet([normal("Admin reviews: business info, halal certificate document, operating hours")]),
    bullet([normal("Admin APPROVES → store goes live on marketplace, owner receives email confirmation")]),
    bullet([normal("Admin REJECTS → reason stored, rejection email with reason sent to owner")]),
    bullet([
      red("Admin can also add a store directly from /admin/stores, bypassing the application queue"),
      red(" — NOT IMPLEMENTED"),
    ]),
    bullet([yellow("Stripe Connect role update on store approval — owner role automatically updated to STORE_OWNER when store approved — implemented")]),
    empty(),
    h2("2.2 Product Approval Flow"),
    bullet([normal("Store owner adds a product via /store-portal/products — product created with status: Pending")]),
    bullet([normal("Product is NOT visible to customers while pending")]),
    bullet([normal("Admin reviews from /admin/products/pending queue — image, name, price, halal status")]),
    bullet([normal("APPROVED → product goes live on marketplace")]),
    bullet([normal("REJECTED → store owner notified with specific reason, can edit and resubmit")]),
    bullet([
      red("If price or images are significantly updated after approval, re-approval is automatically triggered"),
      red(" — NOT IMPLEMENTED"),
    ]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 3 — Customer Marketplace
// ────────────────────────────────────────────────────────────────
function section3(): Paragraph[] {
  return [
    h1("3. CUSTOMER MARKETPLACE"),

    // 3.1 Homepage
    h2("3.1 Homepage"),
    bullet([normal("Hero section with address/store search bar powered by Google Maps autocomplete")]),
    bullet([normal("Category quick-links: Fresh Halal Meat, Ethnic Spices, Dairy & Eggs, Frozen Foods, Bakery & Bread, Fresh Produce, Desi Pantry, Beverages")]),
    bullet([normal("Featured stores near the customer's location — shown as interactive cards")]),
    bullet([normal("'Fresh Meat Cut For You' promotional section explaining the custom meat process")]),
    bullet([normal("How It Works section: 3 visual steps (Choose Store → Add to Cart → Pickup in 60s)")]),
    bullet([yellow("Animated count-up statistics: total stores, products, and orders fulfilled — implemented")]),
    bullet([yellow("/halal-meat dedicated landing page — implemented")]),
    bullet([yellow("/eid-specials dedicated landing page — implemented")]),
    bullet([yellow("Bottom navigation bar for mobile — implemented")]),
    bullet([red("Seasonal Eid/Qurbani banner — automatically displayed 30 days before Eid ul Adha — NOT IMPLEMENTED")]),
    bullet([red("Language switcher in footer: English / Urdu / Arabic — NOT IMPLEMENTED")]),
    empty(),

    // 3.2 Store Discovery
    h2("3.2 Store Discovery (/stores)"),
    bullet([normal("Only approved and active stores are shown to customers")]),
    bullet([normal("Filters: Open Now, Pickup Available, Curbside Available, Delivery Available, Halal Certified (default ON), Minimum Rating")]),
    bullet([normal("Sort options: Nearest / Top Rated / Fastest Pickup / Lowest Fee")]),
    bullet([normal("Each store card shows: logo, name, rating, Halal Certified badge (gold), estimated pickup time, convenience fee, minimum order amount")]),
    bullet([red("City-based URLs for SEO: /stores/toronto, /stores/mississauga, etc. — NOT IMPLEMENTED")]),
    bullet([red("Masjid Affiliated badge on store cards — NOT IMPLEMENTED")]),
    bullet([red("Maximum Fee filter — NOT IMPLEMENTED")]),
    empty(),

    // 3.3 Store Detail Page
    h2("3.3 Store Detail Page (/stores/[store-slug])"),
    bullet([normal("Store banner, logo, name, rating, operating hours, and service type badges")]),
    bullet([normal("Sticky horizontal category navigation — clicking smooth-scrolls to that product section")]),
    bullet([normal("Product grid: 2 columns on mobile, 3 on tablet, 4 on desktop")]),
    bullet([normal("Tabs: Products, Reviews, Store Info, Operating Hours")]),
    bullet([yellow("In-store search with instant filtering — implemented")]),
    bullet([red("Product name shown in both English and Urdu on product cards — NOT IMPLEMENTED")]),
    bullet([red("Freshness label on product cards (e.g., 'Cut this morning') — NOT IMPLEMENTED")]),
    bullet([red("Low stock indicator on product cards — NOT IMPLEMENTED")]),
    bullet([red("Halal certification number + issuing body displayed on store detail page — NOT IMPLEMENTED")]),
    empty(),

    // 3.4 Fresh Meat Modal
    h2("3.4 Fresh Meat Product — Custom Order Modal"),
    note("Fresh meat is priced by final actual weight. The amount shown is an estimate. The card is pre-authorized — final charge applied after cutting and weighing."),
    bullet([normal("Step 1 — Cut Type: Visual selection cards — Whole / Half / Quarter / Boneless / Bone-In / Cubed / Ground / Custom")]),
    bullet([normal("Step 2 — Quantity: Weight selector (0.5 kg, 1 kg, 1.5 kg, 2 kg, or custom), estimated price auto-calculated and displayed")]),
    bullet([normal("Step 3 — Instructions: Marination preference, packaging preference, free-text special instructions")]),
    empty(),

    // 3.5 Substitution Preferences
    h2("3.5 Substitution Preferences (Packaged Items Only)"),
    para([normal("At checkout Step 2, for every packaged item in the cart, the customer must select one of four options:")]),
    simpleTable(
      ["Option", "Behaviour"],
      [
        ["No Replacement", "If unavailable, remove the item. Partial refund issued automatically."],
        ["Replace with Similar", "Store staff picks the best alternative from the same category."],
        ["Choose Specific", "Customer selects a specific alternate product from a dropdown list."],
        ["Contact Me First", "Store must message the customer via chat before making any change."],
      ]
    ),
    para([normal("Fresh meat items are never subject to substitution — they are cut to order.")]),
    empty(),

    // 3.6 Checkout
    h2("3.6 Checkout (4 Steps)"),
    h3("Step 1 — Order Type Selection"),
    bullet([normal("Express Pickup: Customer selects a pickup time slot from the store's availability calendar")]),
    bullet([normal("Curbside Pickup: Customer enters vehicle make/model/colour/plate number, selects pickup slot, sees curbside fee")]),
    bullet([normal("Store Delivery: Customer selects a saved address or adds a new one, delivery fee and estimated time shown")]),
    h3("Step 2 — Substitution Preferences"),
    bullet([normal("Per packaged item — customer selects preference (see 3.5)")]),
    h3("Step 3 — Review & Payment"),
    para([normal("Full transparent fee breakdown shown before payment:")]),
    simpleTable(
      ["Fee Item", "Description"],
      [
        ["Subtotal", "Sum of all item prices"],
        ["Convenience Fee", "Platform fee — shown explicitly, no hiding"],
        ["Curbside Fee", "Only if curbside order type selected"],
        ["Delivery Fee", "Only if store delivery selected"],
        ["Promo Discount", "Applied if valid promo code entered"],
        ["Loyalty Discount", "Applied if customer chooses to redeem points"],
        ["Tip (optional)", "Customer selects tip for store staff — None / $1 / $2 / $3 / Custom"],
        ["Estimated Total", "Sum of all above — clearly labeled as 'Estimated' for meat orders"],
      ]
    ),
    h3("Step 4 — Confirmation"),
    bullet([normal("Order number, QR code, store address, pickup time, and Track Order button")]),
    bullet([red("Animated success screen explicitly described in SRS — NOT IMPLEMENTED (static confirmation page used)")]),
    empty(),

    // 3.7 Order Tracking
    h2("3.7 Order Tracking (/account/orders/:id/track)"),
    bullet([normal("Live animated status progress bar: Order Placed → Confirmed → In Preparation → Ready → Completed")]),
    bullet([normal("Large QR code displayed on screen for express pickup scan at store counter")]),
    bullet([normal("'I'm Here' button: appears when order is Ready and order type is Curbside — one tap sends vehicle info to store")]),
    bullet([normal("Live in-app chat with store during order preparation")]),
    bullet([yellow("Socket.IO-based real-time status push — page updates automatically without manual reload — implemented")]),
    bullet([red("Substitution approval popup with 5-minute auto-accept timer — NOT IMPLEMENTED")]),
    bullet([red("Items summary accordion with real-time per-item status (Found / Out of Stock / Substituted) — NOT IMPLEMENTED")]),
    empty(),

    // 3.8 Customer Account
    h2("3.8 Customer Account"),
    simpleTable(
      ["Route", "Description", "Status"],
      [
        ["/account", "Dashboard: active orders, loyalty points balance, quick stats", "Implemented"],
        ["/account/orders", "Full order history with one-click Reorder button per past order", "Implemented"],
        [nCell("/account/addresses"), nCell("Saved addresses with Google Maps autocomplete for adding new ones"), yCell("Implemented")],
        [nCell("/account/loyalty"), nCell("Loyalty points balance, tier level, full transaction history"), yCell("Implemented")],
        [nCell("/account/meal-planner"), nCell("AI Halal Meal Planner (see Section 8)"), nCell("Implemented")],
        [nCell("/account/notifications"), nCell("Notification preferences page"), yCell("Implemented (language selection not yet implemented)")],
        [rCell("/account/membership"), rCell("Subscription plan management — upgrade, downgrade, cancel"), rCell("NOT IMPLEMENTED")],
        [rCell("/account/scheduled-orders"), rCell("Recurring orders — weekly staples automatically reordered"), rCell("NOT IMPLEMENTED")],
        [rCell("/account/chat"), rCell("Standalone chat inbox for all conversations with stores and support"), rCell("NOT IMPLEMENTED")],
      ]
    ),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 4 — Store Fulfillment Portal
// ────────────────────────────────────────────────────────────────
function section4(): Paragraph[] {
  return [
    h1("4. STORE FULFILLMENT PORTAL"),
    para([normal("The store portal is designed for use on Android tablets in-store (primary) and desktop browsers. All elements use large touch targets and simplified navigation.")]),

    // 4.1
    h2("4.1 Store Application (/store-portal/apply)"),
    note("The 6-step application wizard described in the SRS is NOT fully implemented as a wizard. A /store-portal/onboarding settings page exists for store setup."),
    simpleTable(
      ["Step", "Description"],
      [
        ["Step 1 — Basic Info", "Store name (English + optional Urdu), phone, email, full address with map pin, logo and banner image upload"],
        ["Step 2 — Halal Cert", "Certificate number, issuing body name, expiry date, certificate document upload (PDF or image)"],
        ["Step 3 — Hours", "Per day open/closed toggle, opening and closing times, pickup slot duration, max orders per slot"],
        ["Step 4 — Services", "Enable Pickup, Curbside (+ fee), Store Delivery (+ fee + radius), minimum order amount"],
        ["Step 5 — Banking", "Stripe Connect onboarding to receive payouts — owner completes on Stripe's secure page"],
        ["Step 6 — Submit", "Full summary review, submit button. Status shows 'Pending Admin Review'. Admin notified instantly."],
      ]
    ),
    bullet([red("Full 6-step wizard (/store-portal/apply) with session-persistent progress, halal certificate upload, Stripe Connect onboarding step, and Submit with admin notification — NOT IMPLEMENTED as a wizard")]),
    bullet([yellow("/store-portal/onboarding exists as a settings/onboarding page for store setup — implemented")]),
    empty(),

    // 4.2
    h2("4.2 Live Order Dashboard (/store-portal)"),
    bullet([normal("Incoming order queue updates in real time — new orders appear with slide-in animation")]),
    bullet([normal("Each order card shows: order number, order type badge, pickup slot time, customer name, item list preview, estimated total")]),
    bullet([normal("One-tap Accept or Reject")]),
    bullet([normal("Today's summary: Pending / In Preparation / Ready / Completed count, Total Revenue, Average Prep Time")]),
    bullet([red("Online/Offline toggle — prominently displayed at top of screen — NOT IMPLEMENTED")]),
    bullet([red("Audio alert for new incoming orders — NOT IMPLEMENTED")]),
    bullet([red("Reject requiring a reason to be selected — NOT IMPLEMENTED (reject exists but no reason selection)")]),
    bullet([red("Countdown timers on active orders — NOT IMPLEMENTED")]),
    empty(),

    // 4.3
    h2("4.3 Order Processing Screen (/store-portal/orders/:id)"),
    bullet([normal("Full-screen, tablet-optimized view with large touch targets throughout")]),
    bullet([normal("Item checklist: each item is a large card — staff taps FOUND, OUT OF STOCK, or SUBSTITUTE")]),
    bullet([normal("For fresh meat items: staff sees animal type, cut type, and customer instructions; after cutting, staff enters actual weight — system recalculates final charge")]),
    bullet([normal("Curbside mode: when customer taps 'I'm Here', vehicle details (Make / Model / Colour / Plate) appear in large text on the tablet screen")]),
    bullet([yellow("Item status updates sent live to customer via Socket.IO — implemented")]),
    bullet([red("Final Summary button sent to customer before marking Ready — NOT IMPLEMENTED")]),
    bullet([red("Push notification + SMS simultaneously when order marked Ready — NOT IMPLEMENTED (push notification only)")]),
    bullet([red("Print Slip feature (main order slip + separate meat counter slip) — NOT IMPLEMENTED")]),
    empty(),

    // 4.4
    h2("4.4 Product Management (/store-portal/products)"),
    bullet([normal("Status badges per product: Pending Approval (amber) / Approved — Live (green) / Rejected (red with reason shown)")]),
    bullet([normal("Standard product fields: name (English + optional Urdu), type, category, subcategory, price, compare price, unit, stock quantity")]),
    bullet([yellow("Barcode/SKU field — implemented")]),
    bullet([yellow("Up to 5 images per product — implemented")]),
    bullet([normal("Fresh Meat extra fields: animal type (Chicken / Beef / Lamb / Goat / Veal), available cut types (multi-select), price per kg, estimated weight range")]),
    bullet([normal("Halal Certified toggle per product — defaults to ON")]),
    bullet([red("Freshness label field per product (free text, e.g., 'Cut this morning') — NOT IMPLEMENTED")]),
    bullet([red("Nutrition facts accordion (calories, protein, carbs, fat, sodium) — NOT IMPLEMENTED")]),
    bullet([red("Bulk import via CSV (template download, upload, preview, error report) — NOT IMPLEMENTED")]),
    bullet([red("Quick inline stock edit (tap number to update directly) — NOT IMPLEMENTED")]),
    bullet([red("Inventory buffer preventing orders beyond available stock quantity — NOT IMPLEMENTED")]),
    empty(),

    // 4.5
    h2("4.5 Analytics (/store-portal/analytics)"),
    bullet([normal("Date range picker: Today / This Week / This Month / Custom range")]),
    bullet([normal("Revenue over time — line chart")]),
    bullet([normal("Order volume — bar chart")]),
    bullet([normal("Order type breakdown — pie chart (Express / Curbside / Delivery)")]),
    bullet([red("Peak hours heatmap (7 days × 24 hours, colour intensity shows busiest times) — NOT IMPLEMENTED")]),
    bullet([red("Top 10 best-selling products — horizontal bar chart — NOT IMPLEMENTED")]),
    bullet([red("Average preparation time trend over selected period — NOT IMPLEMENTED")]),
    bullet([red("Export: download data as CSV or PDF report — NOT IMPLEMENTED")]),
    empty(),

    // 4.6
    h2("4.6 Payouts (/store-portal/payouts)"),
    bullet([normal("Shows: Gross Revenue, Platform Commission (7% shown explicitly), Net Payout Amount")]),
    bullet([normal("Full payout history with dates and amounts")]),
    bullet([yellow("Stripe Connect payout integration — implemented")]),
    bullet([red("Bi-weekly payout schedule option — NOT IMPLEMENTED (weekly only)")]),
    bullet([red("Chat with admin directly from payouts screen — NOT IMPLEMENTED")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 5 — Admin Panel
// ────────────────────────────────────────────────────────────────
function section5(): Paragraph[] {
  return [
    h1("5. ADMIN PANEL"),

    // 5.1
    h2("5.1 Admin Dashboard (/admin)"),
    bullet([normal("KPI cards: Total GMV, Platform Revenue, Total Orders Today, Active Stores, Pending Approvals")]),
    bullet([normal("Live activity feed: new orders, store approvals pending, refund requests — colour-coded and updating in real time")]),
    bullet([normal("Charts: GMV trend (30-day area chart), Orders per day (bar chart)")]),
    bullet([red("Open Support Tickets KPI card — NOT IMPLEMENTED on dashboard")]),
    bullet([red("Pending action panel: store applications, product approvals, refund requests — all one-click actionable — NOT IMPLEMENTED")]),
    bullet([red("Revenue by source stacked chart (commission vs fees) — NOT IMPLEMENTED")]),
    empty(),

    // 5.2
    h2("5.2 Store Management (/admin/stores)"),
    bullet([normal("Tabs: Pending Applications / Active Stores / Suspended / All Stores")]),
    bullet([normal("Pending application view: full store details, expandable info")]),
    bullet([normal("[APPROVE] → store goes live, owner's role updated, confirmation email sent automatically")]),
    bullet([normal("[REJECT] → reason required, rejection email with reason sent to applicant")]),
    bullet([yellow("Commission rate adjustment per store — implemented")]),
    bullet([yellow("Suspend/Unsuspend stores — implemented")]),
    bullet([red("Halal certificate document viewer (in-browser PDF and image) — NOT IMPLEMENTED")]),
    bullet([red("Direct chat with applicant from store review screen — NOT IMPLEMENTED")]),
    bullet([red("[Add Store Directly] → admin fills full store form, store created as Approved immediately — NOT IMPLEMENTED")]),
    bullet([red("Trigger manual payout per store from this screen — NOT IMPLEMENTED")]),
    empty(),

    // 5.3
    h2("5.3 Product Approvals (/admin/products/pending)"),
    bullet([red("Dedicated /admin/products/pending approval queue — NOT IMPLEMENTED — this entire screen does not exist")]),
    bullet([red("Queue showing all pending products across all stores — NOT IMPLEMENTED")]),
    bullet([red("[APPROVE] and [REJECT + Reason] actions on pending product queue — NOT IMPLEMENTED")]),
    empty(),

    // 5.4
    h2("5.4 Order Management (/admin/orders)"),
    bullet([normal("Full order list with filters: Status, Store, Date Range, Order Type, Amount Range")]),
    bullet([normal("Order detail view: all items (including meat specs and actual weights), full status timeline, fee breakdown, payment info")]),
    bullet([normal("Admin interventions: Issue full refund, Issue partial refund, Cancel order (if eligible), Force-complete order")]),
    bullet([red("Refund queue: pending refund requests with customer reason — admin approves, partially approves, or rejects with reason — NOT IMPLEMENTED")]),
    empty(),

    // 5.5
    h2("5.5 User Management (/admin/users)"),
    bullet([normal("Filter by role: All / Customers / Store Owners / Staff / Admins")]),
    bullet([normal("Per user: view full profile and order history, suspend with reason and duration, permanently ban, verify manually, change role")]),
    empty(),

    // 5.6
    h2("5.6 Finance (/admin/finance)"),
    bullet([normal("Revenue breakdown: Total GMV, commission collected (7%), convenience fees, net platform revenue — per period")]),
    bullet([normal("Store payouts table: store name, period, gross amount, commission deducted, net payout, current status")]),
    bullet([red("[Trigger Payout] → initiates bank transfer to store's connected account — NOT IMPLEMENTED")]),
    bullet([red("Monthly P&L summary — exportable as CSV — NOT IMPLEMENTED")]),
    empty(),

    // 5.7
    h2("5.7 Platform Settings (/admin/settings)"),
    simpleTable(
      ["Setting", "Description", "Status"],
      [
        ["Commission Rate", "Default 7% — overridable per individual store", "Implemented"],
        ["Convenience Fee", "Default platform-wide amount, shown to customers at checkout", "Implemented"],
        ["Curbside Fee", "Optional — can be set to $0", "Implemented"],
        ["Loyalty Points Rate", "Points earned per $1 spent (default: 1 point per $1)", "Implemented"],
        ["Payout Schedule", "Weekly or bi-weekly payout frequency", "Implemented"],
        [rCell("Subscription Pricing"), rCell("Monthly prices for Basic, Premium, and Family plans"), rCell("NOT IMPLEMENTED")],
        [rCell("Supported Cities"), rCell("Add or remove cities where the platform operates"), rCell("NOT IMPLEMENTED")],
        [rCell("Email Templates"), rCell("Edit content and layout of all transactional emails"), rCell("NOT IMPLEMENTED")],
        [rCell("Maintenance Mode"), rCell("Platform-wide toggle — shows maintenance page to all users"), rCell("NOT IMPLEMENTED")],
      ]
    ),
    empty(),

    // 5.8
    h2("5.8 Chat, Support & Audit"),
    bullet([red("Admin Chat (/admin/chat) — view and join any order chat room, message any customer or store owner — NOT IMPLEMENTED")]),
    bullet([red("Support Tickets (/admin/support) — ticket queue with Open / In Progress / Resolved tabs — NOT IMPLEMENTED (route exists but is a placeholder)")]),
    bullet([yellow("Audit Log (/admin/audit) — every admin action permanently logged with: admin name, action, target, old value, new value, IP address, timestamp — implemented")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 6 — Real-Time System & Chat
// ────────────────────────────────────────────────────────────────
function section6(): Paragraph[] {
  return [
    h1("6. REAL-TIME SYSTEM & CHAT"),
    para([normal("The platform uses Socket.IO WebSocket connections for all real-time features. All chat messages are permanently stored in the database. The chat system connects all three roles — customer, store, and admin — in shared order-linked rooms.")]),

    h2("6.1 Chat System"),
    bullet([normal("Chat rooms are linked to orders — all conversation about an order stays in one room")]),
    bullet([normal("All three roles (Customer, Store Staff, Admin) can participate in the same order room")]),
    bullet([red("Admin can view and join any chat room for moderation or support — NOT IMPLEMENTED")]),
    bullet([red("Typing indicator (live animated dots) — NOT IMPLEMENTED")]),
    bullet([red("Read receipts — NOT IMPLEMENTED")]),
    bullet([red("Image sharing in chat — NOT IMPLEMENTED")]),
    bullet([red("Quick reply templates — NOT IMPLEMENTED")]),
    bullet([red("Standalone chat inbox at /account/chat (customer) and /store-portal/chat (store) — NOT IMPLEMENTED")]),
    empty(),

    h2("6.2 Real-Time Order Events"),
    simpleTable(
      ["Event", "Trigger", "Channel", "Status"],
      [
        ["New Order", "Customer places order", "Socket.IO /store namespace → store room", "Implemented"],
        ["Order Status Update", "Store changes order status", "Socket.IO /customer namespace → order room", "Implemented"],
        ["I'm Here (Curbside)", "Customer taps 'I'm Here'", "Socket.IO /store namespace → order room", "Implemented"],
        ["Order Cancelled", "Store or admin cancels order", "Socket.IO /customer namespace → order room", "Implemented"],
        ["Substitution Request", "Store requests substitution approval", "Socket.IO /customer namespace → order room", "Implemented"],
        [rCell("SMS Delivery Channel"), rCell("Any order event notification via SMS"), rCell("Twilio SMS or similar"), rCell("NOT IMPLEMENTED")],
        [rCell("Push + SMS Simultaneously (Order Ready)"), rCell("Order marked Ready — both push and SMS at same time"), rCell("Push notification + SMS channel"), rCell("NOT IMPLEMENTED")],
      ]
    ),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 7 — Order Lifecycle & Special Flows
// ────────────────────────────────────────────────────────────────
function section7(): Paragraph[] {
  return [
    h1("7. ORDER LIFECYCLE & SPECIAL FLOWS"),

    h2("7.1 Order Status Flow"),
    simpleTable(
      ["Status", "Triggered By", "Next Statuses"],
      [
        ["PENDING", "Customer submits order", "CONFIRMED, CANCELLED"],
        ["CONFIRMED", "Store accepts order", "IN_PREPARATION"],
        ["IN_PREPARATION", "Store starts picking items", "READY_FOR_PICKUP"],
        ["READY_FOR_PICKUP", "Store marks order ready", "COMPLETED, CANCELLED"],
        ["COMPLETED", "Customer picks up or curbside delivered", "—"],
        ["CANCELLED", "Store, customer, or admin cancels", "—"],
      ]
    ),
    empty(),

    h2("7.2 Fresh Meat Payment Flow"),
    bullet([normal("Customer adds fresh meat item → estimated price calculated and shown")]),
    bullet([normal("Card pre-authorized for estimated amount at checkout")]),
    bullet([normal("Store staff cuts meat to order, enters actual weight on tablet")]),
    bullet([normal("System recalculates final charge based on actual weight")]),
    bullet([normal("Final charge captured (higher or lower than estimate)")]),
    bullet([red("Customer notification when final weight exceeds estimate by more than 10% — NOT IMPLEMENTED")]),
    empty(),

    h2("7.3 Recurring Orders"),
    bullet([red("Entire recurring orders feature (/account/scheduled-orders) — weekly staples automatically reordered — NOT IMPLEMENTED")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 8 — AI Halal Meal Planner
// ────────────────────────────────────────────────────────────────
function section8(): Paragraph[] {
  return [
    h1("8. AI HALAL MEAL PLANNER"),
    para([normal("The AI Halal Meal Planner is accessible at /account/meal-planner. It uses OpenAI to generate personalized halal meal plans and converts them to grocery lists that can be ordered directly from the platform.")]),

    h2("8.1 Core 4-Step Workflow"),
    bullet([normal("Step 1 — Preferences: Dietary needs, cuisine type, number of people, duration")]),
    bullet([normal("Step 2 — Generated Plan: AI-generated halal meal plan displayed for review")]),
    bullet([normal("Step 3 — Grocery List: Ingredients extracted from meal plan, ready for ordering")]),
    bullet([normal("Step 4 — Select Store & Order: Customer selects a store and adds all items to cart")]),
    bullet([yellow("Support for 1-day, 3-day, 7-day, and 30-day plan generation — implemented")]),
    bullet([yellow("Cuisine types include Pakistani, Middle Eastern, African, and Mixed Halal — implemented")]),
    bullet([yellow("One-click Add All to Cart — implemented")]),
    empty(),

    h2("8.2 Unimplemented Meal Planner Features"),
    bullet([red("Save named meal plans — NOT IMPLEMENTED")]),
    bullet([red("Auto-order toggle for recurring from meal plan — NOT IMPLEMENTED")]),
    bullet([red("Partial cart when items unavailable from selected store — NOT IMPLEMENTED")]),
    bullet([red("Seasonal Eid suggestions in meal planner — NOT IMPLEMENTED")]),
    bullet([red("Nutritional overview (weekly calories and macros) — NOT IMPLEMENTED")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 9 — Payment System & Subscriptions
// ────────────────────────────────────────────────────────────────
function section9(): Paragraph[] {
  return [
    h1("9. PAYMENT SYSTEM & SUBSCRIPTIONS"),

    h2("9.1 Customer Payments"),
    bullet([normal("Stripe payment processing for all orders")]),
    bullet([normal("Pre-authorization for fresh meat orders — card pre-authorized at estimate, captured at final weight")]),
    bullet([normal("Partial refunds for out-of-stock items removed from orders")]),
    bullet([normal("Full refunds for cancelled orders")]),
    empty(),

    h2("9.2 Store Payouts (Stripe Connect)"),
    bullet([normal("Stripe Connect integration — stores complete onboarding to receive payouts")]),
    bullet([normal("7% platform commission deducted from gross revenue")]),
    bullet([normal("Weekly payout schedule via Stripe Connect")]),
    bullet([red("Bi-weekly payout option — NOT IMPLEMENTED (weekly only)")]),
    bullet([red("Admin manual payout trigger — NOT IMPLEMENTED")]),
    empty(),

    h2("9.3 Subscription Plans"),
    note("The entire subscription plan system is NOT implemented. No /account/membership management or Stripe Subscriptions billing exists."),
    simpleTable(
      ["Plan", "Price", "Benefits", "Status"],
      [
        ["Free", "$0/month", "Standard platform access", "N/A"],
        [rCell("Basic"), rCell("$4.99/month"), rCell("Reduced convenience fee, priority support"), rCell("NOT IMPLEMENTED")],
        [rCell("Premium"), rCell("$9.99/month"), rCell("Free convenience fee, premium features"), rCell("NOT IMPLEMENTED")],
        [rCell("Family"), rCell("$14.99/month"), rCell("Premium + family sharing, extra accounts"), rCell("NOT IMPLEMENTED")],
      ]
    ),
    empty(),

    h2("9.4 Loyalty Points"),
    bullet([normal("1 loyalty point earned per $1 spent")]),
    bullet([normal("100 points = $1 redemption value")]),
    bullet([yellow("Loyalty tiers: Bronze / Silver / Gold / Platinum — implemented")]),
    bullet([yellow("Loyalty transaction history — implemented (/account/loyalty)")]),
    bullet([red("Bonus points for referrals, first order, and Eid special orders — NOT IMPLEMENTED")]),
    bullet([red("Points expiry after 12 months inactivity with 7-day warning notification — NOT IMPLEMENTED")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 10 — Notification System
// ────────────────────────────────────────────────────────────────
function section10(): Paragraph[] {
  return [
    h1("10. NOTIFICATION SYSTEM"),
    para([normal("The platform supports in-app notifications. Email and SMS channels are planned per the SRS but not yet implemented.")]),
    simpleTable(
      ["Event", "In-App", "Email", "SMS"],
      [
        ["Order Placed", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
        ["Order Confirmed by Store", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
        ["Order Ready for Pickup", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
        ["Order Completed", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
        ["Order Cancelled", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
        ["Store Application Approved", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
        ["Store Application Rejected", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
        ["Substitution Request", "Implemented", "—", "—"],
        ["Refund Issued", "Implemented", rCell("NOT IMPLEMENTED"), rCell("NOT IMPLEMENTED")],
      ]
    ),
    empty(),
    bullet([yellow("In-app notification preferences page (/account/notifications) — implemented")]),
    bullet([red("Email notifications — ALL transactional emails — NOT IMPLEMENTED")]),
    bullet([red("SMS notifications — all event types — NOT IMPLEMENTED")]),
    bullet([red("Notifications in Urdu — NOT IMPLEMENTED")]),
    bullet([red("Unsubscribe link in all emails — NOT IMPLEMENTED")]),
    bullet([red("Bilingual notification delivery (English + Urdu/Arabic) — NOT IMPLEMENTED")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 11 — Eid Specials & Qurbani System
// ────────────────────────────────────────────────────────────────
function section11(): Paragraph[] {
  return [
    h1("11. EID SPECIALS & QURBANI SYSTEM"),

    h2("11.1 Eid Specials Page (/eid-specials)"),
    bullet([yellow("Eid Specials page exists as a landing page with seasonal products — implemented")]),
    bullet([red("Advance Qurbani pre-orders (whole/half/quarter animal with cut style) — NOT IMPLEMENTED")]),
    bullet([red("Family niyyah dedication on order — NOT IMPLEMENTED")]),
    bullet([red("Eid pickup date selection — NOT IMPLEMENTED")]),
    bullet([red("Arabic calligraphy header on Eid pages — NOT IMPLEMENTED")]),
    bullet([red("Countdown timer to Eid date — NOT IMPLEMENTED")]),
    bullet([red("Eid grocery bundles from stores — NOT IMPLEMENTED")]),
    empty(),

    h2("11.2 Masjid Partnerships"),
    bullet([red("Stores marked as Masjid Affiliated with special badge on store cards — NOT IMPLEMENTED")]),
    bullet([red("Masjid name shown on store detail page — NOT IMPLEMENTED")]),
    bullet([red("Jumma Day Specials (Friday promotions) — NOT IMPLEMENTED")]),
    bullet([red("Community Group Order feature for Masjid groups — NOT IMPLEMENTED")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 12 — SEO, Multilingual & Accessibility
// ────────────────────────────────────────────────────────────────
function section12(): Paragraph[] {
  return [
    h1("12. SEO, MULTILINGUAL & ACCESSIBILITY"),

    h2("12.1 SEO"),
    bullet([normal("sitemap.xml and robots.txt — implemented")]),
    bullet([red("City-based store URL structure (/stores/[city]/[store-slug]) — NOT IMPLEMENTED (uses /stores/[store-slug] only)")]),
    bullet([red("Structured data JSON-LD (WebSite, LocalBusiness, Product schemas) — NOT IMPLEMENTED")]),
    bullet([red("Open Graph and Twitter Card tags — NOT IMPLEMENTED")]),
    bullet([red("All images with descriptive alt text in WebP format — NOT IMPLEMENTED")]),
    empty(),

    h2("12.2 Multilingual"),
    bullet([yellow("i18next integration implemented with language switcher — implemented")]),
    bullet([red("RTL layout for Arabic/Urdu — NOT IMPLEMENTED")]),
    bullet([red("Language preference saved to user account — NOT IMPLEMENTED")]),
    bullet([red("Bilingual product names (English + Urdu) on product cards — NOT IMPLEMENTED")]),
    empty(),

    h2("12.3 Accessibility"),
    bullet([yellow("Skeleton loaders throughout the application — implemented")]),
    bullet([red("Minimum 48px touch targets throughout — NOT IMPLEMENTED (not systematically enforced)")]),
    bullet([red("Full keyboard navigation — NOT IMPLEMENTED")]),
    bullet([red("ARIA labels on all interactive elements — NOT IMPLEMENTED")]),
    bullet([red("WCAG 2.1 AA colour contrast compliance — NOT IMPLEMENTED (not audited)")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 13 — Revenue Model
// ────────────────────────────────────────────────────────────────
function section13(): Paragraph[] {
  return [
    h1("13. REVENUE MODEL"),
    simpleTable(
      ["Revenue Stream", "Description", "Rate/Amount", "Status"],
      [
        ["Platform Commission", "% of each order's subtotal taken from store payout", "7% default (per-store override)", "Implemented"],
        ["Convenience Fee", "Flat fee charged to customer per order", "Configurable in admin settings", "Implemented"],
        ["Curbside Fee", "Additional fee for curbside pickup orders", "Configurable ($0 possible)", "Implemented"],
        ["Delivery Fee", "Fee for store delivery orders", "Set by store", "Implemented"],
        [rCell("Subscription Plans"), rCell("Monthly recurring revenue from premium plan subscribers"), rCell("Basic $4.99 / Premium $9.99 / Family $14.99"), rCell("NOT IMPLEMENTED")],
        ["Advertising", "Featured store placement, banner ads", "Phase 2 roadmap", "Future Roadmap"],
      ]
    ),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 14 — Security & Compliance
// ────────────────────────────────────────────────────────────────
function section14(): Paragraph[] {
  return [
    h1("14. SECURITY & COMPLIANCE"),

    h2("14.1 Authentication & Authorization"),
    bullet([normal("JWT authentication — access tokens (15 minutes) + refresh tokens (7 days)")]),
    bullet([normal("bcrypt password hashing")]),
    bullet([normal("Role-based access control (RBAC) — all API endpoints enforce role")]),
    bullet([normal("Rate limiting: global 200 req/min, auth 10 req/min, orders 5 req/min")]),
    bullet([normal("Audit log — all admin actions permanently logged (append-only)")]),
    bullet([red("Google OAuth as alternative login option — NOT IMPLEMENTED")]),
    empty(),

    h2("14.2 Data & API Security"),
    bullet([normal("Security headers (helmet.js)")]),
    bullet([normal("Global rate limiting and per-route rate limits")]),
    bullet([normal("Input validation on all API endpoints")]),
    bullet([normal("File upload limits and type validation")]),
    bullet([normal("Stripe PCI compliance — card data never stored on platform servers")]),
    bullet([normal("Stripe webhook signature verification")]),
    empty(),

    h2("14.3 PIPEDA Compliance"),
    bullet([red("Privacy policy page — NOT IMPLEMENTED")]),
    bullet([red("Cookie consent banner — NOT IMPLEMENTED")]),
    bullet([red("Account deletion feature — NOT IMPLEMENTED")]),
    bullet([red("Personal data export — NOT IMPLEMENTED")]),
    bullet([red("PIPEDA-compliant 7-year financial data retention policy — NOT IMPLEMENTED")]),
    bullet([red("Unsubscribe links in all emails — NOT IMPLEMENTED")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 15 — Future Roadmap
// ────────────────────────────────────────────────────────────────
function section15(): Paragraph[] {
  return [
    h1("15. FUTURE ROADMAP"),
    para([normal("The following features are planned for future phases and are not implementation claims. No color coding is applied to roadmap items.")]),

    h2("15.1 Phase 2 — Marketplace Expansion"),
    bullet([normal("Delivery driver module — third-party or platform-managed delivery")]),
    bullet([normal("Advertising system — featured store placement, banner ads, sponsored products")]),
    bullet([normal("Platform referral program — customer referral bonuses and tracking")]),
    bullet([normal("Multi-language admin panel (Urdu/Arabic)")]),
    bullet([normal("Store reviews and ratings improvements — verified purchase badge, photo reviews")]),
    bullet([normal("Wholesale / bulk ordering for restaurant and catering customers")]),
    bullet([normal("Real-time inventory sync with store POS systems")]),
    bullet([normal("Store mobile app (React Native) for order processing on mobile")]),
    empty(),

    h2("15.2 Phase 3 — Community & Scale"),
    bullet([normal("Masjid Community Orders — group purchasing for mosque communities")]),
    bullet([normal("Qurbani pre-order system — full advance Eid ul Adha ordering with animal selection")]),
    bullet([normal("Live video shopping — stores broadcast live meat cutting demonstrations")]),
    bullet([normal("Expansion beyond Canada — UK, USA, Australia market launch")]),
    bullet([normal("White-label offering — license Numa Fresh platform to halal markets globally")]),
    pb(),
  ];
}

// ────────────────────────────────────────────────────────────────
// SECTION 16 — Technical Architecture (Yellow — new, not in SRS v1.0)
// ────────────────────────────────────────────────────────────────
function section16(): Paragraph[] {
  return [
    h1("16. TECHNICAL ARCHITECTURE"),
    new Paragraph({
      children: [
        new TextRun({ text: "This section describes the technical stack implemented in the system. It was ", color: BLACK }),
        new TextRun({ text: "not included in the original SRS v1.0", bold: true, highlight: YELLOW_HIGHLIGHT }),
        new TextRun({ text: " and represents implemented architecture.", color: BLACK }),
      ],
      spacing: { after: 160 },
    }),

    h2("16.1 Frontend"),
    simpleTable(
      ["Technology", "Version / Detail", "Usage"],
      [
        [yCell("React"), yCell("19"), yCell("UI framework")],
        [yCell("Vite"), yCell("Latest"), yCell("Build tool and dev server")],
        [yCell("TailwindCSS"), yCell("4"), yCell("Utility-first CSS framework")],
        [yCell("TypeScript"), yCell("5.x"), yCell("Type-safe development")],
        [yCell("Wouter"), yCell("Latest"), yCell("Client-side routing")],
        [yCell("React Query (@tanstack/react-query)"), yCell("Latest"), yCell("Server state management and caching")],
        [yCell("Socket.IO Client"), yCell("Latest"), yCell("Real-time WebSocket connections")],
        [yCell("Recharts"), yCell("Latest"), yCell("Analytics charts")],
        [yCell("react-helmet-async"), yCell("Latest"), yCell("Head/meta tag management")],
      ]
    ),
    empty(),

    h2("16.2 Backend (API Server)"),
    simpleTable(
      ["Technology", "Version / Detail", "Usage"],
      [
        [yCell("Express"), yCell("5.x"), yCell("HTTP server and routing")],
        [yCell("TypeScript"), yCell("5.x"), yCell("Type-safe server development")],
        [yCell("Socket.IO"), yCell("Latest"), yCell("Real-time WebSocket server with namespaces (/customer, /store, /admin)")],
        [yCell("JWT (jsonwebtoken)"), yCell("Latest"), yCell("Access tokens (15 min) + refresh tokens (7 days) with rotation")],
        [yCell("bcrypt"), yCell("Latest"), yCell("Password hashing")],
        [yCell("Pino"), yCell("Latest"), yCell("Structured JSON logging")],
        [yCell("Stripe SDK"), yCell("Latest"), yCell("Payment processing + Stripe Connect for store payouts")],
        [yCell("OpenAI SDK"), yCell("Latest"), yCell("AI meal planner generation")],
        [yCell("Zod"), yCell("Latest"), yCell("API input validation")],
      ]
    ),
    empty(),

    h2("16.3 Database"),
    simpleTable(
      ["Technology", "Detail", "Usage"],
      [
        [yCell("PostgreSQL"), yCell("Production-grade relational DB"), yCell("Primary data store")],
        [yCell("Drizzle ORM"), yCell("TypeScript-first ORM"), yCell("Type-safe database queries and migrations")],
        [yCell("Drizzle Kit"), yCell("Migration tool"), yCell("Schema migrations")],
      ]
    ),
    empty(),

    h2("16.4 Project Structure"),
    bullet([yellow("pnpm workspace monorepo with three workspace packages:")]),
    subbullet([yellow("artifacts/halal-grocery — React + Vite frontend")]),
    subbullet([yellow("artifacts/api-server — Express 5 + TypeScript API server")]),
    subbullet([yellow("lib/db — Drizzle ORM schema and migrations shared library")]),
    empty(),

    h2("16.5 Security Implementation"),
    bullet([yellow("Rate limiting: global 200 req/min, auth endpoints 10 req/min, order endpoints 5 req/min")]),
    bullet([yellow("JWT access tokens: 15-minute expiry; refresh tokens: 7-day expiry with rotation")]),
    bullet([yellow("Helmet.js security headers on all API responses")]),
    bullet([yellow("Zod schema validation on all API request bodies and query params")]),
    bullet([yellow("Stripe webhook signature verification for all payment events")]),
  ];
}

// ────────────────────────────────────────────────────────────────
// BUILD & WRITE DOCUMENT
// ────────────────────────────────────────────────────────────────
async function main() {
  const children: Paragraph[] = [
    ...coverPage(),
    ...tocSection(),
    ...section1(),
    ...section2(),
    ...section3(),
    ...section4(),
    ...section5(),
    ...section6(),
    ...section7(),
    ...section8(),
    ...section9(),
    ...section10(),
    ...section11(),
    ...section12(),
    ...section13(),
    ...section14(),
    ...section15(),
    ...section16(),
  ];

  const doc = new Document({
    creator: "Numa Fresh Platform",
    title: "Numa Fresh Marketplace — Software Requirements Specification v2.0",
    description: "Full SRS with implementation status color coding",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1.25),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "NUMA FRESH MARKETPLACE", bold: true, color: DARK_GREEN, size: 18 }),
                  new TextRun({ text: "    |    Software Requirements Specification | v2.0", color: MEDIUM_GRAY, size: 18 }),
                ],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: DARK_GREEN } },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Confidential — Numa Fresh Marketplace — April 2026    |    Page ", color: MEDIUM_GRAY, size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: MEDIUM_GRAY, size: 18 }),
                  new TextRun({ text: " of ", color: MEDIUM_GRAY, size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MEDIUM_GRAY, size: 18 }),
                ],
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: DARK_GREEN } },
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync("Numa-Fresh-SRS-v2.docx", buffer);
  console.log("✅  Numa-Fresh-SRS-v2.docx generated successfully.");
}

main().catch(err => {
  console.error("Error generating SRS:", err);
  process.exit(1);
});
