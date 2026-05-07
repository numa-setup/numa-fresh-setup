import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Package, Search, Trash2, Eye, EyeOff,
  Store, Clock, RefreshCw, AlertTriangle, Pencil, X,
  Download, ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_COLORS: Record<string, string> = {
  FRESH_MEAT: 'bg-red-100 text-red-700',
  PRODUCE: 'bg-green-100 text-green-700',
  SPICES: 'bg-orange-100 text-orange-700',
  PACKAGED: 'bg-blue-100 text-blue-700',
  DAIRY: 'bg-sky-100 text-sky-700',
  BAKERY: 'bg-amber-100 text-amber-700',
  FROZEN: 'bg-indigo-100 text-indigo-700',
  BEVERAGES: 'bg-cyan-100 text-cyan-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

function EditProductModal({ product, onClose }: { product: any; onClose: () => void }) {
  const qc = useQueryClient();
  const storeId = product.store?.id || product.storeId;

  const [name, setName] = useState(product.name || '');
  const [shortDesc, setShortDesc] = useState(product.shortDesc || '');
  const [description, setDescription] = useState(product.description || '');
  const [productDetails, setProductDetails] = useState(product.productDetails || '');
  const [ingredients, setIngredients] = useState(product.ingredients || '');
  const [directions, setDirections] = useState(product.directions || '');
  const [price, setPrice] = useState(String(product.price ?? ''));
  const [stockQty, setStockQty] = useState(String(product.stockQty ?? 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/admin/stores/${storeId}/products/${product.id}`, {
      name,
      shortDesc: shortDesc || null,
      description: description || null,
      productDetails: productDetails || null,
      ingredients: ingredients || null,
      directions: directions || null,
      price: Number(price) || 0,
      stockQty: Number(stockQty) || 0,
    }),
    onSuccess: () => {
      toast.success('Product updated');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      onClose();
    },
    onError: (e: any) => toast.error('Update failed: ' + e.message),
  });

  if (!storeId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-card rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
          <p className="text-sm text-destructive mb-3">Cannot edit: missing store reference for this product.</p>
          <Button onClick={onClose} variant="outline" className="w-full rounded-xl">Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border/50 p-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-semibold">Edit Product</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{product.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Price ($)</label>
                <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Stock</label>
                <Input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} className="mt-1 rounded-xl" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Short Description</label>
            <Input value={shortDesc} onChange={e => setShortDesc(e.target.value)} maxLength={140} className="mt-1 rounded-xl" placeholder="One-line summary" />
          </div>

          {([
            ['Full Description', description, setDescription, 'Detailed product description'],
            ['Product Details', productDetails, setProductDetails, 'Specs, weight, packaging, country of origin…'],
            ['Ingredients', ingredients, setIngredients, 'Comma-separated ingredient list'],
            ['Usage / Directions', directions, setDirections, 'How to prepare or use this product'],
          ] as const).map(([label, val, setter, ph]) => (
            <div key={label}>
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <textarea
                value={val}
                onChange={e => setter(e.target.value)}
                rows={3}
                placeholder={ph}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border/50 p-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
            className="flex-1 rounded-xl"
          >
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmModal({
  title, description, confirmLabel, confirmClass, onConfirm, onCancel,
}: {
  title: string; description: string; confirmLabel: string; confirmClass?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-serif font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{description}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
          <Button onClick={onConfirm} className={`flex-1 rounded-xl ${confirmClass || ''}`}>{confirmLabel}</Button>
        </div>
      </motion.div>
    </div>
  );
}

function Pagination({ page, totalPages, total, limit, label, onPageChange }: {
  page: number; totalPages: number; total: number; limit: number; label: string;
  onPageChange: (p: number) => void;
}) {
  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
      <p className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{start}–{end}</strong> of <strong className="text-foreground">{total}</strong> {label}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1} className="rounded-lg h-8 w-8 p-0">
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        {pages.map(p => (
          <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
            onClick={() => onPageChange(p)} className="rounded-lg h-8 w-8 p-0 text-xs">
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className="rounded-lg h-8 w-8 p-0">
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'pending'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<any | null>(null);

  // Pending tab state
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingSearchInput, setPendingSearchInput] = useState('');
  const [pendingStoreFilter, setPendingStoreFilter] = useState('');
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [pendingBulkAction, setPendingBulkAction] = useState('');
  const [showPendingBulkConfirm, setShowPendingBulkConfirm] = useState(false);
  const [showPendingBulkDropdown, setShowPendingBulkDropdown] = useState(false);

  // All products tab state
  const [allPage, setAllPage] = useState(1);
  const [allSearch, setAllSearch] = useState('');
  const [allSearchInput, setAllSearchInput] = useState('');
  const [allStoreFilter, setAllStoreFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAllBulkDropdown, setShowAllBulkDropdown] = useState(false);
  const [allBulkAction, setAllBulkAction] = useState('');
  const [showAllBulkConfirm, setShowAllBulkConfirm] = useState(false);

  // Debounce search inputs
  useEffect(() => {
    const t = setTimeout(() => { setPendingSearch(pendingSearchInput); setPendingPage(1); }, 300);
    return () => clearTimeout(t);
  }, [pendingSearchInput]);
  useEffect(() => {
    const t = setTimeout(() => { setAllSearch(allSearchInput); setAllPage(1); }, 300);
    return () => clearTimeout(t);
  }, [allSearchInput]);

  useEffect(() => { setPendingPage(1); setSelectedPendingIds(new Set()); }, [pendingSearch, pendingStoreFilter]);
  useEffect(() => { setAllPage(1); setSelectedIds(new Set()); }, [allSearch, allStoreFilter]);

  // Queries
  const { data: pendingData, isLoading: pendingLoading } = useQuery<any>({
    queryKey: ['admin', 'products', 'pending', pendingPage, pendingSearch, pendingStoreFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(pendingPage), limit: '20' });
      if (pendingSearch) params.set('search', pendingSearch);
      if (pendingStoreFilter) params.set('storeId', pendingStoreFilter);
      return api.get(`/admin/products/pending?${params}`);
    },
    enabled: user?.role === 'ADMIN',
  });

  const { data: pendingStoresData } = useQuery<any>({
    queryKey: ['admin', 'products', 'pending', 'stores'],
    queryFn: () => api.get('/admin/products/pending/stores'),
    enabled: user?.role === 'ADMIN',
  });

  const { data: allData, isLoading: allLoading } = useQuery<any>({
    queryKey: ['admin', 'products', 'all', allSearch, allPage, allStoreFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(allPage), limit: '20' });
      if (allSearch) params.set('search', allSearch);
      if (allStoreFilter) params.set('storeId', allStoreFilter);
      return api.get(`/admin/products?${params}`);
    },
    enabled: user?.role === 'ADMIN' && tab === 'all',
  });

  // All-stores list for "All Products" store filter
  const { data: allStoresData } = useQuery<any>({
    queryKey: ['admin', 'stores', 'list'],
    queryFn: () => api.get('/admin/stores?limit=100'),
    enabled: user?.role === 'ADMIN' && tab === 'all',
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/products/${id}/approve`, {}),
    onSuccess: () => { toast.success('Product approved!'); qc.invalidateQueries({ queryKey: ['admin', 'products'] }); setProcessing(null); },
    onError: (e: any) => { toast.error('Failed to approve: ' + e.message); setProcessing(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/products/${id}/reject`, { reason }),
    onSuccess: () => { toast.success('Product rejected.'); qc.invalidateQueries({ queryKey: ['admin', 'products'] }); setProcessing(null); },
    onError: (e: any) => { toast.error('Failed to reject: ' + e.message); setProcessing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/products/${id}`),
    onSuccess: () => { toast.success('Product deleted.'); qc.invalidateQueries({ queryKey: ['admin', 'products'] }); setProcessing(null); },
    onError: (e: any) => { toast.error('Failed to delete: ' + e.message); setProcessing(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/products/${id}/toggle-active`, {}),
    onSuccess: (data: any) => {
      toast.success(data.isActive ? 'Product restored' : 'Product suspended');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      setProcessing(null);
    },
    onError: (e: any) => { toast.error('Action failed: ' + e.message); setProcessing(null); },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, productIds }: { action: string; productIds: string[] }) =>
      api.post('/admin/products/bulk-action', { action, productIds }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Bulk action completed');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      setSelectedPendingIds(new Set());
      setSelectedIds(new Set());
      setShowPendingBulkConfirm(false);
      setShowAllBulkConfirm(false);
    },
    onError: (e: any) => toast.error('Bulk action failed: ' + e.message),
  });

  const handleApprove = (id: string) => { setProcessing(id); approveMutation.mutate(id); };
  const handleReject = (id: string) => {
    const reason = prompt('Rejection reason (visible to store owner):');
    if (reason === null) return;
    setProcessing(id);
    rejectMutation.mutate({ id, reason: reason || 'Does not meet halal standards' });
  };
  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setProcessing(id);
    deleteMutation.mutate(id);
  };
  const handleToggle = (id: string) => { setProcessing(id); toggleMutation.mutate(id); };

  const togglePendingSelect = (id: string) => {
    setSelectedPendingIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  /** Uses current query data each call — avoids stale `useCallback([], [])` closing over empty first paint. */
  const togglePendingSelectAll = () => {
    setSelectedPendingIds(prev => {
      const ids = (pendingData?.products ?? []).map((p: any) => p.id);
      if (ids.length === 0) return prev;
      const allOnPage = ids.every(i => prev.has(i));
      const next = new Set(prev);
      if (allOnPage) ids.forEach(i => next.delete(i));
      else ids.forEach(i => next.add(i));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const ids = (allData?.products ?? []).map((p: any) => p.id);
      if (ids.length === 0) return prev;
      const allOnPage = ids.every(i => prev.has(i));
      const next = new Set(prev);
      if (allOnPage) ids.forEach(i => next.delete(i));
      else ids.forEach(i => next.add(i));
      return next;
    });
  };

  if (user?.role !== 'ADMIN') {
    return <AdminLayout><div className="p-8 text-center text-muted-foreground">Admin access required</div></AdminLayout>;
  }

  const pendingProducts: any[] = pendingData?.products || [];
  const pendingTotal: number = pendingData?.total || 0;
  const pendingTotalPages: number = pendingData?.totalPages || 1;
  const pendingStores: any[] = pendingStoresData?.stores || [];

  const allProducts: any[] = allData?.products || [];
  const allTotal: number = allData?.total || 0;
  const allTotalPages: number = allData?.totalPages || 1;
  const allStoresList: any[] = allStoresData?.stores || [];

  const BULK_PENDING_LABELS: Record<string, string> = {
    approve: 'Approve Selected',
    reject: 'Reject Selected',
    delete: 'Delete Selected',
  };
  const BULK_ALL_LABELS: Record<string, string> = {
    approve: 'Approve Selected',
    activate: 'Activate Selected',
    deactivate: 'Deactivate Selected',
    delete: 'Delete Selected',
  };

  const pendingBulkLabel = BULK_PENDING_LABELS[pendingBulkAction] || 'action';
  const allBulkLabel = BULK_ALL_LABELS[allBulkAction] || 'action';

  return (
    <AdminLayout title="Products" subtitle="Approve, manage, and moderate all marketplace products">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-xl border border-border/50 overflow-hidden">
            <button onClick={() => setTab('pending')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted/50'}`}
            >
              <Clock className="w-4 h-4" /> Pending Approval
              {pendingTotal > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {pendingTotal}
                </span>
              )}
            </button>
            <button onClick={() => setTab('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted/50'}`}
            >
              <Package className="w-4 h-4" /> All Products
            </button>
          </div>
        </div>

        {/* ─── PENDING APPROVAL TAB ─── */}
        {tab === 'pending' && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Select all / bulk actions */}
              {selectedPendingIds.size > 0 && (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-medium text-primary">{selectedPendingIds.size} selected</span>
                  <div className="relative">
                    <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs gap-1 px-2"
                      onClick={() => setShowPendingBulkDropdown(v => !v)}>
                      Bulk Actions <ChevronDown className="w-3 h-3" />
                    </Button>
                    {showPendingBulkDropdown && (
                      <div className="absolute left-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-lg min-w-[170px] py-1" onClick={() => setShowPendingBulkDropdown(false)}>
                        {Object.entries(BULK_PENDING_LABELS).map(([action, label]) => (
                          <button key={action}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${action === 'delete' ? 'text-destructive' : action === 'reject' ? 'text-orange-600' : 'text-green-700'}`}
                            onClick={() => { setPendingBulkAction(action); setShowPendingBulkConfirm(true); }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setSelectedPendingIds(new Set())}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {/* Search */}
              <div className="relative flex-1 min-w-48 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={pendingSearchInput} onChange={e => setPendingSearchInput(e.target.value)}
                  placeholder="Search by name, store, category…" className="pl-9 h-9 rounded-xl text-sm" />
              </div>
              {/* Store filter */}
              {pendingStores.length > 0 && (
                <select
                  value={pendingStoreFilter}
                  onChange={e => setPendingStoreFilter(e.target.value)}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[160px] max-w-[220px]"
                >
                  <option value="">All Stores</option>
                  {pendingStores.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.count})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Loading skeletons */}
            {pendingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : pendingProducts.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-16 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500/40" />
                <p className="font-semibold text-muted-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {pendingSearch || pendingStoreFilter ? 'No products match your search' : 'No products awaiting approval'}
                </p>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                          <th className="px-3 py-2.5 w-8">
                            <input type="checkbox"
                              checked={(pendingData?.products?.length ?? 0) > 0 && (pendingData?.products ?? []).every((p: any) => selectedPendingIds.has(p.id))}
                              onChange={togglePendingSelectAll}
                              className="rounded cursor-pointer"
                            />
                          </th>
                          <th className="px-2 py-2.5 w-12">Image</th>
                          <th className="px-3 py-2.5 text-left">Product Name</th>
                          <th className="px-3 py-2.5 text-left">Store</th>
                          <th className="px-3 py-2.5 text-center">Category</th>
                          <th className="px-3 py-2.5 text-right">Price</th>
                          <th className="px-3 py-2.5 text-left">Submitted</th>
                          <th className="px-3 py-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingProducts.map((p: any) => {
                          const img = p.images?.[0] || '';
                          const isSelected = selectedPendingIds.has(p.id);
                          const isProc = processing === p.id;
                          return (
                            <tr key={p.id}
                              className={`border-b border-border/30 transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-muted/20'} ${isProc ? 'opacity-60 pointer-events-none' : ''}`}>
                              <td className="px-3 py-2.5 text-center">
                                <input type="checkbox" checked={isSelected} onChange={() => togglePendingSelect(p.id)} className="rounded cursor-pointer" />
                              </td>
                              <td className="px-2 py-2">
                                {img ? (
                                  <img src={img} alt={p.name} className="w-12 h-12 rounded-md object-cover border border-border/30" />
                                ) : (
                                  <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center border border-border/30">
                                    <Package className="w-5 h-5 text-muted-foreground/40" />
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 max-w-[180px]">
                                <div className="font-semibold text-foreground truncate">{p.name}</div>
                                {p.brand && <div className="text-muted-foreground text-[10px] truncate">{p.brand}</div>}
                              </td>
                              <td className="px-3 py-2.5 max-w-[130px]">
                                <div className="flex items-center gap-1 text-muted-foreground truncate" style={{ fontSize: '0.82rem' }}>
                                  <Store className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{p.store?.name || '—'}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${TYPE_COLORS[p.productType] || TYPE_COLORS.OTHER}`}>
                                  {(p.category || p.productType || 'OTHER').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-primary">
                                ${Number(p.price || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1 justify-center">
                                  <button
                                    title="Approve"
                                    onClick={() => handleApprove(p.id)}
                                    disabled={isProc}
                                    className="px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-[10px] font-semibold flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Approve
                                  </button>
                                  <button
                                    title="Reject"
                                    onClick={() => handleReject(p.id)}
                                    disabled={isProc}
                                    className="px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-[10px] font-semibold flex items-center gap-1"
                                  >
                                    <XCircle className="w-3 h-3" /> Reject
                                  </button>
                                  <button
                                    title="Delete"
                                    onClick={() => handleDelete(p.id, p.name)}
                                    disabled={isProc}
                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <Pagination
                  page={pendingPage}
                  totalPages={pendingTotalPages}
                  total={pendingTotal}
                  limit={20}
                  label={`pending product${pendingTotal !== 1 ? 's' : ''}${pendingStoreFilter ? ' from this store' : ''}`}
                  onPageChange={p => { setPendingPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                />
              </>
            )}
          </>
        )}

        {/* ─── ALL PRODUCTS TAB ─── */}
        {tab === 'all' && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-medium text-primary">{selectedIds.size} selected</span>
                  <div className="relative">
                    <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs gap-1 px-2"
                      onClick={() => setShowAllBulkDropdown(v => !v)}>
                      Bulk Actions <ChevronDown className="w-3 h-3" />
                    </Button>
                    {showAllBulkDropdown && (
                      <div className="absolute left-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-lg min-w-[180px] py-1" onClick={() => setShowAllBulkDropdown(false)}>
                        {Object.entries(BULK_ALL_LABELS).map(([action, label]) => (
                          <button key={action}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${action === 'delete' ? 'text-destructive' : action === 'deactivate' ? 'text-orange-600' : ''}`}
                            onClick={() => { setAllBulkAction(action); setShowAllBulkConfirm(true); }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setSelectedIds(new Set())}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <div className="relative flex-1 min-w-48 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={allSearchInput} onChange={e => setAllSearchInput(e.target.value)}
                  placeholder="Search all products by name, category…" className="pl-9 h-9 rounded-xl text-sm" />
              </div>
              {/* Store filter */}
              {allStoresList.length > 0 && (
                <select
                  value={allStoreFilter}
                  onChange={e => setAllStoreFilter(e.target.value)}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[160px] max-w-[220px]"
                >
                  <option value="">All Stores</option>
                  {allStoresList.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 text-xs ml-auto" onClick={() => {
                if (!allProducts.length) return;
                const rows = [
                  ['Name', 'Store', 'Price', 'Status', 'Type', 'Active'],
                  ...allProducts.map((p: any) => [
                    p.name, p.storeName || p.store?.name || '', `$${Number(p.price || 0).toFixed(2)}`,
                    p.approvalStatus || '', p.productType || '', p.isActive ? 'Yes' : 'No',
                  ]),
                ];
                const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
              }}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>

            {allLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : allProducts.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-16 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground">No products found</p>
                {(allSearch || allStoreFilter) && <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter</p>}
              </div>
            ) : (
              <>
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                          <th className="px-3 py-2.5 w-8">
                            <input type="checkbox"
                              checked={(allData?.products?.length ?? 0) > 0 && (allData?.products ?? []).every((p: any) => selectedIds.has(p.id))}
                              onChange={toggleSelectAll}
                              className="rounded cursor-pointer"
                            />
                          </th>
                          <th className="px-2 py-2.5 w-10"></th>
                          <th className="px-3 py-2.5 text-left">Product</th>
                          <th className="px-3 py-2.5 text-left">Store</th>
                          <th className="px-3 py-2.5 text-right">Price</th>
                          <th className="px-3 py-2.5 text-center">Type</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                          <th className="px-3 py-2.5 text-center">Active</th>
                          <th className="px-3 py-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allProducts.map((p: any) => {
                          const img = p.images?.[0] || '';
                          const isActive = p.isActive !== false;
                          const approvalStatus = p.approvalStatus || 'APPROVED';
                          const isSelected = selectedIds.has(p.id);
                          return (
                            <tr key={p.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                              <td className="px-3 py-2.5 text-center">
                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="rounded cursor-pointer" />
                              </td>
                              <td className="px-1 py-2">
                                {img ? (
                                  <img src={img} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Package className="w-3.5 h-3.5 text-muted-foreground/40" />
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 max-w-[180px]">
                                <div className="font-medium text-foreground truncate">{p.name}</div>
                                {p.brand && <div className="text-muted-foreground text-[10px] truncate">{p.brand}</div>}
                              </td>
                              <td className="px-3 py-2.5 max-w-[120px]">
                                <div className="flex items-center gap-1 text-muted-foreground truncate">
                                  <Store className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{p.storeName || p.store?.name || '—'}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold">${Number(p.price || 0).toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${TYPE_COLORS[p.productType] || TYPE_COLORS.OTHER}`}>
                                  {p.productType?.replace(/_/g, ' ') || 'STANDARD'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${approvalStatus.toLowerCase() === 'approved' ? 'bg-green-100 text-green-700' : approvalStatus.toLowerCase() === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {approvalStatus.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {isActive
                                  ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                  : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                                }
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1 justify-center">
                                  <button title="Edit" onClick={() => setEditProduct(p)} className="p-1 rounded hover:bg-muted transition-colors">
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                  <button title={isActive ? 'Suspend' : 'Restore'} onClick={() => handleToggle(p.id)} disabled={processing === p.id} className="p-1 rounded hover:bg-muted transition-colors">
                                    {isActive ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-primary" />}
                                  </button>
                                  <button title="Delete" onClick={() => handleDelete(p.id, p.name)} disabled={processing === p.id} className="p-1 rounded hover:bg-muted transition-colors">
                                    <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Pagination
                  page={allPage}
                  totalPages={allTotalPages}
                  total={allTotal}
                  limit={20}
                  label="products"
                  onPageChange={p => { setAllPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editProduct && (
          <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} />
        )}
        {showPendingBulkConfirm && (
          <ConfirmModal
            title={`${BULK_PENDING_LABELS[pendingBulkAction]} (${selectedPendingIds.size})`}
            description={`Are you sure you want to ${pendingBulkAction} ${selectedPendingIds.size} selected product${selectedPendingIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
            confirmLabel={`Yes, ${pendingBulkLabel}`}
            confirmClass={pendingBulkAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : pendingBulkAction === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            onConfirm={() => bulkMutation.mutate({ action: pendingBulkAction, productIds: [...selectedPendingIds] })}
            onCancel={() => { setShowPendingBulkConfirm(false); setShowPendingBulkDropdown(false); }}
          />
        )}
        {showAllBulkConfirm && (
          <ConfirmModal
            title={`${BULK_ALL_LABELS[allBulkAction]} (${selectedIds.size})`}
            description={`Are you sure you want to ${allBulkAction} ${selectedIds.size} selected product${selectedIds.size !== 1 ? 's' : ''}? ${allBulkAction === 'delete' ? 'This cannot be undone.' : ''}`}
            confirmLabel={`Yes, ${allBulkLabel}`}
            confirmClass={allBulkAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            onConfirm={() => bulkMutation.mutate({ action: allBulkAction, productIds: [...selectedIds] })}
            onCancel={() => { setShowAllBulkConfirm(false); setShowAllBulkDropdown(false); }}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
