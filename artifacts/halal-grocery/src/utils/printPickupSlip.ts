/**
 * Generates and opens a world-class print slip for a pickup order.
 * Black-and-white, print-friendly, inspired by Whole Foods / Amazon retail receipts.
 */

interface SlipItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  finalPrice?: number;
}

interface SlipOrder {
  orderNumber: string;
  status: string;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  convenienceFee?: number;
  tip?: number;
  estimatedTotal?: number | null;
  finalTotal?: number | null;
  pickupQrCode?: string | null;
  readyAt?: string | null;
  createdAt?: string;
  store?: {
    name?: string;
    address?: string;
    city?: string;
    phone?: string;
  } | null;
  customer?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  } | null;
  items?: SlipItem[];
}

function derivePickupCode(order: SlipOrder): string {
  const existing = order.pickupQrCode;
  if (existing && existing.startsWith('PKP-') && existing.length <= 15) return existing;
  return '—';
}

function fmt(val?: number | null): string {
  if (val == null || isNaN(Number(val))) return '$0.00';
  return `$${Number(val).toFixed(2)}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtValidUntil(order: SlipOrder): string {
  const base = order.readyAt ? new Date(order.readyAt) : new Date();
  const exp = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  return exp.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function printPickupSlip(order: SlipOrder, qrDataUrl?: string): void {
  const storeName = order.store?.name || 'Numa Fresh';
  const storeAddress = order.store?.address || '';
  const storeCity = order.store?.city || '';
  const storePhone = order.store?.phone || '';
  const customerName = order.customer
    ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Customer'
    : 'Customer';
  const customerPhone = order.customer?.phone || '';

  const items = order.items || [];
  const pickupCode = derivePickupCode(order);

  const subtotal = Number(order.subtotal ?? 0);
  const discount = Number(order.discount ?? 0);
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const convFee = Number(order.convenienceFee ?? 0);
  const tip = Number(order.tip ?? 0);
  const total = Number(order.finalTotal ?? order.estimatedTotal ?? 0);

  const itemsHtml = items.map(item => {
    const price = Number(item.finalPrice ?? item.totalPrice ?? 0);
    const qty = Number(item.quantity);
    return `
      <tr>
        <td class="item-name">${item.name || 'Item'}</td>
        <td class="item-qty">x${qty}</td>
        <td class="item-price">${fmt(price)}</td>
      </tr>`;
  }).join('');

  const feesHtml = [
    discount > 0 ? `<tr class="discount-row"><td colspan="2">Discount</td><td>-${fmt(discount)}</td></tr>` : '',
    deliveryFee > 0 ? `<tr><td colspan="2">Delivery Fee</td><td>${fmt(deliveryFee)}</td></tr>` : '',
    convFee > 0 ? `<tr><td colspan="2">Convenience Fee</td><td>${fmt(convFee)}</td></tr>` : '',
    tip > 0 ? `<tr><td colspan="2">Tip</td><td>${fmt(tip)}</td></tr>` : '',
  ].filter(Boolean).join('');

  const qrSection = qrDataUrl
    ? `<div class="qr-wrapper"><img src="${qrDataUrl}" alt="Pickup QR Code" class="qr-img" /></div>`
    : `<div class="qr-placeholder">[QR CODE]</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pickup Slip — #${order.orderNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');

    @page {
      size: 80mm auto;
      margin: 0;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      background: #fff;
      color: #000;
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
      padding: 20px 16px 32px;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Header ── */
    .header {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 2px solid #000;
      margin-bottom: 10px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
    }
    .tagline {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #444;
      margin-top: 2px;
    }

    /* ── Dividers ── */
    .divider-double { border-top: 2px double #000; margin: 10px 0; }
    .divider-solid  { border-top: 1px solid #000; margin: 10px 0; }
    .divider-dashed { border-top: 1px dashed #555; margin: 10px 0; }

    /* ── Section titles ── */
    .section-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-align: center;
      padding: 4px 0;
    }
    .slip-type {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-align: center;
      padding: 6px 0;
    }

    /* ── Store / Order meta info ── */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 2px 0;
      vertical-align: top;
      font-size: 11px;
    }
    .meta-table td:first-child {
      white-space: nowrap;
      padding-right: 8px;
      color: #555;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-table td:last-child {
      font-weight: 600;
    }

    /* ── Items table ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table th {
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 3px 0;
      border-bottom: 1px solid #000;
      text-align: left;
    }
    .items-table th.right,
    .items-table td.right { text-align: right; }
    .items-table td {
      padding: 4px 0;
      border-bottom: 1px dashed #ccc;
      font-size: 11px;
      vertical-align: top;
    }
    .items-table tr:last-child td { border-bottom: none; }
    .item-name { max-width: 180px; }
    .item-qty  { text-align: center; white-space: nowrap; padding: 0 6px; color: #444; }
    .item-price{ text-align: right; white-space: nowrap; font-weight: 600; }

    /* ── Totals ── */
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 2px 0;
      font-size: 11px;
    }
    .totals-table td:last-child { text-align: right; }
    .discount-row td { color: #000; }
    .total-row td {
      font-size: 14px;
      font-weight: 700;
      padding-top: 6px;
      border-top: 2px solid #000;
    }

    /* ── QR Section ── */
    .pickup-section { text-align: center; padding: 8px 0; }
    .qr-wrapper { display: flex; justify-content: center; margin: 10px 0; }
    .qr-img { width: 150px; height: 150px; display: block; }
    .qr-placeholder {
      width: 150px; height: 150px;
      border: 2px dashed #000;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px;
      margin: 0 auto 10px;
    }

    .pickup-code-label {
      font-size: 9px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 4px;
    }
    .pickup-code {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 6px;
      margin: 6px 0;
      border: 2px solid #000;
      display: inline-block;
      padding: 4px 16px;
    }
    .pickup-meta {
      font-size: 10px;
      color: #333;
      margin-top: 4px;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding-top: 12px;
      border-top: 2px double #000;
      margin-top: 10px;
    }
    .footer-main { font-size: 12px; font-weight: 700; letter-spacing: 1px; }
    .footer-sub  { font-size: 10px; color: #444; font-style: italic; margin-top: 3px; }

    /* ── Print-only: hide everything else ── */
    @media print {
      body { padding: 0; max-width: 100%; }
      @page { size: 80mm auto; margin: 4mm; }
    }
  </style>
</head>
<body>

  <!-- ══ HEADER ══ -->
  <div class="header">
    <div class="logo-text">NUMA FRESH</div>
    <div class="tagline">Halal Marketplace</div>
  </div>

  <div class="divider-double"></div>
  <div class="slip-type">PICKUP ORDER SLIP</div>
  <div class="divider-double"></div>

  <!-- ══ STORE INFO ══ -->
  <table class="meta-table">
    <tr><td>Store</td>    <td>${storeName || 'N/A'}</td></tr>
    ${storeAddress ? `<tr><td>Address</td>  <td>${storeAddress}${storeCity ? ', ' + storeCity : ''}</td></tr>` : ''}
    ${storePhone  ? `<tr><td>Phone</td>    <td>${storePhone}</td></tr>` : ''}
    <tr><td>Date</td>     <td>${fmtDate(order.readyAt || order.createdAt)}</td></tr>
  </table>

  <div class="divider-dashed"></div>
  <div class="section-title">Order Details</div>
  <div class="divider-dashed"></div>

  <!-- ══ ORDER META ══ -->
  <table class="meta-table">
    <tr><td>Order ID</td>  <td>#${order.orderNumber}</td></tr>
    <tr><td>Customer</td>  <td>${customerName}</td></tr>
    ${customerPhone ? `<tr><td>Phone</td><td>${customerPhone}</td></tr>` : ''}
    <tr><td>Status</td>    <td>Ready for Pickup</td></tr>
  </table>

  <div class="divider-dashed"></div>
  <div class="section-title">Items</div>
  <div class="divider-dashed"></div>

  <!-- ══ ITEMS ══ -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th class="right">Price</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml || '<tr><td colspan="3" style="text-align:center;color:#555">No items</td></tr>'}
    </tbody>
  </table>

  <div class="divider-dashed"></div>

  <!-- ══ TOTALS ══ -->
  <table class="totals-table">
    <tr><td>Subtotal</td><td>${fmt(subtotal)}</td></tr>
    ${feesHtml}
    <tr class="total-row"><td>TOTAL</td><td>${fmt(total)}</td></tr>
  </table>

  <div class="divider-double"></div>
  <div class="section-title">Pickup Verification</div>
  <div class="divider-double"></div>

  <!-- ══ QR + PICKUP CODE ══ -->
  <div class="pickup-section">
    ${qrSection}
    <div class="pickup-code-label">Pickup Code</div>
    <div class="pickup-code">${pickupCode}</div>
    <div class="pickup-meta">Status: Ready for Pickup</div>
    <div class="pickup-meta">Valid Until: ${fmtValidUntil(order)}</div>
  </div>

  <div class="footer">
    <div class="footer-main">Thank you for choosing Numa Fresh!</div>
    <div class="footer-sub">Your Certified Halal Grocery Store</div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 300);
    });
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=500,height=800');
  if (!printWindow) {
    alert('Please allow popups to print the slip.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
