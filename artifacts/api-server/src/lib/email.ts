import nodemailer from "nodemailer";
import { logger } from "./logger.js";

const BRAND_COLOR = "#3FB196";
const GOLD_COLOR = "#D4AF37";
const BRAND_NAME = "Numa Fresh";
const BRAND_TAGLINE = "Premium Halal Grocery Marketplace";
const BRAND_LOGO_CHAR = "ج";

function createTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function baseTemplate(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${BRAND_NAME}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText}</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0d2e26,#1a4a3e);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:${BRAND_COLOR};display:inline-block;line-height:44px;font-size:20px;color:white;font-weight:bold;">${BRAND_LOGO_CHAR}</div>
            <div style="text-align:left;">
              <div style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${BRAND_NAME}</div>
              <div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:1px;text-transform:uppercase;">${BRAND_TAGLINE}</div>
            </div>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:white;padding:32px;border-left:1px solid #e8e8e4;border-right:1px solid #e8e8e4;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f9f7;border:1px solid #e8e8e4;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.6;">
            Serving the Muslim Community with ❤️
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#999;">
            ${BRAND_NAME} · 4773 Charter Ct, Woodbridge VA, USA
          </p>
          <p style="margin:0 0 12px;font-size:12px;color:#999;">
            📧 numasetup@gmail.com · 📞 +1 (571) 264-5687
          </p>
          <p style="margin:0;font-size:11px;color:#bbb;">
            <a href="{{unsubscribe_url}}" style="color:#bbb;text-decoration:underline;">Unsubscribe</a> · 
            <a href="{{privacy_url}}" style="color:#bbb;text-decoration:underline;">Privacy Policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:0.2px;">${text}</a>
  </div>`;
}

function statusBadge(status: string, color: string): string {
  return `<span style="display:inline-block;background:${color}15;color:${color};border:1px solid ${color}40;border-radius:20px;padding:4px 14px;font-size:13px;font-weight:600;">${status}</span>`;
}

function orderSummaryTable(orderNumber: string, items: Array<{ name: string; qty: number; price: number }>, total: number): string {
  const rows = items.map(i =>
    `<tr><td style="padding:8px 0;color:#333;font-size:14px;">${i.name} × ${i.qty}</td><td style="padding:8px 0;color:#333;font-size:14px;text-align:right;font-weight:600;">$${(i.price * i.qty).toFixed(2)}</td></tr>`
  ).join("");
  return `
    <div style="background:#f9f9f7;border-radius:12px;padding:20px;margin:20px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="font-weight:700;color:#111;">Order #${orderNumber}</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${rows}
        <tr><td colspan="2" style="border-top:1px solid #e0e0e0;padding-top:12px;margin-top:12px;"></td></tr>
        <tr><td style="padding:4px 0;font-weight:700;color:#111;font-size:15px;">Total</td><td style="padding:4px 0;font-weight:700;color:${BRAND_COLOR};font-size:15px;text-align:right;">$${total.toFixed(2)}</td></tr>
      </table>
    </div>`;
}

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    logger.warn("Email not configured — skipping email send");
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"${BRAND_NAME}" <${process.env.EMAIL_USER}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send email");
    return false;
  }
}

// ── Template builders ──────────────────────────────────────────────────────

export function orderConfirmedEmail(opts: {
  to: string; firstName: string; orderNumber: string; storeName: string;
  storeAddress: string; pickupTime: string; items: Array<{ name: string; qty: number; price: number }>;
  total: number; qrCode?: string;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">Order Confirmed! 🎉</h1>
    <p style="color:#555;margin:0 0 20px;">Assalamu Alaikum ${opts.firstName}, your halal order is confirmed.</p>
    ${statusBadge("✅ Order Confirmed", BRAND_COLOR)}
    ${orderSummaryTable(opts.orderNumber, opts.items, opts.total)}
    <div style="background:#e8f7f3;border-radius:12px;padding:16px 20px;margin:16px 0;">
      <p style="margin:0 0 6px;font-size:13px;color:#555;">📍 Pickup Location</p>
      <p style="margin:0;font-weight:600;color:#111;">${opts.storeName}</p>
      <p style="margin:4px 0 0;color:#555;font-size:13px;">${opts.storeAddress}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#555;">🕐 Ready at: <strong style="color:#0d2e26;">${opts.pickupTime}</strong></p>
    </div>
    ${ctaButton("Track My Order", `${process.env.FRONTEND_URL || "https://numafresh.com"}/account/orders`)}
    <p style="color:#888;font-size:13px;text-align:center;margin:16px 0 0;">Questions? Reply to this email or call +1 (571) 264-5687</p>`;
  return {
    to: opts.to,
    subject: `✅ Order Confirmed – #${opts.orderNumber} | ${BRAND_NAME}`,
    html: baseTemplate(content, `Your order #${opts.orderNumber} from ${opts.storeName} is confirmed!`),
  };
}

export function orderReadyEmail(opts: {
  to: string; firstName: string; orderNumber: string; storeName: string;
  storeAddress: string; qrCode?: string;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">Your Order is Ready! 🥩</h1>
    <p style="color:#555;margin:0 0 20px;">Assalamu Alaikum ${opts.firstName}, your halal order is freshly packed and ready for pickup.</p>
    ${statusBadge("🟢 Ready for Pickup", "#22c55e")}
    <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;color:#555;">Order Number</p>
      <p style="margin:0;font-size:28px;font-weight:800;color:#0d2e26;letter-spacing:2px;">#${opts.orderNumber}</p>
    </div>
    <div style="background:#e8f7f3;border-radius:12px;padding:16px 20px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#111;">📍 ${opts.storeName}</p>
      <p style="margin:4px 0 0;color:#555;font-size:13px;">${opts.storeAddress}</p>
    </div>
    <p style="color:#555;font-size:14px;text-align:center;">Please show your order number at the counter for pickup.</p>
    ${ctaButton("View Order & QR Code", `${process.env.FRONTEND_URL || "https://numafresh.com"}/account/orders`)}`;
  return {
    to: opts.to,
    subject: `🟢 Order Ready for Pickup – #${opts.orderNumber} | ${BRAND_NAME}`,
    html: baseTemplate(content, `Your order #${opts.orderNumber} is ready for pickup at ${opts.storeName}!`),
  };
}

export function orderCompletedEmail(opts: {
  to: string; firstName: string; orderNumber: string; total: number;
  loyaltyEarned: number; storeName: string;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">Order Complete – JazakAllah Khair! 🌙</h1>
    <p style="color:#555;margin:0 0 20px;">Assalamu Alaikum ${opts.firstName}, thank you for shopping with ${BRAND_NAME}.</p>
    ${statusBadge("✅ Completed", "#6366f1")}
    <div style="text-align:center;margin:24px 0;">
      <p style="margin:0 0 4px;color:#555;font-size:13px;">Order Total</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:${BRAND_COLOR};">$${opts.total.toFixed(2)}</p>
      <p style="margin:8px 0 0;color:#555;font-size:13px;">Order #${opts.orderNumber} from ${opts.storeName}</p>
    </div>
    ${opts.loyaltyEarned > 0 ? `
    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:12px;padding:16px 20px;margin:16px 0;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#92400e;">🌟 Loyalty Points Earned</p>
      <p style="margin:0;font-size:24px;font-weight:800;color:#92400e;">+${opts.loyaltyEarned} points</p>
    </div>` : ""}
    ${ctaButton("Leave a Review", `${process.env.FRONTEND_URL || "https://numafresh.com"}/account/orders`)}
    <p style="color:#888;font-size:13px;text-align:center;">May Allah bless your family with health and abundance. 🤲</p>`;
  return {
    to: opts.to,
    subject: `🧾 Order Receipt – #${opts.orderNumber} | ${BRAND_NAME}`,
    html: baseTemplate(content, `Your order is complete! You earned ${opts.loyaltyEarned} loyalty points.`),
  };
}

export function substitutionRequestEmail(opts: {
  to: string; firstName: string; orderNumber: string; originalItem: string;
  substituteItem: string; substitutePrice: number; actionUrl: string;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">Action Required: Item Substitution</h1>
    <p style="color:#555;margin:0 0 20px;">Assalamu Alaikum ${opts.firstName}, the store has a substitution request for your order.</p>
    ${statusBadge("⚠️ Substitution Requested", "#f59e0b")}
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:20px 0;">
      <div style="margin-bottom:12px;">
        <p style="margin:0 0 4px;font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Original Item</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;text-decoration:line-through;">${opts.originalItem}</p>
      </div>
      <div style="text-align:center;font-size:20px;color:#f59e0b;margin:8px 0;">↓ Proposed Substitution ↓</div>
      <div>
        <p style="margin:0 0 4px;font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Substitute Item</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${opts.substituteItem}</p>
        <p style="margin:4px 0 0;color:#555;font-size:13px;">Price: $${opts.substitutePrice.toFixed(2)}</p>
      </div>
    </div>
    <p style="color:#555;font-size:14px;text-align:center;">Please respond quickly to avoid delays in your order.</p>
    ${ctaButton("Accept or Reject Substitution", opts.actionUrl)}`;
  return {
    to: opts.to,
    subject: `⚠️ Substitution Request – Order #${opts.orderNumber} | ${BRAND_NAME}`,
    html: baseTemplate(content, `Action needed: Item substitution requested for order #${opts.orderNumber}`),
  };
}

export function newOrderStoreEmail(opts: {
  to: string; storeName: string; orderNumber: string;
  items: Array<{ name: string; qty: number; price: number }>; total: number;
  pickupTime: string; customerName: string; orderType: string;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">New Order Received! 🛒</h1>
    <p style="color:#555;margin:0 0 20px;">A new halal order has been placed at <strong>${opts.storeName}</strong>.</p>
    ${statusBadge("🆕 New Order", BRAND_COLOR)}
    ${orderSummaryTable(opts.orderNumber, opts.items, opts.total)}
    <div style="background:#e8f7f3;border-radius:12px;padding:16px 20px;margin:16px 0;">
      <p style="margin:0 0 8px;"><span style="color:#555;font-size:13px;">Customer:</span> <strong>${opts.customerName}</strong></p>
      <p style="margin:0 0 8px;"><span style="color:#555;font-size:13px;">Type:</span> <strong>${opts.orderType}</strong></p>
      <p style="margin:0;"><span style="color:#555;font-size:13px;">Pickup by:</span> <strong style="color:${BRAND_COLOR};">${opts.pickupTime}</strong></p>
    </div>
    ${ctaButton("Manage Order in Portal", `${process.env.FRONTEND_URL || "https://numafresh.com"}/store-portal/orders`)}`;
  return {
    to: opts.to,
    subject: `🛒 New Order #${opts.orderNumber} – ${opts.storeName} | ${BRAND_NAME}`,
    html: baseTemplate(content, `New order #${opts.orderNumber} received at ${opts.storeName}!`),
  };
}

export function refundProcessedEmail(opts: {
  to: string; firstName: string; orderNumber: string; amount: number;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">Refund Processed</h1>
    <p style="color:#555;margin:0 0 20px;">Assalamu Alaikum ${opts.firstName}, your refund has been processed.</p>
    ${statusBadge("💳 Refund Initiated", "#6366f1")}
    <div style="text-align:center;margin:24px 0;">
      <p style="margin:0 0 4px;color:#555;font-size:13px;">Refund Amount</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:#6366f1;">$${opts.amount.toFixed(2)}</p>
      <p style="margin:8px 0 0;color:#555;font-size:13px;">Order #${opts.orderNumber}</p>
    </div>
    <p style="color:#555;font-size:14px;text-align:center;">The refund will appear on your original payment method within 3–5 business days.</p>`;
  return {
    to: opts.to,
    subject: `💳 Refund Processed – $${opts.amount.toFixed(2)} | ${BRAND_NAME}`,
    html: baseTemplate(content, `Your refund of $${opts.amount.toFixed(2)} for order #${opts.orderNumber} is being processed.`),
  };
}

export function weeklyEarningsSummaryEmail(opts: {
  to: string; storeName: string; grossRevenue: number; commission: number;
  netPayout: number; orderCount: number; weekStart: string; weekEnd: string;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">Weekly Earnings Summary 📊</h1>
    <p style="color:#555;margin:0 0 20px;"><strong>${opts.storeName}</strong> — Week of ${opts.weekStart} to ${opts.weekEnd}</p>
    <div style="display:grid;gap:12px;margin:20px 0;">
      ${[
        { label: "Total Orders", value: `${opts.orderCount}`, color: "#3b82f6" },
        { label: "Gross Revenue", value: `$${opts.grossRevenue.toFixed(2)}`, color: BRAND_COLOR },
        { label: "Platform Commission (7%)", value: `-$${opts.commission.toFixed(2)}`, color: "#ef4444" },
        { label: "Net Payout", value: `$${opts.netPayout.toFixed(2)}`, color: GOLD_COLOR },
      ].map(({ label, value, color }) => `
        <div style="background:#f9f9f7;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#555;font-size:14px;">${label}</span>
          <span style="font-size:18px;font-weight:700;color:${color};">${value}</span>
        </div>`).join("")}
    </div>
    ${ctaButton("View Full Analytics", `${process.env.FRONTEND_URL || "https://numafresh.com"}/store-portal/analytics`)}`;
  return {
    to: opts.to,
    subject: `📊 Weekly Earnings: $${opts.netPayout.toFixed(2)} net – ${opts.storeName} | ${BRAND_NAME}`,
    html: baseTemplate(content, `Your weekly payout of $${opts.netPayout.toFixed(2)} from ${opts.orderCount} orders.`),
  };
}

export function loyaltyPointsExpiryEmail(opts: {
  to: string; firstName: string; points: number; expiryDate: string;
}): EmailPayload {
  const content = `
    <h1 style="font-size:24px;font-weight:700;color:#0d2e26;margin:0 0 8px;">Your Points Are Expiring Soon! ⏰</h1>
    <p style="color:#555;margin:0 0 20px;">Assalamu Alaikum ${opts.firstName}, don't let your loyalty points go to waste!</p>
    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 8px;color:#92400e;font-size:14px;">Expiring on ${opts.expiryDate}</p>
      <p style="margin:0;font-size:40px;font-weight:800;color:#92400e;">⭐ ${opts.points} Points</p>
      <p style="margin:8px 0 0;color:#92400e;font-size:13px;">Use them before they expire!</p>
    </div>
    ${ctaButton("Shop Now & Use Points", `${process.env.FRONTEND_URL || "https://numafresh.com"}/stores`)}
    <p style="color:#888;font-size:13px;text-align:center;">Every 100 points = $1 off your next order.</p>`;
  return {
    to: opts.to,
    subject: `⏰ ${opts.points} Points Expiring Soon | ${BRAND_NAME}`,
    html: baseTemplate(content, `${opts.points} loyalty points expiring on ${opts.expiryDate}. Use them now!`),
  };
}
