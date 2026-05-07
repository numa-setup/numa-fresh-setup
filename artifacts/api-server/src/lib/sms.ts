import { logger } from "./logger.js";

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  try {
    const twilio = require("twilio");
    return twilio(sid, token);
  } catch {
    return null;
  }
}

const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER || "+15712645687";

export async function sendSMS(to: string, body: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client) {
    logger.warn("SMS not configured — skipping (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)");
    return false;
  }
  try {
    await client.messages.create({ from: FROM_PHONE, to, body });
    return true;
  } catch (err) {
    logger.error({ err }, "SMS send failed");
    return false;
  }
}

// ── SMS Templates ─────────────────────────────────────────────────────────────
export const smsTemplates = {
  orderConfirmed: (orderNumber: string, storeName: string) =>
    `✅ Numa Fresh: Your halal order #${orderNumber} is confirmed at ${storeName}. We'll notify you when it's ready! 🥩`,

  orderReady: (orderNumber: string, storeName: string, address: string) =>
    `🟢 Numa Fresh: Order #${orderNumber} is READY for pickup at ${storeName}, ${address}. Please show this SMS at the counter.`,

  orderReadyUrdu: (orderNumber: string, storeName: string) =>
    `🟢 Numa Fresh: آپ کا آرڈر #${orderNumber} تیار ہے۔ براہ کرم ${storeName} سے لے جائیں`,

  substitutionRequest: (originalItem: string, substituteItem: string, actionUrl: string) =>
    `⚠️ Numa Fresh: "${originalItem}" is unavailable. Substitute: "${substituteItem}"? Reply or visit: ${actionUrl}`,

  curbsideReady: (orderNumber: string, storeName: string) =>
    `🚗 Numa Fresh: Order #${orderNumber} is on its way to your vehicle at ${storeName}! Please stay in your car.`,

  loyaltyExpiring: (points: number, date: string) =>
    `⏰ Numa Fresh: ${points} loyalty points expire on ${date}. Shop now! numafresh.com`,
};
