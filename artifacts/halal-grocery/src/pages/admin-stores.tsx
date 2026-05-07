import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Store, CheckCircle, XCircle, Pause, Play, ChevronLeft, ChevronRight,
  RefreshCw, ExternalLink, SlidersHorizontal, Star, DollarSign, ShoppingBag,
  Phone, Mail, MapPin, Shield, AlertTriangle, X, Check, Eye, EyeOff, Clock,
  ToggleLeft, ToggleRight, Ban, ArrowUpRight, Pencil, Download,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type StoreStatus = 'all' | 'pending' | 'approved' | 'declined' | 'suspended';

interface StoreItem {
  id: string; slug: string; name: string; city: string; province: string;
  isActive: boolean; isApproved: boolean; isHalalCertified: boolean;
  storeStatus: string; showOnWebsite: boolean; isActiveManual: boolean; isCurrentlyOpen: boolean;
  commissionRate: number; rating: number; totalRatings: number;
  email: string; phone: string; createdAt: string;
  ownerFirst: string; ownerLast: string; ownerEmail: string;
  orderCount: number; revenue: number; onboardingCompleted: boolean;
}

interface StoreDetail extends StoreItem {
  description: string | null; tagline: string | null; branchName: string | null;
  address: string; postalCode: string; googleMapsLink: string | null;
  logo: string | null; banner: string | null; cardImage: string | null;
  halalCertNumber: string | null; rejectionReason: string | null;
  openingHoursJson: Record<string, { open: string; close: string; closed?: boolean }> | null;
  servicesOffered: string[] | null; amenityTags: string[] | null;
  minOrderAmount: number | null; convenienceFee: number | null; avgPrepTimeMinutes: number | null;
  pickupAvailable: boolean; curbsideAvailable: boolean; deliveryAvailable: boolean;
  premiumFreshEnabled: boolean;
  premiumFreshHeading: string | null; premiumFreshDesc: string | null;
  premiumFreshCutTags: string[] | null;
  premiumFreshBullet1: string | null; premiumFreshBullet2: string | null; premiumFreshBullet3: string | null;
  premiumFreshButtonText: string | null; premiumFreshButtonLink: string | null;
  // /admin/stores/:id returns the owner as a nested object (not the flat
  // ownerFirst/ownerLast/ownerEmail keys used by the LIST endpoint inherited
  // via StoreItem). Detail-panel rendering uses this shape.
  owner: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null;
}

const STATUS_TABS: { key: StoreStatus; label: string; color: string }[] = [
  { key: 'all', label: 'All Stores', color: '' },
  { key: 'pending', label: 'Pending', color: 'text-amber-600' },
  { key: 'approved', label: 'Approved', color: 'text-green-600' },
  { key: 'declined', label: 'Declined', color: 'text-red-600' },
  { key: 'suspended', label: 'Suspended', color: 'text-orange-600' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    declined: 'bg-red-100 text-red-800 border-red-200',
    suspended: 'bg-orange-100 text-orange-800 border-orange-200',
  };
  return map[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function AdminStores() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<StoreStatus>('all');
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('');
  const [page, setPage] = useState(1);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [commissionEdit, setCommissionEdit] = useState('');
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  const [hoursForm, setHoursForm] = useState<Record<string, { open: string; close: string; closed?: boolean }>>({});
  const [savingHours, setSavingHours] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (status !== 'all') params.set('status', status);
      if (search) params.set('search', search);
      if (province) params.set('province', province);
      const data = await api.get<{ stores: any[]; total: number; totalPages: number }>(`/admin/stores?${params}`);
      setStores(data.stores ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e: any) {
      toast.error('Failed to load stores');
    }
    setLoading(false);
  }, [status, page, search, province]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, search, province]);

  const openDetail = async (store: StoreItem) => {
    setSelected(store);
    setEditingHours(false);
    setDetailLoading(true);
    try {
      setDetail(await api.get(`/admin/stores/${store.id}`));
    } catch {}
    setDetailLoading(false);
  };

  const doAction = async (action: string, storeId: string, body?: Record<string, unknown>) => {
    setActionLoading(action + storeId);
    try {
      await api.patch(`/admin/stores/${storeId}/${action}`, body ?? {});
      toast.success(`Store ${action}d successfully`);
      setShowDeclineModal(false);
      setShowSuspendModal(false);
      setSelected(null);
      setDetail(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} store`);
    }
    setActionLoading(null);
  };

  const doCommission = async (storeId: string) => {
    setActionLoading('commission' + storeId);
    try {
      await api.patch(`/admin/stores/${storeId}/commission`, { commissionRate: Number(commissionEdit) });
      toast.success('Commission rate updated');
      setShowCommissionModal(false);
      await load();
      if (selected?.id === storeId) await openDetail(selected!);
    } catch {}
    setActionLoading(null);
  };

  const pendingCount = stores.filter(s => (s.storeStatus || (s.isApproved ? 'approved' : 'pending')) === 'pending').length;

  return (
    <AdminLayout title="Store Management" subtitle={`${total} stores total`}>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button key={tab.key} onClick={() => setStatus(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${status === tab.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <span className={tab.color}>{tab.label}</span>
                {tab.key === 'pending' && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stores…" className="pl-8 h-9 text-sm rounded-xl w-48" />
            </div>
            <select
              value={province}
              onChange={e => setProvince(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[140px]"
            >
              <option value="">All States</option>
              {['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={load} className="rounded-xl h-9"><RefreshCw className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 text-xs" onClick={() => {
              if (!stores.length) return;
              const rows = [
                ['Store Name', 'City', 'Province', 'Status', 'Owner', 'Owner Email', 'Orders', 'Revenue', 'Rating', 'Joined'],
                ...stores.map(s => [
                  s.name, s.city, s.province, s.storeStatus || (s.isApproved ? 'approved' : 'pending'),
                  `${s.ownerFirst} ${s.ownerLast}`, s.ownerEmail,
                  s.orderCount, s.revenue?.toFixed(2), s.rating?.toFixed(1),
                  new Date(s.createdAt).toLocaleDateString(),
                ]),
              ];
              const csv = rows.map(r => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `stores-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
            }}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button
              size="sm"
              onClick={() => setLocation('/admin/stores/new')}
              className="rounded-xl h-9 hg-gradient-primary text-white border-0 gap-1.5"
            >
              <Store className="w-3.5 h-3.5" /> Add Store
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Store List */}
          <div className="xl:col-span-2 space-y-3">
            {loading ? (
              Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
            ) : stores.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No stores found</p>
              </div>
            ) : stores.map(store => {
              const stStatus = store.storeStatus || (store.isApproved ? 'approved' : 'pending');
              return (
                <motion.div key={store.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => openDetail(store)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${selected?.id === store.id ? 'ring-2 ring-primary border-transparent' : 'border-border/50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{store.name}</span>
                        {store.isHalalCertified && <Shield className="w-3.5 h-3.5 text-primary" />}
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase ${statusBadge(stStatus)}`}>
                          {stStatus}
                        </span>
                        {stStatus === 'approved' && (
                          <>
                            {store.isCurrentlyOpen
                              ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Open Now</span>
                              : <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Closed</span>
                            }
                            {!store.showOnWebsite && <span title="Hidden from website"><EyeOff className="w-3 h-3 text-muted-foreground" /></span>}
                          </>
                        )}
                        {!store.onboardingCompleted && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Setup Incomplete</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{store.city}, {store.province}</span>
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{store.rating?.toFixed(1)} ({store.totalRatings})</span>
                        <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{store.orderCount} orders</span>
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${(store.revenue || 0).toFixed(0)} GMV</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">Owner: {store.ownerFirst} {store.ownerLast} · {store.ownerEmail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-medium text-primary">{store.commissionRate}% fee</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(store.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Pagination */}
            {totalPages >= 1 && (
              <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Showing <strong className="text-foreground">{Math.min((page - 1) * 10 + 1, total)}–{Math.min(page * 10, total)}</strong> of <strong className="text-foreground">{total}</strong> store{total !== 1 ? 's' : ''}{province ? ` in ${province}` : ''}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg h-8 w-8 p-0">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                      return (
                        <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)} className="rounded-lg h-8 w-8 p-0 text-xs">{p}</Button>
                      );
                    })}
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg h-8 w-8 p-0">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div>
            <AnimatePresence>
              {selected ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-xl border border-border/50 overflow-hidden sticky top-4">
                  <div className="p-4 bg-slate-900 text-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-serif font-bold text-sm">{selected.name}</h3>
                        <p className="text-white/60 text-[11px]">{selected.city}, {selected.province}</p>
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${statusBadge(selected.storeStatus || 'pending')}`}>
                          {selected.storeStatus || 'pending'}
                        </span>
                      </div>
                      <button onClick={() => { setSelected(null); setDetail(null); }} className="text-white/50 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {detailLoading ? (
                    <div className="p-4 space-y-3">
                      {Array(6).fill(0).map((_, i) => <div key={i} className="h-4 bg-muted animate-pulse rounded" />)}
                    </div>
                  ) : detail ? (
                    <div className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
                      {/* Rejection reason if declined/suspended */}
                      {detail.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                          <p className="font-semibold mb-1">Reason:</p>
                          <p>{detail.rejectionReason}</p>
                        </div>
                      )}

                      {/* Draft-state hint (owner has saved partial setup but not submitted) */}
                      {detail.storeStatus === 'draft' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                          <p className="font-semibold mb-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Application not yet submitted
                          </p>
                          <p>The owner has saved partial setup data but has not clicked "Submit for Review". No approval action is available until they submit.</p>
                        </div>
                      )}

                      {/* Owner — sourced from the nested `owner` object returned by /admin/stores/:id,
                          falling back to the flat ownerFirst/Last/Email fields if the panel was opened
                          before the detail fetch resolved (those come from the LIST payload). */}
                      <div className="bg-muted/30 rounded-xl p-3 text-xs space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Owner</p>
                        <p className="font-semibold text-foreground">
                          {(detail.owner?.firstName ?? detail.ownerFirst ?? '')} {(detail.owner?.lastName ?? detail.ownerLast ?? '')}
                        </p>
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="break-all">{detail.owner?.email ?? detail.ownerEmail ?? '—'}</span>
                        </p>
                        {detail.owner?.phone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3 h-3" />{detail.owner.phone}</p>}
                      </div>

                      {/* Submitted application: identity */}
                      <div className="space-y-2 text-xs">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Application Details</p>
                        {detail.tagline && <p className="italic text-muted-foreground">"{detail.tagline}"</p>}
                        {detail.branchName && <p><span className="text-muted-foreground">Branch:</span> <span className="font-medium">{detail.branchName}</span></p>}
                        {detail.description && (
                          <div>
                            <p className="text-muted-foreground mb-1">Description:</p>
                            <p className="bg-muted/20 rounded-lg p-2 text-foreground/90 whitespace-pre-wrap">{detail.description}</p>
                          </div>
                        )}
                      </div>

                      {/* Contact + Address */}
                      <div className="space-y-2 text-xs">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact &amp; Location</p>
                        {detail.email && <div className="flex items-start gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="break-all">{detail.email}</span></div>}
                        {detail.phone && <div className="flex items-start gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5 mt-0.5 shrink-0" />{detail.phone}</div>}
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{[detail.address, detail.city, detail.province, detail.postalCode].filter(Boolean).join(', ')}</span>
                        </div>
                        {detail.googleMapsLink && (
                          <a href={detail.googleMapsLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" /> Open Google Maps
                          </a>
                        )}
                      </div>

                      {/* Brand visuals — let admin verify the URLs the owner pasted actually load */}
                      {(detail.logo || detail.banner || detail.cardImage) && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Brand Visuals</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Logo', url: detail.logo },
                              { label: 'Banner', url: detail.banner },
                              { label: 'Card', url: detail.cardImage },
                            ].map(({ label, url }) => (
                              <div key={label} className="space-y-1">
                                <p className="text-[10px] text-muted-foreground">{label}</p>
                                {url ? (
                                  <a href={url} target="_blank" rel="noreferrer" className="block">
                                    <img
                                      src={url}
                                      alt={label}
                                      className="w-full h-16 object-cover rounded-lg border border-border/50 bg-muted"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement!.querySelector('.broken') as HTMLElement | null)?.classList.remove('hidden'); }}
                                    />
                                    <span className="broken hidden text-[9px] text-red-600">Failed to load</span>
                                  </a>
                                ) : (
                                  <div className="w-full h-16 rounded-lg border border-dashed border-border/50 flex items-center justify-center text-[9px] text-muted-foreground">Not set</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Services & Operations */}
                      <div className="space-y-2 text-xs">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Services &amp; Operations</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.pickupAvailable && <Badge variant="secondary" className="text-[10px]">Pickup</Badge>}
                          {detail.curbsideAvailable && <Badge variant="secondary" className="text-[10px]">Curbside</Badge>}
                          {detail.deliveryAvailable && <Badge variant="secondary" className="text-[10px]">Delivery</Badge>}
                          {(detail.servicesOffered ?? []).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                        {(detail.amenityTags ?? []).length > 0 && (
                          <div>
                            <p className="text-muted-foreground mb-1">Amenities:</p>
                            <div className="flex flex-wrap gap-1">
                              {(detail.amenityTags ?? []).map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px]">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="bg-muted/30 rounded-lg p-2 text-center">
                            <p className="font-bold text-sm">${(detail.minOrderAmount ?? 0).toFixed(0)}</p>
                            <p className="text-[9px] text-muted-foreground">Min Order</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-2 text-center">
                            <p className="font-bold text-sm">${(detail.convenienceFee ?? 0).toFixed(2)}</p>
                            <p className="text-[9px] text-muted-foreground">Conv. Fee</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-2 text-center">
                            <p className="font-bold text-sm">{detail.avgPrepTimeMinutes ?? 0}m</p>
                            <p className="text-[9px] text-muted-foreground">Prep Time</p>
                          </div>
                        </div>
                      </div>

                      {/* Opening hours */}
                      {(() => {
                        const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
                        const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                        return (
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3 h-3" /> Opening Hours
                              </p>
                              {!editingHours ? (
                                <button
                                  onClick={() => { setHoursForm(detail.openingHoursJson ?? {}); setEditingHours(true); }}
                                  className="text-[10px] text-muted-foreground underline hover:text-foreground"
                                >Edit</button>
                              ) : (
                                <div className="flex gap-1.5">
                                  <button
                                    disabled={savingHours}
                                    onClick={async () => {
                                      setSavingHours(true);
                                      try {
                                        await api.patch(`/admin/stores/${detail.id}/opening-hours`, { openingHoursJson: hoursForm });
                                        setDetail({ ...detail, openingHoursJson: hoursForm });
                                        setEditingHours(false);
                                        toast.success('Opening hours saved');
                                      } catch { toast.error('Failed to save hours'); }
                                      finally { setSavingHours(false); }
                                    }}
                                    className="text-[10px] px-2 py-0.5 rounded bg-primary text-white font-medium disabled:opacity-50"
                                  >{savingHours ? '…' : 'Save'}</button>
                                  <button
                                    onClick={() => setEditingHours(false)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground"
                                  >Cancel</button>
                                </div>
                              )}
                            </div>
                            {editingHours ? (
                              <div className="space-y-1.5 pt-1">
                                {DAY_KEYS.map((key, i) => {
                                  const h = hoursForm[key] || { closed: true, open: '09:00', close: '21:00' };
                                  const isOpen = !h.closed;
                                  return (
                                    <div key={key} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] ${isOpen ? 'border-primary/20 bg-primary/5' : 'border-border/50'}`}>
                                      <span className="w-12 shrink-0 font-medium">{DAY_LABELS[i].slice(0,3)}</span>
                                      <button
                                        onClick={() => setHoursForm(prev => ({
                                          ...prev,
                                          [key]: { ...(prev[key] || { open: '09:00', close: '21:00' }), closed: isOpen }
                                        }))}
                                        className="shrink-0"
                                      >
                                        {isOpen ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                      </button>
                                      {isOpen ? (
                                        <div className="flex items-center gap-1 flex-1">
                                          <input type="time" value={h.open || '09:00'}
                                            onChange={e => setHoursForm(prev => ({ ...prev, [key]: { ...(prev[key] || { closed: false, close: '21:00' }), open: e.target.value } }))}
                                            className="h-6 w-24 rounded border border-border/70 bg-background px-1 text-[10px]" />
                                          <span className="text-muted-foreground">–</span>
                                          <input type="time" value={h.close || '21:00'}
                                            onChange={e => setHoursForm(prev => ({ ...prev, [key]: { ...(prev[key] || { closed: false, open: '09:00' }), close: e.target.value } }))}
                                            className="h-6 w-24 rounded border border-border/70 bg-background px-1 text-[10px]" />
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">Closed</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="bg-muted/20 rounded-lg p-2 space-y-0.5">
                                {(detail.openingHoursJson && Object.keys(detail.openingHoursJson).length > 0) ? (
                                  DAY_KEYS.map((d) => {
                                    const h = detail.openingHoursJson?.[d];
                                    return (
                                      <div key={d} className="flex justify-between text-[11px]">
                                        <span className="capitalize text-muted-foreground">{d.slice(0,3)}</span>
                                        <span className="font-mono">{!h || h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-[10px] text-muted-foreground italic">No hours set — click Edit to add</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Halal certification */}
                      <div className="bg-muted/20 rounded-xl p-3 text-xs space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Shield className="w-3 h-3" /> Halal Certification
                        </p>
                        <p>
                          Status: {detail.isHalalCertified
                            ? <span className="text-green-700 font-semibold">Certified</span>
                            : <span className="text-amber-700 font-semibold">Not certified</span>}
                        </p>
                        {detail.halalCertNumber && <p className="text-muted-foreground">Cert #: <span className="font-mono text-foreground">{detail.halalCertNumber}</span></p>}
                      </div>

                      {/* Premium Fresh marketing block */}
                      {detail.premiumFreshEnabled && (detail.premiumFreshHeading || detail.premiumFreshDesc || (detail.premiumFreshCutTags?.length ?? 0) > 0) && (
                        <div className="border border-primary/20 bg-primary/5 rounded-xl p-3 text-xs space-y-1.5">
                          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Premium Fresh Section</p>
                          {detail.premiumFreshHeading && <p className="font-semibold">{detail.premiumFreshHeading}</p>}
                          {detail.premiumFreshDesc && <p className="text-muted-foreground">{detail.premiumFreshDesc}</p>}
                          {(detail.premiumFreshCutTags ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(detail.premiumFreshCutTags ?? []).map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px]">{t}</span>
                              ))}
                            </div>
                          )}
                          {[detail.premiumFreshBullet1, detail.premiumFreshBullet2, detail.premiumFreshBullet3].filter(Boolean).length > 0 && (
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {[detail.premiumFreshBullet1, detail.premiumFreshBullet2, detail.premiumFreshBullet3].filter(Boolean).map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          )}
                          {detail.premiumFreshButtonText && (
                            <p className="text-[10px] text-muted-foreground">CTA: <span className="font-medium text-foreground">{detail.premiumFreshButtonText}</span> {detail.premiumFreshButtonLink && <span className="font-mono">→ {detail.premiumFreshButtonLink}</span>}</p>
                          )}
                        </div>
                      )}

                      {/* Performance stats */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
                        {[
                          { label: 'Orders', value: detail.orderCount },
                          { label: 'GMV', value: `$${(detail.revenue || 0).toFixed(0)}` },
                          { label: 'Rating', value: (detail.rating || 0).toFixed(1) },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-muted/30 rounded-lg p-2 text-center">
                            <p className="font-bold text-sm">{value}</p>
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Visibility/Active toggles for approved stores */}
                      {detail.storeStatus === 'approved' && (
                        <div className="space-y-2 border border-border/50 rounded-xl p-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Store Controls</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs">Accepting Orders</span>
                            <button onClick={() => doAction('toggle-active', detail.id, { isActive: !detail.isActiveManual })}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${detail.isActiveManual ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                              {detail.isActiveManual ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                              {detail.isActiveManual ? 'ON' : 'OFF'}
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs">Visible on Website</span>
                            <button onClick={() => doAction('toggle-visibility', detail.id, { visible: !detail.showOnWebsite })}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${detail.showOnWebsite ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                              {detail.showOnWebsite ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              {detail.showOnWebsite ? 'Visible' : 'Hidden'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between py-2 border-y border-border/50">
                        <span className="text-xs text-muted-foreground">Commission Rate</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-primary">{detail.commissionRate}%</span>
                          <button onClick={() => { setCommissionEdit(String(detail.commissionRate)); setShowCommissionModal(true); }}
                            className="text-[10px] text-muted-foreground underline hover:text-foreground">Edit</button>
                        </div>
                      </div>

                      {/* Actions based on status */}
                      {/* Edit Store button */}
                      <Button
                        size="sm"
                        onClick={() => setLocation(`/admin/stores/${detail.id}/edit`)}
                        className="w-full rounded-xl h-9 text-xs gap-1.5 hg-gradient-primary border-0 text-white"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Store Info
                      </Button>

                      <div className="space-y-2">
                        {/* Pending: approve or decline */}
                        {(detail.storeStatus === 'pending' || (!detail.storeStatus && !detail.isApproved)) && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" onClick={() => doAction('approve', detail.id)}
                              disabled={!!actionLoading} className="rounded-xl gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                              <Check className="w-3 h-3" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowDeclineModal(true)}
                              className="rounded-xl gap-1.5 h-8 text-xs border-red-200 text-red-600 hover:bg-red-50">
                              <X className="w-3 h-3" /> Decline
                            </Button>
                          </div>
                        )}
                        {/* Declined: re-approve */}
                        {detail.storeStatus === 'declined' && (
                          <Button size="sm" onClick={() => doAction('approve', detail.id)}
                            disabled={!!actionLoading} className="w-full rounded-xl gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                            <Check className="w-3 h-3" /> Approve Now
                          </Button>
                        )}
                        {/* Approved: suspend */}
                        {detail.storeStatus === 'approved' && (
                          <Button size="sm" variant="outline" onClick={() => setShowSuspendModal(true)}
                            disabled={!!actionLoading} className="w-full rounded-xl gap-1.5 h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50">
                            <Ban className="w-3 h-3" /> Suspend Store
                          </Button>
                        )}
                        {/* Suspended: unsuspend */}
                        {detail.storeStatus === 'suspended' && (
                          <Button size="sm" onClick={() => doAction('unsuspend', detail.id)}
                            disabled={!!actionLoading} className="w-full rounded-xl gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                            <Play className="w-3 h-3" /> Reactivate Store
                          </Button>
                        )}
                        {/* View store link */}
                        {detail.slug && (
                          <a href={`/stores/${detail.slug}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <ArrowUpRight className="w-3 h-3" /> View on website
                          </a>
                        )}
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground text-sm">
                  <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Click a store to view details</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Decline Modal */}
      <AnimatePresence>
        {showDeclineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
              <h3 className="font-serif font-bold text-lg mb-2">Decline Store Application</h3>
              <p className="text-sm text-muted-foreground mb-4">Provide a reason (will be sent to the store owner).</p>
              <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)}
                placeholder="e.g. Missing halal certification documents, incomplete business information..."
                className="w-full h-24 px-3 py-2 rounded-xl border border-input text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDeclineModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={() => selected && doAction('decline', selected.id, { reason: declineReason })}
                  disabled={!declineReason.trim() || !!actionLoading} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white border-0">
                  Decline Store
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Suspend Modal */}
      <AnimatePresence>
        {showSuspendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg">Suspend Store</h3>
                  <p className="text-xs text-muted-foreground">{selected?.name}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">This will hide the store from the website and disable orders.</p>
              <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension (optional)"
                className="w-full h-20 px-3 py-2 rounded-xl border border-input text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSuspendModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={() => selected && doAction('suspend', selected.id, { reason: suspendReason || undefined })}
                  disabled={!!actionLoading} className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white border-0">
                  Suspend Store
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Commission Modal */}
      <AnimatePresence>
        {showCommissionModal && detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
              <h3 className="font-serif font-bold text-lg mb-1">Edit Commission Rate</h3>
              <p className="text-sm text-muted-foreground mb-4">{detail.name}</p>
              <div className="relative mb-4">
                <Input type="number" min="0" max="30" step="0.5" value={commissionEdit} onChange={e => setCommissionEdit(e.target.value)} className="rounded-xl pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">%</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCommissionModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={() => doCommission(detail.id)} disabled={!!actionLoading} className="flex-1 rounded-xl hg-gradient-primary border-0 text-white">Save</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
