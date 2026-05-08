# Replit Setup Guide — Numa Fresh

This file documents exactly how to run the project on Replit without losing any Cursor-made changes.

---

## Architecture

| Layer      | Location                    | Port  |
|------------|-----------------------------|-------|
| Frontend   | `artifacts/halal-grocery`   | 5000  |
| API Server | `artifacts/api-server`      | 8080  |
| Database   | Neon.tech PostgreSQL (external) | —  |

The frontend Vite dev server proxies all `/api/*` requests to `http://localhost:8080`, so the browser never needs to reach port 8080 directly.

---

## Start Commands

Both services must be running simultaneously.

**Frontend (shown in Replit preview):**
```
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/halal-grocery run dev
```

**API Server:**
```
pnpm --filter @workspace/api-server run dev
```

The Replit workflows start both automatically. Use the **Run** button or the workflow panel.

---

## Required Environment Variables

Add these in **Replit Secrets** (Tools → Secrets). Do NOT paste them into code files.

### Required for core functionality

| Secret Name   | Description                                  | Example value                        |
|---------------|----------------------------------------------|--------------------------------------|
| `NEON_URL`    | PostgreSQL connection string (Neon.tech)     | `postgresql://user:pass@host/db`     |
| `SESSION_SECRET` | Secret used to sign JWT access tokens (has a dev fallback, but set in production) | any long random string |

### Required for OTP login (email verification)

| Secret Name          | Description                                  | Where to get it                      |
|----------------------|----------------------------------------------|--------------------------------------|
| `RESEND_API_KEY`     | Resend.com API key for sending OTP emails    | https://resend.com → API Keys        |
| `OTP_EXPIRY_MINUTES` | How long an OTP code is valid (default: 10)  | `10`                                 |
| `OTP_LENGTH`         | Number of digits in the OTP code (default: 6)| `6`                                  |

### Required for Stripe payments

| Secret Name              | Description                                   | Where to get it                         |
|--------------------------|-----------------------------------------------|-----------------------------------------|
| `STRIPE_SECRET_KEY`      | Stripe secret key (server-side)               | https://dashboard.stripe.com → API Keys |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (used in frontend)     | same page, pk_test_...                  |
| `STRIPE_WEBHOOK_SECRET`  | Stripe webhook signing secret                 | Stripe → Webhooks → Signing secret      |

### Optional / feature flags

| Secret Name             | Description                                    | Default |
|-------------------------|------------------------------------------------|---------|
| `FAST_DELIVERY_CHARGE`  | Extra charge for fast delivery orders (in $)   | `5.00`  |
| `PORT`                  | Frontend port (set by workflow, do not change) | `5000`  |

---

## What NOT to Change

| File                                        | Why                                                                 |
|---------------------------------------------|---------------------------------------------------------------------|
| `artifacts/halal-grocery/vite.config.ts`    | Contains Vite proxy (`/api → localhost:8080`) and HMR fix — do not remove |
| `artifacts/halal-grocery/src/lib/api.ts`    | Uses relative URLs (`/api/...`) — must NOT be changed to absolute URLs |
| `artifacts/halal-grocery/src/pages/login.tsx`       | Uses OtpLoginFlow — do not revert to plain email/password |
| `artifacts/halal-grocery/src/pages/store-login.tsx` | Uses OtpLoginFlow — do not revert to plain email/password |
| `artifacts/api-server/src/routes/auth-otp.ts`       | OTP auth backend logic — do not remove                  |
| `artifacts/api-server/src/routes/stripe-checkout.ts`| Stripe payment routes — do not remove                   |
| `.replit`                                   | Workflow configuration — do not change start commands               |

---

## Verifying Everything is in Place

Run the verification script any time to confirm all Cursor changes are present:

```bash
node scripts/verify-changes.js
```

Expected output when everything is correct:
```
── OTP / Passwordless Auth ──────────────────────────────────
  ✅  OTP route file exists (auth-otp.ts)
  ✅  OTP router exports POST /send-otp
  ✅  OTP router exports POST /verify-otp
  ...
  🎉  All checks passed — Cursor changes are intact in Replit!
```

---

## How OTP Login Works

1. User enters email → frontend calls `POST /api/auth/send-otp`
2. API server generates a 6-digit code, stores it in `email_otp_codes` table, sends via Resend
3. User enters code → frontend calls `POST /api/auth/verify-otp`
4. On success, API returns `accessToken` + `refreshToken` (JWT)
5. Tokens stored in `sessionStorage`, sent as `Authorization: Bearer` on all subsequent requests

**OTP will not send emails until `RESEND_API_KEY` is added to Replit Secrets.**

---

## How Stripe Works

1. Checkout sends cart to `POST /api/create-payment-intent` → returns `clientSecret`
2. Frontend uses Stripe.js with `STRIPE_PUBLISHABLE_KEY` to collect card details
3. On payment success, frontend calls `POST /api/confirm-order` to persist the order
4. Stripe webhooks (configured in Stripe dashboard) hit `POST /api/webhooks/stripe`

**Stripe will return 503 until `STRIPE_SECRET_KEY` is added to Replit Secrets.**

---

## Test Credentials (Development Only)

| Role        | Email                              | Password      |
|-------------|------------------------------------|---------------|
| Admin       | admin@numafreshmarketplace.com     | Admin@123     |
| Store Owner | owner1@halalmarket.com             | Owner@123     |
| Customer    | customer1@example.com              | Customer@123  |

> Note: These accounts use the legacy password login path (`POST /api/auth/login`).  
> New accounts created via the app use the OTP flow.

---

## Database Migrations

If the schema has changed and columns are missing in production:

```bash
# Apply schema to development DB
pnpm --filter @workspace/db run push

# Seed initial data
pnpm --filter @workspace/scripts run seed
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Stores / products not loading | Check API Server workflow is running; check browser console for proxy errors |
| OTP email not arriving | Confirm `RESEND_API_KEY` is set in Replit Secrets |
| Stripe returns 503 | Add `STRIPE_SECRET_KEY` to Replit Secrets |
| "Invalid token" on login | Confirm `SESSION_SECRET` is set in Replit Secrets |
| White screen on load | Open browser console; likely a JS crash — check workflow logs |
