import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface VerifyItem {
  name: string;
  quantity: number;
  price: string;
}

interface VerifyOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeOwnerId: string | null;
  orderDate: string;
  readyAt: string | null;
  completedAt: string | null;
  items: VerifyItem[];
  totalAmount: string;
  pickupCode: string;
  validUntil: string;
  isExpired: boolean;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBanner({ order }: { order: VerifyOrder }) {
  if (order.status === 'COMPLETED') {
    return (
      <div style={{ background: '#475569', color: '#fff', borderRadius: 16, padding: '16px 20px', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>📦</div>
        <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: 0.5 }}>Already Collected</div>
        {order.completedAt && (
          <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
            Picked up on {fmtDate(order.completedAt)}
          </div>
        )}
      </div>
    );
  }
  if (order.status === 'READY_FOR_PICKUP') {
    return (
      <div style={{ background: 'linear-gradient(135deg,#059669,#0d9488)', color: '#fff', borderRadius: 16, padding: '20px', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>✅</div>
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>ORDER VERIFIED</div>
        <div style={{ fontSize: 14, marginTop: 4, opacity: 0.9, fontWeight: 500 }}>Ready for Pickup</div>
      </div>
    );
  }
  // Other statuses
  return (
    <div style={{ background: '#0891b2', color: '#fff', borderRadius: 16, padding: '16px 20px', textAlign: 'center', marginBottom: 20 }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>🔄</div>
      <div style={{ fontWeight: 700, fontSize: 17 }}>Order in Progress</div>
      <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
        Status: {order.status.replace(/_/g, ' ')}
      </div>
    </div>
  );
}

export default function PickupVerifyPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading, isError, error } = useQuery<{ success: boolean; order: VerifyOrder }>({
    queryKey: ['pickup-verify', orderId],
    queryFn: () => api.get(`/pickup/verify/${orderId}`),
    retry: 1,
    staleTime: 30 * 1000,
  });

  const collectMutation = useMutation({
    mutationFn: () => api.post(`/pickup/verify/${orderId}/collect`, {}),
    onSuccess: () => {
      setConfirmed(true);
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ['pickup-verify', orderId] });
    },
  });

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={styles.page}>
        <Header />
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={styles.spinner} />
          <p style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>Loading order details…</p>
        </div>
      </div>
    );
  }

  // ── Error / Not Found ────────────────────────────────────────────────
  if (isError || !data?.success) {
    const msg = (error as any)?.message || '';
    const notFound = msg.includes('ORDER_NOT_FOUND') || msg.includes('404');
    return (
      <div style={styles.page}>
        <Header />
        <div style={{ ...styles.card, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <h2 style={{ fontWeight: 800, fontSize: 20, color: '#dc2626', marginBottom: 8 }}>
            {notFound ? 'Invalid QR Code' : 'Verification Error'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
            {notFound
              ? 'This QR code is invalid or the order could not be found. Please contact the store.'
              : 'Unable to load order details. Please try scanning again or contact the store.'}
          </p>
        </div>
        <PageFooter />
      </div>
    );
  }

  const order = data.order;

  // Is the current user authorized to mark as collected?
  const canCollect =
    user &&
    (user.role === 'ADMIN' ||
      ((user.role === 'STORE_OWNER' || user.role === 'STORE_STAFF') &&
        order.storeOwnerId === (user as any).userId));

  const alreadyCollected = order.status === 'COMPLETED' || confirmed;

  return (
    <div style={styles.page}>
      <Header />

      {/* Status Banner */}
      <StatusBanner order={confirmed ? { ...order, status: 'COMPLETED' } : order} />

      {/* Order Number */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>
          Order Number
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#0f172a', letterSpacing: 1 }}>
          #{order.orderNumber}
        </div>
      </div>

      {/* Info Cards */}
      <div style={styles.card}>
        <InfoRow icon="👤" label="Customer" value={order.customerName} />
        <Divider />
        <InfoRow icon="🏪" label="Store" value={order.storeName} sub={order.storeAddress} />
        {order.storePhone && (
          <>
            <Divider />
            <InfoRow icon="📞" label="Phone" value={order.storePhone} />
          </>
        )}
        <Divider />
        <InfoRow icon="📅" label="Order Date" value={fmtDate(order.orderDate)} />
        {order.readyAt && (
          <>
            <Divider />
            <InfoRow icon="🟢" label="Ready At" value={fmtDate(order.readyAt)} />
          </>
        )}
      </div>

      {/* Items */}
      <div style={styles.sectionTitle}>🛍️ Items</div>
      <div style={styles.card}>
        {order.items.map((item, i) => (
          <div key={i}>
            {i > 0 && <Divider />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', lineHeight: 1.4 }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  Qty: {item.quantity}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', whiteSpace: 'nowrap' }}>
                {item.price}
              </div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>💰 TOTAL</span>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#059669' }}>{order.totalAmount}</span>
        </div>
      </div>

      {/* Pickup Code */}
      <div style={styles.sectionTitle}>🔑 Pickup Verification</div>
      <div style={{ ...styles.card, textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
          Pickup Code
        </div>
        <div style={styles.pickupCode}>
          {order.pickupCode}
        </div>
        {order.status === 'READY_FOR_PICKUP' && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>✅</span>
            <span>Valid for pickup</span>
          </div>
        )}
      </div>

      {/* Mark as Collected — only for store staff/owner */}
      {canCollect && !alreadyCollected && order.status === 'READY_FOR_PICKUP' && (
        <div style={{ marginTop: 8 }}>
          {!showConfirm ? (
            <button
              style={styles.collectBtn}
              onClick={() => setShowConfirm(true)}
            >
              ✅ Mark as Collected
            </button>
          ) : (
            <div style={{ ...styles.card, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#0f172a' }}>
                Confirm Pickup
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Confirm pickup for <strong>{order.customerName}</strong>?<br />
                This action cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  style={{ ...styles.collectBtn, flex: 1, background: '#059669' }}
                  onClick={() => collectMutation.mutate()}
                  disabled={collectMutation.isPending}
                >
                  {collectMutation.isPending ? 'Marking…' : '✅ Confirm'}
                </button>
                <button
                  style={{ ...styles.cancelBtn, flex: 1 }}
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success after collect */}
      {(confirmed || (alreadyCollected && order.status !== 'COMPLETED')) && confirmed && (
        <div style={{ ...styles.card, background: '#f0fdf4', border: '1.5px solid #bbf7d0', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#166534' }}>Order Marked as Collected!</div>
          <div style={{ fontSize: 13, color: '#15803d', marginTop: 4 }}>Customer has received their order.</div>
        </div>
      )}

      <PageFooter />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header() {
  return (
    <div style={styles.header}>
      <div style={styles.logoIcon}>
        <span style={{ fontSize: 20, color: '#fff', fontWeight: 800, fontFamily: 'serif' }}>حل</span>
      </div>
      <div style={styles.logoText}>NUMA FRESH</div>
      <div style={styles.logoSub}>HALAL MARKETPLACE</div>
    </div>
  );
}

function PageFooter() {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0 12px', color: '#94a3b8', fontSize: 12 }}>
      <div style={{ marginBottom: 2, fontWeight: 600 }}>Numa Fresh • Halal Marketplace</div>
      <div>numafresh.com</div>
    </div>
  );
}

function InfoRow({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '4px 0' }}>
      <span style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid #f1f5f9', margin: '12px 0' }} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f0faf5',
    padding: '0 0 32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: 480,
    margin: '0 auto',
    color: '#1a1a1a',
  },
  header: {
    background: 'linear-gradient(135deg, #059669, #0d9488)',
    color: '#fff',
    padding: '28px 24px 24px',
    textAlign: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    width: 52,
    height: 52,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 10px',
    backdropFilter: 'blur(4px)',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  logoSub: {
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.85,
    marginTop: 2,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '18px 20px',
    margin: '0 16px 16px',
    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#475569',
    padding: '0 20px',
    marginBottom: 8,
  },
  pickupCode: {
    fontFamily: '"IBM Plex Mono", "Courier New", monospace',
    fontWeight: 800,
    fontSize: 36,
    letterSpacing: 6,
    color: '#059669',
    border: '2.5px solid #059669',
    borderRadius: 12,
    padding: '14px 24px',
    display: 'inline-block',
    background: '#f0fdf4',
  },
  collectBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #059669, #0d9488)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.3,
    margin: '0 16px',
    width: 'calc(100% - 32px)',
    display: 'block',
  } as React.CSSProperties,
  cancelBtn: {
    padding: '16px',
    background: '#fff',
    color: '#64748b',
    border: '1.5px solid #e2e8f0',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #e2e8f0',
    borderTopColor: '#059669',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
};
