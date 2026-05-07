import { db } from "@workspace/db";
import {
  chatConversationsTable,
  chatMessagesTable,
  usersTable,
  storesTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Acquire a Postgres transaction-scoped advisory lock on a string key.
 * Used to make read-then-insert idempotency safe under concurrency.
 */
async function withLock<T>(tx: any, key: string, fn: () => Promise<T>): Promise<T> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  return fn();
}

let _cachedAdminId: string | null = null;
async function getAdminId(): Promise<string | null> {
  if (_cachedAdminId) return _cachedAdminId;
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "ADMIN"))
    .orderBy(usersTable.createdAt)
    .limit(1);
  _cachedAdminId = admin?.id ?? null;
  return _cachedAdminId;
}

const WELCOME_FROM_ADMIN_TO_CUSTOMER =
  "Welcome to Numa Fresh! I'm here to help with anything you need — orders, halal questions, deliveries. Just send a message any time.";
const WELCOME_FROM_ADMIN_TO_OWNER =
  "Welcome to Numa Fresh! I'll be your point of contact for onboarding, payouts, and platform questions. Reach out any time.";

/**
 * Idempotently ensure an admin↔user welcome conversation exists.
 * Safe to call multiple times — only creates the conversation+message once.
 */
export async function ensureAdminWelcome(
  userId: string,
  userRole: "CUSTOMER" | "STORE_OWNER" | "STORE_STAFF" | "ADMIN"
): Promise<void> {
  if (userRole === "ADMIN") return;
  const adminId = await getAdminId();
  if (!adminId || adminId === userId) return;

  const isCustomer = userRole === "CUSTOMER";
  const convType = isCustomer ? "admin_customer" : "admin_store";
  const lockKey = `welcome:${convType}:${adminId}:${userId}`;

  await db.transaction(async (tx: any) => {
    await withLock(tx, lockKey, async () => {
      const where = isCustomer
        ? and(
            eq(chatConversationsTable.type, convType),
            eq(chatConversationsTable.adminId, adminId),
            eq(chatConversationsTable.customerId, userId)
          )
        : and(
            eq(chatConversationsTable.type, convType),
            eq(chatConversationsTable.adminId, adminId),
            eq(chatConversationsTable.storeOwnerId, userId)
          );

      const [existing] = await tx
        .select({ id: chatConversationsTable.id })
        .from(chatConversationsTable)
        .where(where)
        .limit(1);
      if (existing) return;

      const content = isCustomer
        ? WELCOME_FROM_ADMIN_TO_CUSTOMER
        : WELCOME_FROM_ADMIN_TO_OWNER;

      const [conv] = await tx
        .insert(chatConversationsTable)
        .values({
          type: convType,
          adminId,
          customerId: isCustomer ? userId : null,
          storeOwnerId: isCustomer ? null : userId,
          lastMessageText: content,
        })
        .returning();

      await tx.insert(chatMessagesTable).values({
        conversationId: conv.id,
        senderId: adminId,
        senderRole: "admin",
        content,
        metadata: { kind: "welcome" },
      });
    });
  });
}

/**
 * Idempotently ensure a store↔customer welcome conversation exists.
 * Called when a customer first visits a store page.
 */
export async function ensureStoreWelcome(
  storeId: string,
  customerId: string
): Promise<void> {
  const [store] = await db
    .select({
      id: storesTable.id,
      ownerId: storesTable.ownerId,
      name: storesTable.name,
    })
    .from(storesTable)
    .where(eq(storesTable.id, storeId))
    .limit(1);
  if (!store || !store.ownerId || store.ownerId === customerId) return;

  const lockKey = `welcome:store_customer:${storeId}:${customerId}`;
  await db.transaction(async (tx: any) => {
    await withLock(tx, lockKey, async () => {
      const [existing] = await tx
        .select({ id: chatConversationsTable.id })
        .from(chatConversationsTable)
        .where(
          and(
            eq(chatConversationsTable.type, "store_customer"),
            eq(chatConversationsTable.storeId, storeId),
            eq(chatConversationsTable.customerId, customerId)
          )
        )
        .limit(1);
      if (existing) return;

      const content = `Welcome to ${store.name}! Thanks for visiting our store. Send us a message any time if you have a question about our products, halal sourcing, or your order.`;

      const [conv] = await tx
        .insert(chatConversationsTable)
        .values({
          type: "store_customer",
          storeId,
          storeOwnerId: store.ownerId,
          customerId,
          lastMessageText: content,
        })
        .returning();

      await tx.insert(chatMessagesTable).values({
        conversationId: conv.id,
        senderId: store.ownerId,
        senderRole: "store_owner",
        content,
        metadata: { kind: "welcome" },
      });
    });
  });
}

/**
 * Find the current user's role within a conversation, or null if not a participant.
 *
 * Membership is determined by the conversation's recorded participant IDs.
 * Having the global ADMIN role does NOT grant access to conversations the user
 * is not a participant in (e.g. a store_customer thread between a different
 * store owner and a customer).
 */
export function participantRole(
  conv: {
    adminId: string | null;
    storeOwnerId: string | null;
    customerId: string | null;
  },
  userId: string,
  _userRole: string
): "admin" | "store_owner" | "customer" | null {
  if (conv.adminId === userId) return "admin";
  if (conv.storeOwnerId === userId) return "store_owner";
  if (conv.customerId === userId) return "customer";
  return null;
}
