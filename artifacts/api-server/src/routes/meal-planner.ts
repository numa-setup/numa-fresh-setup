import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { productsTable, storesTable, mealPlansTable } from "@workspace/db/schema";
import { and, eq, gt, inArray, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { authenticate, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

const GeneratePlanSchema = z.object({
  budget: z.number().min(10).max(2000),
  planType: z.enum(["1day", "3day", "weekly", "monthly"]),
  familySize: z.number().min(1).max(20).default(4),
  meatTypes: z.array(z.string()).default(["chicken", "beef"]),
  cuisineStyles: z.array(z.string()).default(["south_asian", "middle_eastern"]),
  dietaryRestrictions: z.array(z.string()).default([]),
  preferLocalStores: z.boolean().default(false),
  storeIds: z.array(z.string()).optional(),
});

const PLAN_DAYS: Record<string, number> = {
  "1day": 1,
  "3day": 3,
  "weekly": 7,
  "monthly": 30,
};

router.post("/meal-planner/generate", async (req, res) => {
  try {
    const body = GeneratePlanSchema.parse(req.body);
    const numDays = PLAN_DAYS[body.planType];

    const whereConditions = [
      eq(productsTable.isActive, true),
      gt(productsTable.stockQty, 0),
    ];

    if (body.storeIds && body.storeIds.length > 0) {
      whereConditions.push(inArray(productsTable.storeId, body.storeIds));
    }

    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        category: productsTable.category,
        productType: productsTable.productType,
        price: productsTable.price,
        unit: productsTable.unit,
        images: productsTable.images,
        meatAnimalType: productsTable.meatAnimalType,
        tags: productsTable.tags,
        storeId: productsTable.storeId,
        storeName: storesTable.name,
        storeSlug: storesTable.slug,
        storeCity: storesTable.city,
        storeProvince: storesTable.province,
        slug: productsTable.slug,
        stockQty: productsTable.stockQty,
      })
      .from(productsTable)
      .leftJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(and(...whereConditions))
      .limit(120);

    const productList = products
      .map((p) =>
        `- ID:${p.id} | "${p.name}" | ${p.category} | $${p.price.toFixed(2)}/${p.unit} | Store: ${p.storeName} (${p.storeCity}, ${p.storeProvince}) | Type: ${p.productType}${p.meatAnimalType ? ` | Meat: ${p.meatAnimalType}` : ""}`
      )
      .join("\n");

    const cuisineMap: Record<string, string> = {
      south_asian: "South Asian (Pakistani, Indian, Bangladeshi)",
      middle_eastern: "Middle Eastern (Lebanese, Turkish, Egyptian, Persian)",
      african: "African (Nigerian, Somali, Ghanaian)",
      mediterranean: "Mediterranean (Greek, Moroccan)",
      american: "American (classic burgers, wraps, BBQ)",
      mixed: "Mixed global cuisines",
    };

    const cuisineLabels = body.cuisineStyles.map((c) => cuisineMap[c] || c).join(", ");
    const meatLabels = body.meatTypes
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
      .join(", ");

    const restrictions =
      body.dietaryRestrictions.length > 0
        ? `Dietary restrictions: ${body.dietaryRestrictions.join(", ")}.`
        : "No dietary restrictions.";

    const systemPrompt = `You are an expert halal meal planning assistant for Numa Fresh — a premium USA halal grocery marketplace. 
You help Muslim families plan budget-conscious, nutritious, and delicious halal meals using real available products from our stores.
Always ensure all meals are 100% halal. Return ONLY valid JSON, nothing else.`;

    const userPrompt = `Generate a complete ${numDays}-day halal meal plan for a family of ${body.familySize} people.

BUDGET: $${body.budget} total for all groceries for the entire plan.
CUISINE PREFERENCES: ${cuisineLabels}.
PROTEIN PREFERENCES: ${meatLabels}.
${restrictions}

AVAILABLE PRODUCTS FROM OUR STORES (use ONLY products from this list):
${productList}

INSTRUCTIONS:
1. Plan 3 meals per day: Breakfast, Lunch, Dinner (for ${numDays} day${numDays > 1 ? "s" : ""}).
2. For each meal, select 2–5 ingredients from the available products above.
3. Each ingredient quantity should be realistic for ${body.familySize} people.
4. Total cost of ALL ingredients across ALL meals must be <= $${body.budget}.
5. Be creative with authentic halal recipes from the preferred cuisines.
6. Use a variety of proteins across the days (don't repeat the same dish).
7. For monthly plans, you can repeat meal patterns but vary the details.

RESPOND WITH EXACTLY THIS JSON STRUCTURE:
{
  "planTitle": "string",
  "summary": "string (2-3 sentences about the plan)",
  "totalEstimatedCost": number,
  "budgetSavings": number,
  "nutritionHighlights": ["string"],
  "tips": ["string", "string", "string"],
  "days": [
    {
      "dayNumber": 1,
      "dayLabel": "Day 1 – Monday",
      "meals": [
        {
          "mealType": "Breakfast",
          "name": "Meal name",
          "description": "Short appetizing description (1 sentence)",
          "cuisine": "Cuisine type",
          "prepTime": "15 min",
          "cookTime": "20 min",
          "servings": ${body.familySize},
          "estimatedCost": 12.50,
          "ingredients": [
            {
              "productId": "actual-product-id-from-list",
              "productName": "Product name exactly as listed",
              "quantity": 1.5,
              "unit": "kg",
              "priceEach": 8.99,
              "totalPrice": 13.49,
              "storeSlug": "store-slug",
              "storeName": "Store name"
            }
          ],
          "recipeSteps": ["Step 1", "Step 2", "Step 3"]
        }
      ]
    }
  ]
}

IMPORTANT: 
- Only use product IDs from the list above.
- Sum of all ingredient totalPrices must be <= $${body.budget}.
- budgetSavings = $${body.budget} - totalEstimatedCost.
- For monthly plans, include all 30 days.
- Return ONLY the JSON. No markdown, no extra text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return res.status(500).json({ error: "AI returned empty response" });
    }

    let plan: unknown;
    try {
      plan = JSON.parse(rawContent);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response", raw: rawContent });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    return res.json({
      success: true,
      plan,
      metadata: {
        productsAvailable: products.length,
        planType: body.planType,
        numDays,
        budget: body.budget,
        familySize: body.familySize,
        generatedAt: new Date().toISOString(),
      },
      productMap: Object.fromEntries(productMap),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Meal planner error:", error);
    return res.status(500).json({ error: "Failed to generate meal plan" });
  }
});

// POST /api/meal-planner/swap-meal
router.post("/meal-planner/swap-meal", async (req, res) => {
  try {
    const { dayNumber, mealType, currentMealName, preferences } = req.body;
    if (!mealType) {
      res.status(400).json({ error: "mealType is required" });
      return;
    }

    const products = await db
      .select({
        id: productsTable.id, name: productsTable.name, category: productsTable.category,
        productType: productsTable.productType, price: productsTable.price,
        unit: productsTable.unit, meatAnimalType: productsTable.meatAnimalType,
        storeId: productsTable.storeId, slug: productsTable.slug,
        images: productsTable.images, description: productsTable.description,
        stockQty: productsTable.stockQty, tags: productsTable.tags,
        storeName: storesTable.name, storeSlug: storesTable.slug,
        storeCity: storesTable.city,
      })
      .from(productsTable)
      .leftJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(and(eq(productsTable.isActive, true), gt(productsTable.stockQty, 0)))
      .limit(60);

    const productList = products.map((p) =>
      `- ID:${p.id} | "${p.name}" | ${p.category} | $${p.price.toFixed(2)}/${p.unit} | Store: ${p.storeName} (${p.storeCity}) | Type: ${p.productType}${p.meatAnimalType ? ` | Meat: ${p.meatAnimalType}` : ""}`
    ).join("\n");

    const prompt = `Generate ONE replacement halal ${mealType} meal${currentMealName ? ` (replacing "${currentMealName}")` : ""}.
${preferences ? `Preferences: ${preferences}` : ""}

Use ONLY products from this list:
${productList}

Return ONLY valid JSON with EXACTLY this structure:
{
  "mealType": "${mealType}",
  "name": "Meal name",
  "description": "Short appetizing description",
  "cuisine": "Cuisine type",
  "prepTime": "15 min",
  "cookTime": "20 min",
  "servings": 4,
  "estimatedCost": 15.00,
  "ingredients": [
    {
      "productId": "actual-product-id",
      "productName": "Product name",
      "quantity": 1,
      "unit": "kg",
      "priceEach": 8.99,
      "totalPrice": 8.99,
      "storeSlug": "store-slug",
      "storeName": "Store name"
    }
  ],
  "recipeSteps": ["Step 1", "Step 2"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: "You are an expert halal meal planning assistant. Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      res.status(500).json({ error: "AI returned empty response" });
      return;
    }

    const meal = JSON.parse(rawContent);
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    res.json({ meal, productMap });
  } catch (error) {
    console.error("Swap meal error:", error);
    res.status(500).json({ error: "Failed to generate replacement meal" });
  }
});

// POST /api/meal-planner/plans — save a generated plan
router.post("/meal-planner/plans", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, planType, planData } = req.body;
    if (!name || !planData) {
      res.status(400).json({ error: "ValidationError", message: "name and planData are required" });
      return;
    }
    const [saved] = await db.insert(mealPlansTable).values({
      userId: req.user!.userId,
      name,
      planType: planType || "weekly",
      planData,
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    req.log.error({ err }, "Save meal plan error");
    res.status(500).json({ error: "ServerError", message: "Failed to save plan" });
  }
});

// GET /api/meal-planner/plans — list saved plans for current user
router.get("/meal-planner/plans", authenticate, async (req: AuthRequest, res) => {
  try {
    const plans = await db.select().from(mealPlansTable)
      .where(eq(mealPlansTable.userId, req.user!.userId))
      .orderBy(desc(mealPlansTable.createdAt))
      .limit(20);
    res.json({ plans });
  } catch (err) {
    req.log.error({ err }, "List meal plans error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch plans" });
  }
});

// DELETE /api/meal-planner/plans/:id — delete a saved plan
router.delete("/meal-planner/plans/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const [existing] = await db.select().from(mealPlansTable)
      .where(eq(mealPlansTable.id, req.params.id)).limit(1);
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ error: "NotFound", message: "Plan not found" });
      return;
    }
    await db.delete(mealPlansTable).where(eq(mealPlansTable.id, req.params.id));
    res.json({ message: "Plan deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete meal plan error");
    res.status(500).json({ error: "ServerError", message: "Failed to delete plan" });
  }
});

router.get("/meal-planner/products", async (_req, res) => {
  try {
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        category: productsTable.category,
        productType: productsTable.productType,
        price: productsTable.price,
        unit: productsTable.unit,
        meatAnimalType: productsTable.meatAnimalType,
        storeId: productsTable.storeId,
        storeName: storesTable.name,
        storeCity: storesTable.city,
        storeProvince: storesTable.province,
        slug: productsTable.slug,
        images: productsTable.images,
      })
      .from(productsTable)
      .leftJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(and(eq(productsTable.isActive, true), gt(productsTable.stockQty, 0)))
      .limit(200);

    return res.json({ products });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

export default router;
