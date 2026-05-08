import { logger } from "./logger.js";

/**
 * Sends a welcome notification to a user after first login/signup.
 * No-op if messaging service is not configured.
 */
export async function ensureAdminWelcome(
  userId: string,
  role: "CUSTOMER" | "STORE_OWNER" | "STORE_STAFF" | "ADMIN"
): Promise<void> {
  logger.debug({ userId, role }, "ensureAdminWelcome: no-op (messaging service not configured)");
}

/**
 * Sends a welcome notification to a store owner after store approval.
 * No-op if messaging service is not configured.
 */
export async function ensureStoreWelcome(
  storeId: string,
  userId: string
): Promise<void> {
  logger.debug({ storeId, userId }, "ensureStoreWelcome: no-op (messaging service not configured)");
}
