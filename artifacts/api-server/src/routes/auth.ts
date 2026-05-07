import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, storesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../lib/auth.js";
import { authenticate, AuthRequest } from "../middlewares/authenticate.js";
import { ensureAdminWelcome } from "../lib/messaging.js";

const router = Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: "ValidationError", message: "Missing required fields" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "ValidationError", message: "Password must be at least 8 characters" });
      return;
    }

    const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existingUser.length > 0) {
      res.status(400).json({ error: "ConflictError", message: "Email already registered" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone: phone || null,
      role: role === "STORE_OWNER" ? "STORE_OWNER" : "CUSTOMER",
      isVerified: true, // Auto-verify for now
    }).returning();

    // Auto-create a stub store row for new STORE_OWNERs so the onboarding
    // wizard has something to PATCH and the final /onboarding/submit can
    // mark it as 'pending' and notify admins.
    if (user.role === "STORE_OWNER") {
      try {
        await db.insert(storesTable).values({
          ownerId: user.id,
          slug: `store-${user.id.slice(0, 8)}`,
          name: `${firstName}'s Store`,
          phone: phone || "",
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
        req.log.error({ err: stubErr, userId: user.id }, "Failed to create stub store for new STORE_OWNER");
      }
    }

    // Idempotent welcome message from the platform admin to every new user.
    try {
      await ensureAdminWelcome(user.id, user.role as any);
    } catch (welErr) {
      req.log.error({ err: welErr, userId: user.id }, "Failed to seed welcome chat");
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    req.log.error({ err }, "Signup error");
    res.status(500).json({ error: "ServerError", message: "Failed to create account" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "ValidationError", message: "Email and password required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "AuthError", message: "Invalid email or password" });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({ error: "AuthError", message: "Account is deactivated" });
      return;
    }

    const passwordValid = await comparePassword(password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: "AuthError", message: "Invalid email or password" });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "ServerError", message: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);

    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "ServerError", message: "Failed to get user" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: "ValidationError", message: "Refresh token required" });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "AuthError", message: "Invalid refresh token" });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "AuthError", message: "Invalid or expired refresh token" });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "ValidationError", message: "Email required" });
    return;
  }
  // In production: send reset email
  res.json({ message: "If that email exists, a password reset link has been sent" });
});

// POST /api/auth/verify-email/:token
router.post("/verify-email/:token", async (req, res) => {
  res.json({ message: "Email verified successfully" });
});

// GET /api/auth/google — initiate Google OAuth
router.get("/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "GoogleOAuthNotConfigured", message: "Google OAuth is not configured on this server" });
    return;
  }
  const redirectUri = `${process.env.APP_URL || "https://localhost"}/api/auth/google/callback`;
  const scope = encodeURIComponent("openid email profile");
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString("base64url");
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;
  res.redirect(url);
});

// GET /api/auth/google/callback — Google OAuth callback
router.get("/google/callback", async (req, res) => {
  try {
    const { code, error: oauthError } = req.query as Record<string, string>;
    const frontendUrl = process.env.FRONTEND_URL || "";

    if (oauthError || !code) {
      res.redirect(`${frontendUrl}/login?error=google_oauth_failed`);
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${process.env.APP_URL || ""}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokenData = await tokenRes.json() as { id_token?: string; access_token?: string; error?: string };

    if (tokenData.error || !tokenData.id_token) {
      res.redirect(`${frontendUrl}/login?error=google_token_failed`);
      return;
    }

    // Decode id_token (base64) to get user info
    const [, payloadB64] = tokenData.id_token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as { sub: string; email: string; given_name: string; family_name: string; picture?: string };

    // Find or create user
    let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, payload.sub)).limit(1);
    if (!user) {
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, payload.email.toLowerCase())).limit(1);
      if (byEmail) {
        // Link google ID to existing account
        [user] = await db.update(usersTable).set({ googleId: payload.sub }).where(eq(usersTable.id, byEmail.id)).returning();
      } else {
        // Create new account
        [user] = await db.insert(usersTable).values({
          email: payload.email.toLowerCase(),
          googleId: payload.sub,
          firstName: payload.given_name || "Google",
          lastName: payload.family_name || "User",
          avatar: payload.picture || null,
          isVerified: true,
          role: "CUSTOMER",
        }).returning();
      }
    }

    try {
      await ensureAdminWelcome(user.id, user.role as any);
    } catch (welErr) {
      req.log.error({ err: welErr, userId: user.id }, "Failed to seed welcome chat");
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Redirect to frontend with tokens (popup window approach)
    res.redirect(`${frontendUrl}/login?accessToken=${accessToken}&refreshToken=${refreshToken}&googleAuth=1`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback error");
    const frontendUrl = process.env.FRONTEND_URL || "";
    res.redirect(`${frontendUrl}/login?error=google_auth_error`);
  }
});

export default router;
