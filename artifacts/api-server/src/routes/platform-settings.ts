import { Router } from "express";
import { db } from "@workspace/db";
import { citiesTable, platformSettingsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();
router.use(authenticate);
router.use(authorize("ADMIN"));

// Cities
router.get("/cities", async (_req, res) => {
  try {
    const cities = await db.select().from(citiesTable).orderBy(asc(citiesTable.sortOrder));
    res.json(cities);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

router.post("/cities", async (req: AuthRequest, res) => {
  try {
    const { name, state, sortOrder = 0 } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
    const [city] = await db.insert(citiesTable).values({ name: name.trim(), state, sortOrder }).returning();
    res.status(201).json(city);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

router.patch("/cities/:id", async (req: AuthRequest, res) => {
  try {
    const { name, state, isActive, sortOrder } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (state !== undefined) updates.state = state;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    const [city] = await db.update(citiesTable).set(updates).where(eq(citiesTable.id, req.params.id)).returning();
    res.json(city);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

router.delete("/cities/:id", async (req: AuthRequest, res) => {
  try {
    await db.delete(citiesTable).where(eq(citiesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// Platform settings
router.get("/settings", async (_req, res) => {
  try {
    const settings = await db.select().from(platformSettingsTable);
    const obj: Record<string, unknown> = {};
    for (const s of settings) obj[s.key] = s.value;
    res.json(obj);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

router.patch("/settings", async (req: AuthRequest, res) => {
  try {
    const updates = req.body as Record<string, unknown>;
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        db.insert(platformSettingsTable)
          .values({ key, value, updatedAt: new Date() })
          .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } })
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

export default router;
