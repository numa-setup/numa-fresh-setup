import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";
import { stripeCheckoutWebhook } from "./routes/stripe-checkout.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// ── Trust proxy (required for rate limiting behind Replit proxy) ──
app.set("trust proxy", 1);

// ── Security headers (helmet) ─────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.stripe.com", "wss:", "ws:"],
      frameSrc: ["https://js.stripe.com"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────
// Allow: explicit FRONTEND_URL, localhost (any port), LAN IPs (192.168.x.x),
// and the pickup verification page accessed from any phone on the local network.
function corsOriginFn(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  // Same-origin / server-to-server (no Origin header)
  if (!origin) { callback(null, true); return; }

  // Always allow localhost on any port
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) { callback(null, true); return; }

  // Allow LAN / private-range IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    callback(null, true);
    return;
  }

  // Allow explicit FRONTEND_URL if configured
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    callback(null, true);
    return;
  }

  // Allow all Replit deployment and preview domains
  if (/^https?:\/\/[a-zA-Z0-9-]+\.replit\.app$/.test(origin)) { callback(null, true); return; }
  if (/^https?:\/\/[a-zA-Z0-9-]+-\d{2}-[a-zA-Z0-9]+\.[a-z]+\.replit\.dev$/.test(origin)) { callback(null, true); return; }
  if (/^https?:\/\/.*\.replit\.dev$/.test(origin)) { callback(null, true); return; }

  // In development mode — allow everything
  if (process.env.NODE_ENV !== "production") { callback(null, true); return; }

  callback(new Error(`CORS: origin "${origin}" not allowed`));
}

app.use(cors({
  origin: corsOriginFn,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
}));

// ── Global rate limiter (200 req/min per IP) ─────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please slow down.",
    message: "Too many requests, please slow down.",
  },
  skip: (req) => req.path.includes("/health"),
});

// ── Auth rate limiter (10 req/min per IP) — excludes passwordless OTP routes ──
// (Those have their own limits: per-email hourly cap + lockout in auth-otp.ts.)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Try again in 1 minute.",
    message: "Too many authentication attempts. Try again in 1 minute.",
  },
  skip: (req) => {
    const path = req.originalUrl?.split("?")[0] || req.path || "";
    return /\/auth\/(send-otp|verify-otp|complete-profile)$/.test(path);
  },
});

// ── Order creation rate limiter (5 req/min per IP) ───────────────
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many orders in quick succession. Please wait a moment." },
});

// ── AI chat rate limiter (15 req/min per IP — anonymous LLM endpoint) ───
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat requests. Please wait a moment before asking again." },
});
app.use("/api/ai/chat", aiChatLimiter);

// ── Stripe webhooks — raw body must run BEFORE express.json ───────
app.post("/api/payments/webhook",
  express.raw({ type: "application/json" }),
);
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeCheckoutWebhook,
);
app.post(
  "/api/orders/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeCheckoutWebhook,
);

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── Request logging ───────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

// ── Apply rate limiters ───────────────────────────────────────────
app.use(globalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/orders", orderLimiter);

// ── Routes ────────────────────────────────────────────────────────
app.use("/api", router);

// ── Global error handler ──────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const url = req.originalUrl?.split("?")[0] || "";
  const isOtpAuthRoute =
    url.endsWith("/auth/send-otp") ||
    url.endsWith("/auth/verify-otp") ||
    url.endsWith("/auth/complete-profile");
  const exposeMessage = isOtpAuthRoute || process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: isOtpAuthRoute ? "ServerError" : "InternalServerError",
    message: exposeMessage ? (err.message || "Something went wrong") : "Something went wrong",
  });
});

export default app;
