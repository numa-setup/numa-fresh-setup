import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, productsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const SITE_URL = process.env.FRONTEND_URL || "https://numafresh.com";

// GET /api/sitemap.xml
router.get("/sitemap.xml", async (_req, res) => {
  try {
    const [stores, products] = await Promise.all([
      db.select({ slug: storesTable.slug, city: storesTable.city, updatedAt: storesTable.updatedAt })
        .from(storesTable).where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true))),
      db.select({ slug: productsTable.slug, updatedAt: productsTable.updatedAt })
        .from(productsTable).where(eq(productsTable.isActive, true)).limit(1000),
    ]);

    const staticPages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/products", priority: "0.9", changefreq: "daily" },
      { url: "/about", priority: "0.6", changefreq: "monthly" },
      { url: "/contact", priority: "0.6", changefreq: "monthly" },
    ];

    const storeUrls = stores.map((s) => ({
      url: `/stores/${s.slug}`,
      lastmod: s.updatedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
      priority: "0.8",
      changefreq: "weekly",
    }));

    const productUrls = products.map((p) => ({
      url: `/products/${p.slug}`,
      lastmod: p.updatedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
      priority: "0.7",
      changefreq: "weekly",
    }));

    const allUrls = [
      ...staticPages.map((p) => ({ ...p, lastmod: new Date().toISOString().split("T")[0] })),
      ...storeUrls,
      ...productUrls,
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((u) => `  <url>
    <loc>${SITE_URL}${u.url}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(xml);
  } catch (err) {
    return res.status(500).send("<?xml version='1.0'?><error>Failed to generate sitemap</error>");
  }
});

// GET /api/robots.txt
router.get("/robots.txt", (_req, res) => {
  const robots = `User-agent: *
Allow: /products
Allow: /about
Allow: /contact

Disallow: /admin
Disallow: /store-portal
Disallow: /account
Disallow: /checkout
Disallow: /api/

Sitemap: ${SITE_URL}/api/sitemap.xml`;
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.send(robots);
});

export default router;
