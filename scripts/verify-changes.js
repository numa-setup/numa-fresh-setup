#!/usr/bin/env node
/**
 * verify-changes.js
 * Verifies that all Cursor-introduced changes are present in the Replit environment.
 * Run: node scripts/verify-changes.js
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function check(label, condition, hint = "") {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${hint ? `\n       → ${hint}` : ""}`);
    failed++;
  }
}

function fileExists(relPath) {
  return existsSync(resolve(root, relPath));
}

function fileContains(relPath, ...strings) {
  if (!fileExists(relPath)) return false;
  const content = readFileSync(resolve(root, relPath), "utf8");
  return strings.every((s) => content.includes(s));
}

// ─── 1. OTP Auth ─────────────────────────────────────────────────────────────
console.log("\n── OTP / Passwordless Auth ──────────────────────────────────");

check(
  "OTP route file exists (auth-otp.ts)",
  fileExists("artifacts/api-server/src/routes/auth-otp.ts"),
  "Expected at artifacts/api-server/src/routes/auth-otp.ts"
);

check(
  "OTP router exports POST /send-otp",
  fileContains("artifacts/api-server/src/routes/auth-otp.ts", "send-otp"),
  "POST /send-otp endpoint missing from auth-otp.ts"
);

check(
  "OTP router exports POST /verify-otp",
  fileContains("artifacts/api-server/src/routes/auth-otp.ts", "verify-otp"),
  "POST /verify-otp endpoint missing from auth-otp.ts"
);

check(
  "OTP router mounted in routes/index.ts",
  fileContains("artifacts/api-server/src/routes/index.ts", "auth-otp"),
  "authOtpRouter not imported/mounted in routes/index.ts"
);

check(
  "OtpLoginFlow frontend component exists",
  fileExists("artifacts/halal-grocery/src/components/auth/OtpLoginFlow.tsx"),
  "Expected at artifacts/halal-grocery/src/components/auth/OtpLoginFlow.tsx"
);

check(
  "Customer login page uses OtpLoginFlow",
  fileContains("artifacts/halal-grocery/src/pages/login.tsx", "OtpLoginFlow"),
  "login.tsx should import and render <OtpLoginFlow portal=\"customer\" />"
);

check(
  "Store login page uses OtpLoginFlow",
  fileContains(
    "artifacts/halal-grocery/src/pages/store-login.tsx",
    "OtpLoginFlow"
  ),
  "store-login.tsx should import and render <OtpLoginFlow portal=\"seller\" />"
);

// ─── 2. Payment / Stripe Integration ─────────────────────────────────────────
console.log("\n── Stripe / Payment Integration ─────────────────────────────");

check(
  "Stripe checkout route file exists (stripe-checkout.ts)",
  fileExists("artifacts/api-server/src/routes/stripe-checkout.ts"),
  "Expected at artifacts/api-server/src/routes/stripe-checkout.ts"
);

check(
  "Payments route file exists (payments.ts)",
  fileExists("artifacts/api-server/src/routes/payments.ts"),
  "Expected at artifacts/api-server/src/routes/payments.ts"
);

check(
  "Stripe mounted in routes/index.ts",
  fileContains(
    "artifacts/api-server/src/routes/index.ts",
    "stripe"
  ),
  "Stripe routes not imported in routes/index.ts"
);

check(
  "STRIPE_SECRET_KEY referenced in payment code",
  fileContains(
    "artifacts/api-server/src/routes/stripe-checkout.ts",
    "STRIPE_SECRET_KEY"
  ),
  "STRIPE_SECRET_KEY env var not referenced — Stripe won't initialise"
);

check(
  "Stripe package installed in api-server",
  fileContains("artifacts/api-server/package.json", "stripe"),
  "Run: pnpm --filter @workspace/api-server add stripe"
);

// ─── 3. Connectivity Fixes (Replit-specific) ─────────────────────────────────
console.log("\n── Replit Connectivity Fixes ────────────────────────────────");

check(
  "Vite proxy /api → localhost:8080 configured",
  fileContains(
    "artifacts/halal-grocery/vite.config.ts",
    '"/api"',
    "localhost:8080"
  ),
  "Add proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } to vite.config.ts server block"
);

check(
  "Vite HMR clientPort set (WebSocket fix)",
  fileContains("artifacts/halal-grocery/vite.config.ts", "clientPort"),
  "Add hmr: { clientPort: port } inside server block in vite.config.ts"
);

check(
  "api.ts uses relative URLs (no hardcoded host)",
  fileContains("artifacts/halal-grocery/src/lib/api.ts", "/api${normalizedPath}") ||
  fileContains("artifacts/halal-grocery/src/lib/api.ts", "`/api") &&
    !fileContains("artifacts/halal-grocery/src/lib/api.ts", "localhost:8080"),
  "Ensure getApiUrl in api.ts returns a relative path like '/api/...', not 'http://localhost:8080'"
);

// ─── 4. New Pages / Routes ────────────────────────────────────────────────────
console.log("\n── New Pages & Routes ───────────────────────────────────────");

check(
  "/stores browsing page exists",
  fileExists("artifacts/halal-grocery/src/pages/stores.tsx"),
  "Create artifacts/halal-grocery/src/pages/stores.tsx"
);

check(
  "/stores route registered in App.tsx",
  fileContains("artifacts/halal-grocery/src/App.tsx", "/stores"),
  "Add <Route path='/stores' component={StoresPage} /> to App.tsx"
);

check(
  "/products route registered in App.tsx",
  fileContains("artifacts/halal-grocery/src/App.tsx", "/products"),
  "Add <Route path='/products' component={ProductsPage} /> to App.tsx"
);

// ─── 5. Environment Variables ─────────────────────────────────────────────────
console.log("\n── Environment Variables ────────────────────────────────────");

const envVars = [
  ["STRIPE_SECRET_KEY",    "Stripe payment processing (secret key, sk_test_...)"],
  ["STRIPE_PUBLISHABLE_KEY","Stripe frontend key (pk_test_...)"],
  ["STRIPE_WEBHOOK_SECRET","Stripe webhook signature verification (whsec_...)"],
  ["RESEND_API_KEY",       "Email sending for OTP codes (re_...)"],
  ["NEON_URL",             "PostgreSQL connection string (Neon.tech)"],
  ["SESSION_SECRET",       "JWT access token signing secret (falls back to dev default if unset)"],
  ["OTP_EXPIRY_MINUTES",   "OTP code expiry window (default: 10)"],
  ["OTP_LENGTH",           "OTP code digit length (default: 6)"],
];

for (const [name, description] of envVars) {
  const present = !!process.env[name];
  const isOptional = ["STRIPE_SECRET_KEY","STRIPE_PUBLISHABLE_KEY","STRIPE_WEBHOOK_SECRET","RESEND_API_KEY","OTP_EXPIRY_MINUTES","OTP_LENGTH","SESSION_SECRET"].includes(name);
  if (present) {
    check(`${name} is set`, true);
  } else if (isOptional) {
    console.log(`  ⚠️   ${name} not set — ${description}`);
  } else {
    check(`${name} is set`, false, description);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────────────────────");
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("  🎉  All checks passed — Cursor changes are intact in Replit!\n");
} else {
  console.log(`  ⚠️   ${failed} check(s) failed — see hints above to fix.\n`);
  process.exit(1);
}
