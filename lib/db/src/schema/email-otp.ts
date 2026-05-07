import { pgTable, text, boolean, timestamp, integer, index, primaryKey } from "drizzle-orm/pg-core";

/** One-time codes for passwordless email login (hashed at rest). */
export const emailOtpCodesTable = pgTable(
  "email_otp_codes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    portal: text("portal").notNull(),
    hashedOtp: text("hashed_otp").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isUsed: boolean("is_used").notNull().default(false),
    /** After OTP verify for brand-new users; allows POST /complete-profile within this window. */
    pendingProfileExpiresAt: timestamp("pending_profile_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_otp_email_portal_created_idx").on(t.email, t.portal, t.createdAt),
    index("email_otp_expires_idx").on(t.expiresAt),
  ],
);

/** Tracks wrong OTP attempts and 15-minute lockouts per email + portal.s */
export const otpVerificationThrottleTable = pgTable(
  "otp_verification_throttle",
  {
    email: text("email").notNull(),
    portal: text("portal").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.email, t.portal] })],
);
