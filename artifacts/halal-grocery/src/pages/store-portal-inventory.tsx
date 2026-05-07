import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, AlertTriangle, TrendingDown, TrendingUp, BarChart3, Save, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PortalLayout } from '@/components/portal/PortalLayout';

const PRODUCT_TYPES = ['ALL', 'FRESH_MEAT', 'PRODUCE', 'SPICES', 'PACKAGED', 'DAIRY', 'BAKERY', 'FROZEN', 'BEVERAGES', 'OTHER'];

type StockFilter = 'all' | 'low' | 'out' | 'healthy';

function InvPagination({ page, totalPages, total, limit, onPageChange }: {
  page: number; totalPages: number; total: number; limit: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/30 bg-muted/20">
      <span className="text-xs text-muted-foreground">
        Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> products
      </span>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="h-8 px-3 rounded-lg border border-border/50 text-xs disabled:opacity-40 hover:bg-muted/50 transition-colors"
        >← Prev</button>
        {pages.map((p, i) => p === '...' ? (
          <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
        ) : (
          <button key={p} onClick={() => onPageChange(p as number)}
            className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary text-white' : 'border border-border/50 hover:bg-muted/50'}`}
          >{p}</button>
        ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="h-8 px-3 rounded-lg border border-border/50 text-xs disabled:opacity-40 hover:bg-muted/50 transition-colors"
        >Next →</button>
      </div>
    </div>
  );
}

export default function StorePortalInventoryPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  // Reset to page 1 on filter change
  const resetPage = () => setPage(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['portal', 'inventory', page],
    queryFn: () => api.get<any>(`/store/products?page=${page}&limit=20`),
    refetchInterval: 60_000,
  });

  // Real stats from dedicated endpoint — always covers all products regardless of page
  const { data: statsData } = useQuery({
    queryKey: ['portal', 'product-stats'],
    queryFn: () => api.get<any>('/store/stats'),
    staleTime: 30_000,
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, stockQty }: { id: string; stockQty: number }) =>
      api.patch(`/store/products/${id}/stock`, { stockQty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['portal', 'product-stats'] });
    },
  });

  const allProducts: any[] = data?.products || [];

  const products = allProducts.filter(p => {
    const matchType = typeFilter === 'ALL' || p.productType === typeFilter;
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const qty = Number(p.stockQty);
    const threshold = Number(p.lowStockThreshold) || 5;
    const matchStock =
      stockFilter === 'all' ? true :
      stockFilter === 'out' ? qty === 0 :
      stockFilter === 'low' ? (qty > 0 && qty <= threshold) :
      stockFilter === 'healthy' ? qty > threshold : true;
    return matchType && matchSearch && matchStock;
  });

  // KPI values: prefer real stats from API (all products), fall back to current page calculation
  const lowStockCount = statsData?.lowStock ?? allProducts.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= (Number(p.lowStockThreshold) || 5)).length;
  const outOfStockCount = statsData?.outOfStock ?? allProducts.filter(p => Number(p.stockQty) === 0).length;
  const totalValue = statsData?.totalInventoryValue ?? allProducts.reduce((sum, p) => sum + Number(p.price) * Number(p.stockQty), 0);
  const totalProductsCount = statsData?.totalProducts ?? data?.total ?? allProducts.length;

  const handleStockChange = (id: string, value: string) => {
    setEdits(e => ({ ...e, [id]: value }));
  };

  const handleSaveStock = async (product: any) => {
    const newQty = edits[product.id];
    if (newQty === undefined || newQty === String(product.stockQty)) return;
    const qty = Number(newQty);
    if (isNaN(qty) || qty < 0) { toast({ title: 'Invalid quantity', variant: 'destructive' }); return; }

    setSaving(s => ({ ...s, [product.id]: true }));
    try {
      await stockMutation.mutateAsync({ id: product.id, stockQty: qty });
      setEdits(e => { const n = { ...e }; delete n[product.id]; return n; });
      toast({ title: '✅ Stock updated' });
    } catch {
      toast({ title: 'Failed to update stock', variant: 'destructive' });
    } finally {
      setSaving(s => ({ ...s, [product.id]: false }));
    }
  };

  const getStockStatus = (product: any) => {
    const qty = Number(product.stockQty);
    const threshold = Number(product.lowStockThreshold) || 5;
    if (qty === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700', icon: <TrendingDown className="w-3 h-3" /> };
    if (qty <= threshold) return { label: 'Low Stock', color: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> };
    return { label: 'In Stock', color: 'bg-green-100 text-green-700', icon: <TrendingUp className="w-3 h-3" /> };
  };

  return (
    <PortalLayout title="Inventory">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Products', value: totalProductsCount, icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Out of Stock', value: outOfStockCount, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Inventory Value', value: `$${totalValue.toFixed(0)}`, icon: BarChart3, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border/50 p-4 flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or SKU..." className="pl-9 h-10 rounded-xl" />
          </div>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); resetPage(); }}>
            <SelectTrigger className="w-40 h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex rounded-xl border border-border/50 overflow-hidden">
            {(['all', 'low', 'out', 'healthy'] as StockFilter[]).map(f => (
              <button key={f} onClick={() => { setStockFilter(f); resetPage(); }}
                className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${stockFilter === f ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted/50'}`}
              >{f === 'all' ? 'All' : f === 'low' ? '⚠ Low' : f === 'out' ? '✗ Out' : '✓ Healthy'}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-10 rounded-xl gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        {/* Inventory Table */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground">SKU</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground">Price</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground">Threshold</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground">Stock Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No products match your filters</p>
                    </td>
                  </tr>
                ) : products.map((product: any, i) => {
                  const status = getStockStatus(product);
                  const currentQty = edits[product.id] !== undefined ? edits[product.id] : String(product.stockQty);
                  const isDirty = edits[product.id] !== undefined && edits[product.id] !== String(product.stockQty);
                  const image = product.images?.[0];

                  return (
                    <motion.tr key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${!product.isActive ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {image ? (
                            <img src={image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                              onError={e => (e.target as HTMLImageElement).style.display = 'none'}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-xs line-clamp-1">{product.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{product.sku || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{product.productType?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-xs">${Number(product.price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{product.lowStockThreshold || 5}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={currentQty}
                            onChange={e => handleStockChange(product.id, e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveStock(product)}
                            className={`w-20 h-8 rounded-lg text-center text-sm ${isDirty ? 'border-primary ring-1 ring-primary/30' : ''}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          className={`h-8 rounded-lg text-xs ${isDirty ? 'hg-gradient-primary border-0 text-white' : 'border-border text-muted-foreground'}`}
                          variant={isDirty ? 'default' : 'outline'}
                          disabled={!isDirty || saving[product.id]}
                          onClick={() => handleSaveStock(product)}
                        >
                          {saving[product.id] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" /> Save</>}
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data?.totalPages > 1 && (
            <InvPagination
              page={page}
              totalPages={data.totalPages}
              total={data.total ?? 0}
              limit={20}
              onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
          {products.length > 0 && data?.totalPages <= 1 && (
            <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground bg-muted/20">
              Showing {products.length} of {totalProductsCount} products · Edit qty and click Save to update
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
