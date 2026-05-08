import { Router } from "express";

const router = Router();

router.use((_req, res) => {
  res.status(501).json({ error: "AI chat not configured" });
});

export default router;
