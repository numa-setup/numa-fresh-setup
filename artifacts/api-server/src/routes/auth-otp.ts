/**
 * Passwordless email OTP auth — standalone router mounted at /api/auth alongside existing auth routes.
 * Routes: POST /send-otp, POST /verify-otp, POST /complete-profile
 */
import { Router, type Request, type Response } from "express";
import { randomInt } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { eq, and, desc, gt, gte, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  storesTable,
  emailOtpCodesTable,
  otpVerificationThrottleTable,
} from "@workspace/db/schema";
import { generateAccessToken, generateRefreshToken, type TokenPayload } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { ensureAdminWelcome } from "../lib/messaging.js";

const router = Router();

const portalSchema = z.enum(["customer", "seller"]);

const sendOtpSchema = z.object({
  email: z.string().email(),
  portal: portalSchema,
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d+$/),
  portal: portalSchema,
});

const completeProfileSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).optional().nullable(),
  portal: portalSchema,
  storeName: z.string().min(1).max(200).optional().nullable(),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function otpDigitsFromEnv(): number {
  const n = parseInt(process.env.OTP_LENGTH || "6", 10);
  if (n >= 4 && n <= 8) return n;
  return 6;
}

function otpExpiryMs(): number {
  const mins = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10);
  const m = Number.isFinite(mins) && mins > 0 && mins <= 60 ? mins : 10;
  return m * 60 * 1000;
}

function profileCompletionWindowMs(): number {
  return 30 * 60 * 1000;
}

/** Cryptographically secure numeric OTP (OTP_LENGTH digits). */
function generateOtpCode(digits: number): string {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return randomInt(min, max).toString();
}

function portalMatchesUserRole(portal: z.infer<typeof portalSchema>, role: string): boolean {
  if (portal === "customer") return role === "CUSTOMER";
  if (portal === "seller") return role === "STORE_OWNER" || role === "STORE_STAFF";
  return false;
}

function sendOtpPortalError(portal: z.infer<typeof portalSchema>, role: string): { status: number; body: object } | null {
  if (role === "ADMIN") {
    return {
      status: 400,
      body: {
        error: "PortalMismatch",
        message: "This email is registered as an administrator. Please use the admin sign-in page.",
      },
    };
  }
  if (portal === "customer" && !portalMatchesUserRole(portal, role)) {
    return {
      status: 400,
      body: {
        error: "PortalMismatch",
        message:
          role === "STORE_OWNER" || role === "STORE_STAFF"
            ? "This email is registered to a store account. Please use the Store Owner Portal to sign in."
            : "This email cannot use the customer sign-in page.",
      },
    };
  }
  if (portal === "seller" && !portalMatchesUserRole(portal, role)) {
    return {
      status: 400,
      body: {
        error: "PortalMismatch",
        message:
          role === "CUSTOMER"
            ? "This email is registered to a customer account. Please use the customer sign-in page."
            : "This email cannot use the store owner sign-in page.",
      },
    };
  }
  return null;
}

function buildOtpEmailHtml(otp: string, expiryMinutes: number): string {
  const teal = "#0d9488";
  const bg = "#f0faf5";
  const digitsHtml = otp
    .split("")
    .map((d) => `<span style="display:inline-block;margin:0 4px;">${d}</span>`)
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px 12px;background:${bg};font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06);">
    <tr><td style="padding:28px 24px 8px;text-align:center;border-bottom:1px solid #e8f5ef;">
      <div style="font-weight:800;font-size:20px;letter-spacing:.06em;color:${teal};">NUMA FRESH</div>
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.2em;margin-top:4px;">Halal Marketplace</div>
    </td></tr>
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Hi there! 👋</p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;">Your one-time login code is:</p>
      <div style="text-align:center;padding:20px 16px;border:2px dashed #ccfbf1;border-radius:14px;background:#f8fffc;">
        <div style="font-size:36px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:8px;color:${teal};">
          ${digitsHtml}
        </div>
      </div>
      <p style="margin:20px 0 0;font-size:14px;color:#64748b;">This code expires in <strong>${expiryMinutes}</strong> minute${expiryMinutes === 1 ? "" : "s"}.</p>
      <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">If you didn't request this, you can safely ignore this email.</p>
    </td></tr>
    <tr><td style="padding:16px 24px 24px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;">
      Numa Fresh • Halal Marketplace<br/><a href="https://numafresh.com" style="color:${teal};text-decoration:none;">numafresh.com</a>
    </td></tr>
  </table>
</body></html>`;
}

function safeJsonStringify(value: unknown): string {
  try {
    if (value && typeof value === "object") {
      return JSON.stringify(value, Object.getOwnPropertyNames(value), 2);
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Walks `cause` so DrizzleQueryError → pg error codes surface as 42P01, etc. */
function postgresErrorCode(error: unknown): string | undefined {
  let cur: unknown = error;
  for (let depth = 0; depth < 8 && cur && typeof cur === "object"; depth++) {
    const c = cur as { code?: string; cause?: unknown };
    if (typeof c.code === "string" && c.code.length > 0) return c.code;
    cur = c.cause;
  }
  return undefined;
}

/** Concatenates messages along the `cause` chain (Drizzle wraps PG errors). */
function chainedErrorMessages(error: unknown): string {
  const parts: string[] = [];
  let cur: unknown = error;
  for (let depth = 0; depth < 8 && cur && typeof cur === "object"; depth++) {
    const c = cur as { message?: string; cause?: unknown };
    if (typeof c.message === "string" && c.message.length > 0) parts.push(c.message);
    cur = c.cause;
  }
  return parts.join(" | ");
}

/**
 * Must stay on Resend's unverified sender until a domain is verified in the Resend dashboard.
 */
const RESEND_OTP_FROM = "Numa Fresh <onboarding@resend.dev>";

async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set on the API server. Add it to artifacts/api-server/.env (not the frontend .env) and restart the API.",
    );
  }
  const expiryMinutes = Math.round(otpExpiryMs() / 60000);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: RESEND_OTP_FROM,
    to: [to],
    subject: `Your Numa Fresh Login Code: ${otp}`,
    html: buildOtpEmailHtml(otp, expiryMinutes),
  });
  if (error) {
    logger.error({ error: safeJsonStringify(error) }, "Resend email failed");
    let detail = [error.name, error.message].filter(Boolean).join(": ") || "Email send failed";
    if (
      /only send to|verify your domain|testing emails|not allowed/i.test(detail) ||
      (error as { statusCode?: number }).statusCode === 403
    ) {
      detail +=
        " — With onboarding@resend.dev you may only deliver to addresses allowed by your Resend plan (often the account email until you verify a domain at resend.com/domains).";
    }
    throw new Error(detail);
  }
  logger.info({ to, emailId: data?.id }, "OTP email sent via Resend");
}

function safeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

function issueTokens(user: typeof usersTable.$inferSelect, portal: z.infer<typeof portalSchema>) {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    portal,
  };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/** POST /api/auth/send-otp */
router.post("/send-otp", (req: Request, res: Response) => {
  void (async () => {
    try {
    const apiKeyEarly = process.env.RESEND_API_KEY?.trim();

    if (!apiKeyEarly) {
      logger.warn("send-otp: RESEND_API_KEY is missing");
      if (!res.headersSent) {
        res.status(500).json({
          error: "ConfigError",
          message: "Email service not configured (RESEND_API_KEY on the API server).",
          code: "MISSING_RESEND_KEY",
        });
      }
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      logger.info({ keyPrefix: `${apiKeyEarly.substring(0, 10)}…` }, "send-otp: Resend key present");
    }

    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      if (!res.headersSent) {
        res.status(400).json({ error: "ValidationError", message: "Please enter a valid email address." });
      }
      return;
    }
    const emailNorm = normalizeEmail(parsed.data.email);
    const { portal } = parsed.data;

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm)).limit(1);
    if (existing) {
      if (!existing.isActive) {
        if (!res.headersSent) {
          res.status(403).json({ error: "AuthError", message: "This account is deactivated." });
        }
        return;
      }
      const portalErr = sendOtpPortalError(portal, existing.role);
      if (portalErr) {
        if (!res.headersSent) {
          res.status(portalErr.status).json(portalErr.body);
        }
        return;
      }
    }

    const hourlyCutoff = new Date(Date.now() - 60 * 60 * 1000);
    const [countRow] = await db
      .select({ c: count() })
      .from(emailOtpCodesTable)
      .where(
        and(
          eq(emailOtpCodesTable.email, emailNorm),
          eq(emailOtpCodesTable.portal, portal),
          gte(emailOtpCodesTable.createdAt, hourlyCutoff),
        ),
      );
    const sendCount = Number(countRow?.c ?? 0);
    if (sendCount >= 5) {
      if (!res.headersSent) {
        res.status(429).json({
          error: "RateLimited",
          message: "Too many requests. Please wait before requesting another code.",
        });
      }
      return;
    }

    const digits = otpDigitsFromEnv();
    const otp = generateOtpCode(digits);
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + otpExpiryMs());

    logger.info({ email: emailNorm, portal }, "send-otp: persisting OTP to database");
    await db.delete(emailOtpCodesTable).where(
      and(
        eq(emailOtpCodesTable.email, emailNorm),
        eq(emailOtpCodesTable.portal, portal),
        eq(emailOtpCodesTable.isUsed, false),
      ),
    );

    await db.insert(emailOtpCodesTable).values({
      email: emailNorm,
      portal,
      hashedOtp,
      expiresAt,
      isUsed: false,
      pendingProfileExpiresAt: null,
    });
    logger.info({ email: emailNorm }, "send-otp: OTP row saved");

    await sendOtpEmail(emailNorm, otp);

    if (!res.headersSent) {
      res.json({
        success: true,
        isNewUser: !existing,
        expiresAt: expiresAt.toISOString(),
        otpLength: digits,
      });
    }
    } catch (error: unknown) {
    logger.error({ err: error, serialized: safeJsonStringify(error) }, "send-otp failed");

    if (res.headersSent) return;

    const msg = chainedErrorMessages(error) || String((error as Error)?.message || "Something went wrong");
    const pgCode = postgresErrorCode(error);
    const missingTable =
      pgCode === "42P01" ||
      /relation ["']?email_otp_codes["']? does not exist/i.test(msg) ||
      /relation ["']?otp_verification_throttle["']? does not exist/i.test(msg);

    const clientMessage = missingTable
      ? "Sign-in tables are missing from the database. Run: cd lib/db && pnpm run push — or apply the tables from lib/db/src/schema/email-otp.ts to your DATABASE_URL."
      : msg;

    res.status(500).json({
      error: "ServerError",
      message: clientMessage,
      debug: missingTable ? "MISSING_OTP_TABLES" : (pgCode || (error as { code?: string })?.code || "UNKNOWN"),
    });
    }
  })().catch((outer: unknown) => {
    logger.error({ err: outer, serialized: safeJsonStringify(outer) }, "send-otp unhandled rejection");
    if (!res.headersSent) {
      const msg = chainedErrorMessages(outer) || String((outer as Error)?.message || "Something went wrong");
      const pgCode = postgresErrorCode(outer);
      const missingTable =
        pgCode === "42P01" ||
        /relation ["']?email_otp_codes["']? does not exist/i.test(msg) ||
        /relation ["']?otp_verification_throttle["']? does not exist/i.test(msg);
      res.status(500).json({
        error: "ServerError",
        message: missingTable
          ? "Sign-in tables are missing from the database. Run: cd lib/db && pnpm run push — or apply the tables from lib/db/src/schema/email-otp.ts to your DATABASE_URL."
          : msg,
        debug: missingTable ? "MISSING_OTP_TABLES" : pgCode,
      });
    }
  });
});

/** POST /api/auth/verify-otp */
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", message: "Please enter a valid email address." });
      return;
    }
    const emailNorm = normalizeEmail(parsed.data.email);
    const rawOtp = parsed.data.otp.trim();
    const { portal } = parsed.data;
    const digits = otpDigitsFromEnv();
    if (rawOtp.length !== digits) {
      res.status(400).json({ error: "InvalidCode", message: "Incorrect code. Please check and try again.", attemptsRemaining: null });
      return;
    }

    const [throttle] = await db
      .select()
      .from(otpVerificationThrottleTable)
      .where(and(eq(otpVerificationThrottleTable.email, emailNorm), eq(otpVerificationThrottleTable.portal, portal)))
      .limit(1);

    if (throttle?.lockedUntil && throttle.lockedUntil.getTime() > Date.now()) {
      const sec = Math.ceil((throttle.lockedUntil.getTime() - Date.now()) / 1000);
      res.status(429).json({
        error: "LockedOut",
        message: `Too many attempts. Try again in ${Math.ceil(sec / 60)} minutes.`,
        lockedUntil: throttle.lockedUntil.toISOString(),
      });
      return;
    }

    const recent = await db
      .select()
      .from(emailOtpCodesTable)
      .where(and(eq(emailOtpCodesTable.email, emailNorm), eq(emailOtpCodesTable.portal, portal)))
      .orderBy(desc(emailOtpCodesTable.createdAt))
      .limit(8);

    let matchedRow: (typeof emailOtpCodesTable.$inferSelect) | null = null;
    let matchKind: "active" | "used" | "expired" | "none" = "none";

    for (const row of recent) {
      const ok = await bcrypt.compare(rawOtp, row.hashedOtp);
      if (!ok) continue;
      matchedRow = row;
      if (row.isUsed) matchKind = "used";
      else if (row.expiresAt.getTime() <= Date.now()) matchKind = "expired";
      else matchKind = "active";
      break;
    }

    const bumpThrottle = async () => {
      const [t] = await db
        .select()
        .from(otpVerificationThrottleTable)
        .where(and(eq(otpVerificationThrottleTable.email, emailNorm), eq(otpVerificationThrottleTable.portal, portal)))
        .limit(1);
      const nextFails = (t?.failedAttempts ?? 0) + 1;
      const lockUntil =
        nextFails >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : t?.lockedUntil ?? null;
      if (t) {
        await db
          .update(otpVerificationThrottleTable)
          .set({ failedAttempts: nextFails, lockedUntil: lockUntil, updatedAt: new Date() })
          .where(
            and(eq(otpVerificationThrottleTable.email, emailNorm), eq(otpVerificationThrottleTable.portal, portal)),
          );
      } else {
        await db.insert(otpVerificationThrottleTable).values({
          email: emailNorm,
          portal,
          failedAttempts: nextFails,
          lockedUntil: lockUntil,
          updatedAt: new Date(),
        });
      }
      return { nextFails, lockUntil };
    };

    const clearThrottle = async () => {
      await db
        .delete(otpVerificationThrottleTable)
        .where(and(eq(otpVerificationThrottleTable.email, emailNorm), eq(otpVerificationThrottleTable.portal, portal)));
    };

    if (!matchedRow) {
      const { nextFails, lockUntil } = await bumpThrottle();
      const remaining = Math.max(0, 3 - nextFails);
      if (lockUntil && lockUntil.getTime() > Date.now()) {
        res.status(429).json({
          error: "LockedOut",
          message: "Too many attempts. Try again in 15 minutes.",
        });
        return;
      }
      res.status(400).json({
        error: "InvalidCode",
        message: `Incorrect code.${remaining > 0 ? ` ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` : ""}`,
        attemptsRemaining: remaining,
      });
      return;
    }

    if (matchKind === "used") {
      res.status(400).json({
        error: "AlreadyUsed",
        message: "Code already used. Please request a new one.",
      });
      return;
    }

    if (matchKind === "expired") {
      res.status(400).json({
        error: "ExpiredCode",
        message: "Code expired. Please request a new one.",
      });
      return;
    }

    await clearThrottle();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm)).limit(1);

    if (user) {
      if (!user.isActive) {
        res.status(403).json({ error: "AuthError", message: "This account is deactivated." });
        return;
      }
      const portalErr = sendOtpPortalError(portal, user.role);
      if (portalErr) {
        res.status(portalErr.status).json(portalErr.body);
        return;
      }

      await db
        .update(emailOtpCodesTable)
        .set({ isUsed: true, pendingProfileExpiresAt: null })
        .where(eq(emailOtpCodesTable.id, matchedRow.id));

      const tokens = issueTokens(user, portal);
      res.json({
        success: true,
        requiresProfile: false,
        user: safeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      return;
    }

    const pendingUntil = new Date(Date.now() + profileCompletionWindowMs());
    await db
      .update(emailOtpCodesTable)
      .set({ isUsed: true, pendingProfileExpiresAt: pendingUntil })
      .where(eq(emailOtpCodesTable.id, matchedRow.id));

    res.json({ success: true, requiresProfile: true });
  } catch (err) {
    logger.error({ err }, "verify-otp failed");
    res.status(500).json({ error: "ServerError", message: "Something went wrong. Please try again." });
  }
});

/** POST /api/auth/complete-profile */
router.post("/complete-profile", async (req: Request, res: Response) => {
  try {
    const parsed = completeProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", message: "Please complete all required fields." });
      return;
    }
    const emailNorm = normalizeEmail(parsed.data.email);
    const { portal, firstName, lastName, phone } = parsed.data;
    const storeName = parsed.data.storeName?.trim() || "";

    if (portal === "seller" && !storeName) {
      res.status(400).json({ error: "ValidationError", message: "Store name is required." });
      return;
    }

    const [proof] = await db
      .select()
      .from(emailOtpCodesTable)
      .where(
        and(
          eq(emailOtpCodesTable.email, emailNorm),
          eq(emailOtpCodesTable.portal, portal),
          eq(emailOtpCodesTable.isUsed, true),
          gt(emailOtpCodesTable.pendingProfileExpiresAt, new Date()),
        ),
      )
      .orderBy(desc(emailOtpCodesTable.createdAt))
      .limit(1);

    if (!proof) {
      res.status(400).json({
        error: "SessionExpired",
        message: "Verification session expired. Please start sign-in again.",
      });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, emailNorm)).limit(1);
    if (existing) {
      res.status(409).json({
        error: "ConflictError",
        message: "An account with this email already exists. Please sign in instead.",
      });
      return;
    }

    const role = portal === "seller" ? "STORE_OWNER" : "CUSTOMER";

    const [user] = await db
      .insert(usersTable)
      .values({
        email: emailNorm,
        passwordHash: null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        role,
        isVerified: true,
        isActive: true,
      })
      .returning();

    await db
      .update(emailOtpCodesTable)
      .set({ pendingProfileExpiresAt: null })
      .where(eq(emailOtpCodesTable.id, proof.id));

    if (user.role === "STORE_OWNER") {
      try {
        await db.insert(storesTable).values({
          ownerId: user.id,
          slug: `store-${user.id.slice(0, 8)}`,
          name: storeName,
          phone: phone?.trim() || "",
          email: user.email,
          address: "",
          city: "",
          province: "",
          postalCode: "",
          lat: 0,
          lng: 0,
          openingHoursJson: {},
          storeStatus: "draft",
          onboardingCompleted: false,
        });
      } catch (stubErr) {
        logger.error({ err: stubErr, userId: user.id }, "OTP complete-profile: stub store failed");
      }
    }

    try {
      await ensureAdminWelcome(user.id, user.role as "CUSTOMER" | "STORE_OWNER" | "STORE_STAFF" | "ADMIN");
    } catch (welErr) {
      logger.error({ err: welErr, userId: user.id }, "OTP complete-profile: welcome chat failed");
    }

    const tokens = issueTokens(user, portal);
    res.status(201).json({
      success: true,
      user: safeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    logger.error({ err }, "complete-profile failed");
    res.status(500).json({ error: "ServerError", message: "Something went wrong. Please try again." });
  }
});

export default router;
