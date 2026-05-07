import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, ShoppingBag, RefreshCw, ChevronLeft, ChevronRight,
  X, DollarSign, User, Store, Clock, CheckCircle, AlertTriangle, Download,
} from 'lucide-react';
import { api } from '@/lib/api';

type OStatus = '_all' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'IN_PREPARATION' | 'STORE_CONFIRMED' | 'OUT_FOR_DELIVERY';

const STATUS_TABS: { key: OStatus; label: string }[] = [
  { key: '_all', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'STORE_CONFIRMED', label: 'Confirmed' },
  { key: 'IN_PREPARATION', label: 'In Prep' },
  { key: 'OUT_FOR_DELIVERY', label: 'Delivery' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'REFUNDED', label: 'Refunded' },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  STORE_CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PREPARATION: 'bg-purple-100 text-purple-800',
  REPLACEMENT_HANDLING: 'bg-orange-100 text-orange-800',
  READY_FOR_PICKUP: 'bg-teal-100 text-teal-800',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
};

interface OrderRow {
  id: string; orderNumber: string; status: string; orderType: string;
  subtotal: number; estimatedTotal: number; finalTotal: number;
  createdAt: string; paymentStatus: string;
  customerFirst: string; customerLast: string; storeName: string;
}

interface OrderDetail extends OrderRow {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  store: { name: string; city: string; phone: string };
  items: { id: string; name: string; quantity: number; unit: string; unitPrice: number; totalPrice: number }[];
  history: { id: string; status: string; note: string; createdAt: string }[];
  cancelReason: string; refundAmount: number; refundedAt: string;
  specialInstructions: string; discount: number; tip: number; deliveryFee: number;
}

export default function AdminOrders() {
  const [status, setStatus] = useState<OStatus>('_all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const data = await api.get(`/admin/orders?${params}`);
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {}
    setLoading(false);
  }, [status, page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, search]);

  const openDetail = async (id: string) => {
    setSelected(id);
    setDetailLoading(true);
    try {
      setDetail(await api.get(`/admin/orders/${id}`));
    } catch {}
    setDetailLoading(false);
  };

  const doRefund = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/orders/${detail.id}/refund`, { amount: Number(refundAmount), reason: refundReason });
      setRefundModal(false);
      await openDetail(detail.id);
      await load();
    } catch {}
    setActionLoading(false);
  };

  const forceComplete = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/orders/${detail.id}/force-complete`, {});
      await openDetail(detail.id);
      await load();
    } catch {}
    setActionLoading(false);
  };

  return (
    <AdminLayout title="Orders" subtitle={`${total} orders total`}>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button key={tab.key} onClick={() => setStatus(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === tab.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Order number…" className="pl-8 h-9 text-sm rounded-xl w-48" />
            </div>
            <Button variant="outline" size="sm" onClick={load} className="rounded-xl h-9"><RefreshCw className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 text-xs" onClick={() => {
              if (!orders.length) return;
              const rows = [
                ['Order #', 'Status', 'Type', 'Customer', 'Store', 'Amount', 'Date'],
                ...orders.map(o => [
                  o.orderNumber, o.status, o.orderType,
                  `${o.customerFirst} ${o.customerLast}`, o.storeName,
                  (o.finalTotal ?? o.estimatedTotal ?? 0).toFixed(2),
                  new Date(o.createdAt).toLocaleDateString(),
                ]),
              ];
              const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
            }}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* Table */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-xl border border-border/50 overflow-hidden overflow-x-auto">
              <div className="min-w-[340px] grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b border-border/50 bg-muted/30">
                <span>Order</span><span className="text-center">Type</span><span className="text-center">Amount</span><span className="text-center">Status</span>
              </div>
              {loading ? (
                Array(8).fill(0).map((_, i) => <div key={i} className="h-14 border-b border-border/30 bg-muted/10 animate-pulse" />)
              ) : orders.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No orders found</p>
                </div>
              ) : orders.map(order => (
                <div key={order.id} onClick={() => openDetail(order.id)}
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors ${selected === order.id ? 'bg-primary/5' : ''}`}>
                  <div>
                    <div className="font-mono text-xs font-semibold leading-none">{order.orderNumber}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {order.customerFirst} {order.customerLast} · {order.storeName}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">{new Date(order.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className="text-[10px] text-center text-muted-foreground leading-tight px-1">{order.orderType?.replace(/_/g, '\n')}</span>
                  <span className="text-xs font-semibold text-right">${(order.finalTotal ?? order.estimatedTotal ?? 0).toFixed(2)}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase text-center ${STATUS_STYLE[order.status] ?? 'bg-muted'}`}>
                    {order.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl h-8 px-3">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-xl h-8 px-3">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="xl:col-span-2">
            <AnimatePresence>
              {selected && detail ? (
                <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-white rounded-xl border border-border/50 overflow-hidden sticky top-4">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
                    <div>
                      <p className="font-mono text-xs font-bold">{detail.orderNumber}</p>
                      <p className="text-white/60 text-[10px]">{new Date(detail.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_STYLE[detail.status] ?? 'bg-muted'}`}>
                        {detail.status?.replace(/_/g, ' ')}
                      </span>
                      <button onClick={() => { setSelected(null); setDetail(null); }} className="text-white/50 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {detailLoading ? (
                    <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-4 bg-muted animate-pulse rounded" />)}</div>
                  ) : (
                    <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                      {/* Customer + Store */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1.5"><User className="w-3.5 h-3.5 text-primary" /><span className="text-[11px] font-semibold">Customer</span></div>
                          <p className="text-xs">{detail.customer?.firstName} {detail.customer?.lastName}</p>
                          <p className="text-[10px] text-muted-foreground">{detail.customer?.email}</p>
                          <p className="text-[10px] text-muted-foreground">{detail.customer?.phone}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1.5"><Store className="w-3.5 h-3.5 text-primary" /><span className="text-[11px] font-semibold">Store</span></div>
                          <p className="text-xs">{detail.store?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{detail.store?.city}</p>
                          <p className="text-[10px] text-muted-foreground">{detail.store?.phone}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div>
                        <p className="text-[11px] font-semibold mb-1.5">Order Items</p>
                        <div className="space-y-1">
                          {(detail.items ?? []).map(item => (
                            <div key={item.id} className="flex items-center justify-between text-xs">
                              <span className="truncate">{item.name} <span className="text-muted-foreground">×{item.quantity} {item.unit}</span></span>
                              <span className="font-medium shrink-0 ml-2">${item.totalPrice.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Financials */}
                      <div className="border-t border-border/50 pt-3 space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>${detail.subtotal?.toFixed(2)}</span></div>
                        {detail.deliveryFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Delivery Fee</span><span>${detail.deliveryFee?.toFixed(2)}</span></div>}
                        {detail.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-${detail.discount?.toFixed(2)}</span></div>}
                        {detail.tip > 0 && <div className="flex justify-between text-muted-foreground"><span>Tip</span><span>${detail.tip?.toFixed(2)}</span></div>}
                        <div className="flex justify-between font-bold border-t border-border/50 pt-1 mt-1">
                          <span>Total</span><span>${(detail.finalTotal ?? detail.estimatedTotal ?? 0).toFixed(2)}</span>
                        </div>
                        {detail.refundAmount > 0 && <div className="flex justify-between text-orange-600 font-medium"><span>Refunded</span><span>-${detail.refundAmount?.toFixed(2)}</span></div>}
                      </div>

                      {/* History */}
                      {(detail.history ?? []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold mb-1.5">Status History</p>
                          <div className="space-y-1.5">
                            {detail.history.slice(0, 5).map(h => (
                              <div key={h.id} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <div>
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${STATUS_STYLE[h.status] ?? 'bg-muted'}`}>{h.status?.replace(/_/g, ' ')}</span>
                                  {h.note && <p className="text-[10px] text-muted-foreground mt-0.5">{h.note}</p>}
                                  <p className="text-[9px] text-muted-foreground/60">{new Date(h.createdAt).toLocaleString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        {['COMPLETED', 'REFUNDED', 'CANCELLED'].includes(detail.status) ? null : (
                          <Button size="sm" variant="outline" onClick={forceComplete} disabled={actionLoading}
                            className="w-full rounded-xl h-8 text-xs gap-1.5 border-green-200 text-green-700 hover:bg-green-50">
                            <CheckCircle className="w-3 h-3" /> Force Complete
                          </Button>
                        )}
                        {!['REFUNDED', 'PENDING'].includes(detail.status) && (
                          <Button size="sm" variant="outline" onClick={() => { setRefundAmount(String((detail.finalTotal ?? detail.estimatedTotal ?? 0).toFixed(2))); setRefundModal(true); }}
                            className="w-full rounded-xl h-8 text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50">
                            <DollarSign className="w-3 h-3" /> Issue Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground text-sm">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Click an order to view details</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Refund Modal */}
      <AnimatePresence>
        {refundModal && detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
              <h3 className="font-serif font-bold text-lg mb-1">Issue Refund</h3>
              <p className="text-sm text-muted-foreground mb-4">Order {detail.orderNumber}</p>
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="0.00" className="rounded-xl pl-7" />
                </div>
                <Input value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason for refund…" className="rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRefundModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={doRefund} disabled={!refundAmount || !refundReason || actionLoading} className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700">Refund</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
