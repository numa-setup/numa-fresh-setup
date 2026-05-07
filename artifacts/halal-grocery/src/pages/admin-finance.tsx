import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Store, ArrowUpRight, RefreshCw, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';

type Period = 'today' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];

interface FinanceData {
  summary: {
    totalGMV: number;
    periodGMV: number;
    periodCommission: number;
    periodConvenienceFees: number;
    periodRevenue: number;
    outstandingPayouts: number;
  };
  payouts: {
    storeId: string; name: string; gross: number; commission: number;
    net: number; orders: number; rate: number; status: string;
  }[];
  period: string;
}

type SortKey = 'name' | 'gross' | 'commission' | 'net' | 'orders';

export default function AdminFinance() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('gross');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.get(`/admin/finance?period=${period}`));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [period]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedPayouts = [...(data?.payouts ?? [])].sort((a, b) => {
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)
    : null;

  const kpis = data ? [
    { label: 'Total GMV (All Time)', value: `$${data.summary.totalGMV.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: `Period GMV`, value: `$${data.summary.periodGMV.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Commission Earned', value: `$${data.summary.periodCommission.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: ArrowUpRight, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Convenience Fees', value: `$${data.summary.periodConvenienceFees.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Total Platform Revenue', value: `$${data.summary.periodRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Outstanding Payouts', value: `$${data.summary.outstandingPayouts.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: Store, color: 'text-red-600', bg: 'bg-red-50' },
  ] : [];

  return (
    <AdminLayout title="Finance" subtitle="Revenue, commissions & payouts">
      <div className="p-4 lg:p-6 space-y-5">
        {/* Period selector */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl h-9 gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 text-xs" onClick={() => {
              if (!data) return;
              const rows = [
                ['Store', 'Orders', 'Gross GMV', 'Commission', 'Net Payout', 'Commission Rate', 'Status'],
                ...sortedPayouts.map(p => [p.name, p.orders, p.gross.toFixed(2), p.commission.toFixed(2), p.net.toFixed(2), `${p.rate}%`, p.status]),
                ['', '', '', '', '', '', ''],
                ['TOTALS', sortedPayouts.reduce((s, p) => s + p.orders, 0), sortedPayouts.reduce((s, p) => s + p.gross, 0).toFixed(2), sortedPayouts.reduce((s, p) => s + p.commission, 0).toFixed(2), sortedPayouts.reduce((s, p) => s + p.net, 0).toFixed(2), '', ''],
                ['', '', '', '', '', '', ''],
                ['Period GMV', data.summary.periodGMV.toFixed(2), '', '', '', '', ''],
                ['Platform Revenue', data.summary.periodRevenue.toFixed(2), '', '', '', '', ''],
                ['Outstanding Payouts', data.summary.outstandingPayouts.toFixed(2), '', '', '', '', ''],
              ];
              const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `finance-${period}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
            }}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {loading ? Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-24" /></Card>
          )) : kpis.map((k, i) => (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <p className="font-bold text-lg leading-none">{k.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payout Table */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-sm">Store Payouts — {PERIODS.find(p => p.key === period)?.label}</CardTitle>
            <span className="text-xs text-muted-foreground">{sortedPayouts.length} stores</span>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      {[
                        { key: 'name', label: 'Store' },
                        { key: 'orders', label: 'Orders' },
                        { key: 'gross', label: 'Gross GMV' },
                        { key: 'commission', label: 'Commission' },
                        { key: 'net', label: 'Net Payout' },
                      ].map(col => (
                        <th key={col.key} className="px-4 py-2.5 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort(col.key as SortKey)}>
                          {col.label} <SortIcon k={col.key as SortKey} />
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Rate</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sortedPayouts.length === 0 ? (
                      <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No payout data for this period</td></tr>
                    ) : sortedPayouts.map(p => (
                      <tr key={p.storeId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.orders}</td>
                        <td className="px-4 py-3 font-medium">${p.gross.toFixed(2)}</td>
                        <td className="px-4 py-3 text-primary font-medium">${p.commission.toFixed(2)}</td>
                        <td className="px-4 py-3 font-bold">${p.net.toFixed(2)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.rate}%</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 uppercase">{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {sortedPayouts.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border/50 bg-muted/30 font-bold">
                        <td className="px-4 py-3">Totals</td>
                        <td className="px-4 py-3">{sortedPayouts.reduce((s, p) => s + p.orders, 0)}</td>
                        <td className="px-4 py-3">${sortedPayouts.reduce((s, p) => s + p.gross, 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-primary">${sortedPayouts.reduce((s, p) => s + p.commission, 0).toFixed(2)}</td>
                        <td className="px-4 py-3">${sortedPayouts.reduce((s, p) => s + p.net, 0).toFixed(2)}</td>
                        <td className="px-4 py-3" colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
