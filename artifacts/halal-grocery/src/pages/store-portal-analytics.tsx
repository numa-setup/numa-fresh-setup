import { useState } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Users, Star, Clock, Download, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PortalLayout } from '@/components/portal/PortalLayout';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 Days' },
  { value: 'month', label: '30 Days' },
];

const PIE_COLORS = ['#3FB196', '#D4AF37', '#6FCBB3', '#2A7D6A', '#F5E6A3'];

function MetricCard({ label, value, icon: Icon, sub, color }: any) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 hg-shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-primary mt-1">{sub}</div>}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
      No {label} data for this period
    </div>
  );
}

function PeakHoursHeatmap({ data }: { data: any }) {
  if (!data?.grid) return null;
  const allCounts = data.grid.flatMap((d: any) => d.hours.map((h: any) => h.count));
  const maxCount = Math.max(...allCounts, 1);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted/30';
    const intensity = count / maxCount;
    if (intensity < 0.2) return 'bg-teal-100';
    if (intensity < 0.4) return 'bg-teal-200';
    if (intensity < 0.6) return 'bg-teal-400';
    if (intensity < 0.8) return 'bg-teal-600';
    return 'bg-teal-700';
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 lg:col-span-2">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" /> Peak Hours Heatmap
        <span className="ml-auto text-xs text-muted-foreground">Last 90 days</span>
      </h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex gap-1 mb-1 pl-8">
            {hours.map(h => (
              <div key={h} className="flex-1 text-[9px] text-center text-muted-foreground">
                {h % 4 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>
          {data.grid.map((row: any) => (
            <div key={row.day} className="flex items-center gap-1 mb-1">
              <span className="w-7 text-xs text-muted-foreground font-medium shrink-0">{row.day}</span>
              {row.hours.map((cell: any) => (
                <div
                  key={cell.hour}
                  className={`flex-1 h-6 rounded-sm ${getColor(cell.count)} transition-colors cursor-default`}
                  title={`${row.day} ${cell.hour}:00 — ${cell.count} orders`}
                />
              ))}
            </div>
          ))}
          <div className="flex items-center gap-2 mt-3 justify-end text-xs text-muted-foreground">
            <span>Less</span>
            {['bg-muted/30', 'bg-teal-100', 'bg-teal-200', 'bg-teal-400', 'bg-teal-600', 'bg-teal-700'].map(c => (
              <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StorePortalAnalyticsPage() {
  const [period, setPeriod] = useState('week');

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'analytics', period],
    queryFn: () => api.get<any>(`/store/analytics?period=${period}`),
    refetchInterval: 30000,
  });

  const { data: peakHours } = useQuery({
    queryKey: ['portal', 'analytics', 'peak-hours'],
    queryFn: () => api.get<any>(`/store/analytics/peak-hours`),
    staleTime: 5 * 60 * 1000,
  });

  const metrics = [
    { label: 'Total Revenue', value: data ? `$${(data.totalRevenue || 0).toFixed(2)}` : '—', icon: DollarSign, color: 'bg-primary/10 text-primary' },
    { label: 'Total Orders', value: data?.totalOrders ?? '—', icon: ShoppingBag, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Avg Order Value', value: data ? `$${(data.avgOrderValue || 0).toFixed(2)}` : '—', icon: TrendingUp, color: 'bg-amber-100 text-amber-600' },
    { label: 'Unique Customers', value: data?.uniqueCustomers ?? '—', icon: Users, color: 'bg-green-100 text-green-600' },
    { label: 'Store Rating', value: data?.rating ? `${data.rating}★` : '—', icon: Star, color: 'bg-yellow-100 text-yellow-600' },
    { label: 'Avg Prep Time', value: data?.avgPrepTime ? `${data.avgPrepTime} min` : '—', icon: Clock, color: 'bg-purple-100 text-purple-600' },
  ];

  const revenueChart = data?.revenueChart || [];
  const ordersChart = data?.ordersChart || [];
  const orderTypes = data?.orderTypes || [];
  const topProducts = data?.topProducts || [];

  return (
    <PortalLayout title="Analytics">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Period Picker */}
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === opt.value
                  ? 'hg-gradient-primary text-white shadow-sm'
                  : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-9 rounded-xl gap-2" onClick={() => {
              if (!data) return;
              const rows = [
                ['Date', 'Revenue', 'Orders'],
                ...(data.revenueChart || []).map((r: any) => {
                  const match = (data.ordersChart || []).find((o: any) => o.date === r.date);
                  return [r.date, r.revenue?.toFixed(2) || '0', match?.count || '0'];
                }),
              ];
              const csv = rows.map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `analytics-${period}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
            }}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {metrics.map(m => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue Line Chart */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Revenue Over Time
            </h3>
            {isLoading ? (
              <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
            ) : revenueChart.length === 0 ? (
              <EmptyChart label="revenue" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} width={48} />
                  <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Revenue']} labelFormatter={l => `Date: ${l}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#3FB196" strokeWidth={2.5} dot={{ r: 3, fill: '#3FB196' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Orders Bar Chart */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-indigo-500" /> Orders Volume
            </h3>
            {isLoading ? (
              <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
            ) : ordersChart.length === 0 ? (
              <EmptyChart label="orders" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ordersChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [v, 'Orders']} labelFormatter={l => `Date: ${l}`} />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" /> Top 10 Products
            </h3>
            {isLoading ? (
              <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
            ) : topProducts.length === 0 ? (
              <EmptyChart label="product" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProducts.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} tickFormatter={n => n.length > 12 ? n.slice(0, 12) + '…' : n} />
                  <Tooltip formatter={(v: any) => [v, 'Units sold']} />
                  <Bar dataKey="sales" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Order Type Breakdown */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" /> Order Types
            </h3>
            {isLoading ? (
              <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
            ) : orderTypes.length === 0 ? (
              <EmptyChart label="order type" />
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie data={orderTypes} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                      {orderTypes.map((_: any, i: number) => (
                        <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {orderTypes.map((t: any, i: number) => (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="flex-1">{t.name}</span>
                      <span className="font-semibold">{t.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Peak Hours Heatmap */}
        {peakHours && (
          <div className="grid lg:grid-cols-2 gap-6">
            <PeakHoursHeatmap data={peakHours} />
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
