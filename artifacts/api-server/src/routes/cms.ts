import { Router } from "express";
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";
import { getIO, emitToAdmin } from "../socket/index.js";

const router = Router();

// CMS keys we manage. Anything not in this allow-list is rejected.
const CMS_KEYS = [
  "cms.nav",
  "cms.announcements",
  "cms.heroStores",
  "cms.featuredProducts",
  "cms.eidSpecials",
  "cms.footerCertificates",
  "cms.featuredReviews",
] as const;
type CmsKey = (typeof CMS_KEYS)[number];

// Sensible defaults so the public site never breaks if a key is missing.
const DEFAULTS: Record<CmsKey, unknown> = {
  "cms.nav": {
    mealPlanner: false,
    eidSpecials: false,
    announcementsEnabled: true,
  },
  "cms.announcements": [
    {
      id: "default-1",
      text: "🎉 Al-Madina Halal — Get 15% off your first order this week!",
      code: "NUMA15",
      codeLabel: "Use code",
      linkUrl: "/stores/al-madina-halal-mississauga",
      linkLabel: "Shop Now",
      bgFrom: "#0D3327",
      bgVia: "#1B4D3E",
      bgTo: "#D4AF37",
      active: true,
    },
  ],
  // No hardcoded hero images. The homepage hero collage is controlled
  // entirely by what the admin saves in the CMS. An empty array means
  // "no hero images" — nothing else should leak in as a default.
  "cms.heroStores": [],
  "cms.featuredProducts": {
    visible: true,
    kicker: "Top Picks",
    heading: "Popular Products",
    subtitle: "Best sellers from our certified stores",
    productIds: [] as string[], // empty = use auto-featured endpoint
  },
  "cms.eidSpecials": {
    pageActive: true,
    eidDate: "2025-06-07T06:00:00",
    heroTitle: "Eid Specials & Qurbani",
    heroArabic: "عيد مبارك",
    heroSubtitle: "Pre-order your Qurbani, Eid feast packages, and special cuts. Certified halal — from our stores to your table.",
    noticeText: "Pre-Order Deadline: Qurbani pre-orders must be placed at least 7 days before Eid. Slots are limited — order now to avoid disappointment.",
    showCountdown: true,
    showPackages: true,
    showTips: true,
    showStores: true,
  },
  "cms.footerCertificates": [
    { id: "c1", iconKey: "shield", label: "ISNA", sub: "Certified", linkUrl: "", active: true },
    { id: "c2", iconKey: "award", label: "IFANCA", sub: "Approved", linkUrl: "", active: true },
    { id: "c3", iconKey: "check", label: "Halal", sub: "Standards", linkUrl: "", active: true },
  ],
  "cms.featuredReviews": [
    { id: "r1", name: "Fatima R.", city: "Houston, TX", avatar: "F", rating: 5, text: "Best halal grocery app in the US. Found my favorite cuts in minutes and the curbside pickup was seamless!", active: true },
    { id: "r2", name: "Mohammed A.", city: "Chicago, IL", avatar: "M", rating: 5, text: "Fresh lamb, perfectly cut to my specs. The store owner followed my instructions exactly. Highly recommend.", active: true },
    { id: "r3", name: "Aisha K.", city: "Dallas, TX", avatar: "A", rating: 5, text: "The loyalty rewards add up so fast. I got my last order almost free. This app has changed how I shop.", active: true },
  ],
};

// Schema-aware merge: array keys must be arrays (else use defaults);
// object keys deep-merge missing fields from defaults so partial rows don't break the UI.
const ARRAY_KEYS: Set<CmsKey> = new Set(["cms.announcements", "cms.heroStores", "cms.footerCertificates", "cms.featuredReviews"]);

function mergeWithDefaults(key: CmsKey, stored: unknown): unknown {
  const def = DEFAULTS[key];
  if (stored === null || stored === undefined) return def;

  if (ARRAY_KEYS.has(key)) {
    return Array.isArray(stored) ? stored : def;
  }
  // Object: shallow-merge missing top-level fields from defaults
  if (
    typeof stored === "object" &&
    !Array.isArray(stored) &&
    typeof def === "object" &&
    def !== null
  ) {
    return { ...(def as Record<string, unknown>), ...(stored as Record<string, unknown>) };
  }
  // Wrong shape — fall back to default
  return def;
}

async function loadAllCms(): Promise<Record<string, unknown>> {
  const rows = await db
    .select()
    .from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, CMS_KEYS as unknown as string[]));
  const result: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) {
    if (CMS_KEYS.includes(row.key as CmsKey)) {
      result[row.key] = mergeWithDefaults(row.key as CmsKey, row.value);
    }
  }
  return result;
}

// ── PUBLIC: read all CMS settings (no auth) ──────────────
router.get("/site", async (_req, res) => {
  try {
    const settings = await loadAllCms();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// ── ADMIN: write a single CMS key ───────────────────────
router.put("/admin/:key", authenticate, authorize("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const fullKey = `cms.${req.params.key}` as CmsKey;
    if (!(CMS_KEYS as readonly string[]).includes(fullKey)) {
      res.status(400).json({ error: "InvalidKey", message: `Unknown CMS key: ${fullKey}` });
      return;
    }
    const value = req.body;
    if (value === undefined) {
      res.status(400).json({ error: "InvalidBody", message: "Request body required" });
      return;
    }
    await db
      .insert(platformSettingsTable)
      .values({ key: fullKey, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });

    // Broadcast to all customer/store/admin sockets so everyone refreshes CMS
    const io = getIO();
    if (io) {
      const payload = { key: fullKey };
      io.of("/customer").emit("cms_updated", payload);
      io.of("/store").emit("cms_updated", payload);
      emitToAdmin("cms_updated", payload);
    }

    res.json({ success: true, key: fullKey, value });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

export default router;
