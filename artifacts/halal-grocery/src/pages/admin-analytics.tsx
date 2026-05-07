import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Users, ShoppingBag, DollarSign } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '@/lib/api';

type Period = '7d' | '30d' | '90d';

interface AnalyticsData {
  summary: { totalOrders: number; completedOrders: number; totalGMV: number; newUsers: number; conversionRate: number };
  trends: { date: string; gmv: number; orders: number; newUsers: number }[];
  orderTypeDistribution: { type: string; count: number }[];
  storeLeague: { name: string; orders: number; gmv: number; city: string }[];
  statusBreakdown: Record<string, number>;
  period: string;
}

const PIE_COLORS = ['#3FB196', '#D4AF37', '#6366f1', '#f59e0b', '#ef4444'];
const TYPE_LABELS: Record<string, string> = {
  EXPRESS_PICKUP: 'Express Pickup',
  CURBSIDE_PICKUP: 'Curbside',
  STORE_DELIVERY: 'Delivery',
};

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.get(`/admin/analytics?period=${period}`));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [period]);

  const summaryCards = data ? [
    { label: 'Total Orders', value: data.summary.totalOrders.toLocaleString(), icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', sub: `${data.summary.completedOrders} completed` },
    { label: 'Total GMV', value: `$${data.summary.totalGMV.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Gross merchandise value' },
    { label: 'New Users', value: data.summary.newUsers.toLocaleString(), icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', sub: 'In period' },
    { label: 'Conversion Rate', value: `${data.summary.conversionRate}%`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'Orders completed' },
  ] : [];

  const pieData = (data?.orderTypeDistribution ?? []).map(d => ({
    name: TYPE_LABELS[d.type] ?? d.type, value: d.count,
  }));

  const statusData = Object.entries(data?.statusBreakdown ?? {}).map(([status, count]) => ({
    status: status.replace(/_/g, ' '), count,
  })).sort((a, b) => b.count - a.count);

  return (
    <AdminLayout title="Analytics" subtitle="Platform-wide performance metrics">
      <div className="p-4 lg:p-6 space-y-5">
        {/* Period selector */}
        <div className="flex items-center gap-3">
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
            {[{ key: '7d', label: '7 Days' }, { key: '30d', label: '30 Days' }, { key: '90d', label: '90 Days' }].map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key as Period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl h-9 ml-auto">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? Array(4).fill(0).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-24" /></Card>)
            : summaryCards.map(card => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <p className="font-bold text-xl leading-none">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Trends Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">GMV & Orders Trend</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={208}>
                  <LineChart data={data?.trends ?? []} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis yAxisId="gmv" tick={{ fontSize: 9 }} tickFormatter={v => `$${v}`} />
                    <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line yAxisId="gmv" type="monotone" dataKey="gmv" stroke="#3FB196" strokeWidth={2} dot={false} name="GMV ($)" />
                    <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="#D4AF37" strokeWidth={2} dot={false} name="Orders" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">New User Registrations</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={208}>
                  <AreaChart data={data?.trends ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="newUsers" stroke="#6366f1" strokeWidth={2} fill="url(#userGrad)" name="New Users" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Order Types */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Order Types</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-40 bg-muted animate-pulse rounded-lg" /> : (
                pieData.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: '9px' }}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )
              )}
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Order Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-40 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="status" type="category" tick={{ fontSize: 8 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3FB196" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Stores */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Top Stores by GMV</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="h-40 bg-muted animate-pulse rounded-lg m-4" /> : (
                <div className="divide-y divide-border/30">
                  {(data?.storeLeague ?? []).slice(0, 6).map((store, i) => (
                    <div key={store.name} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{store.name}</p>
                        <p className="text-[10px] text-muted-foreground">{store.city} · {store.orders} orders</p>
                      </div>
                      <span className="text-xs font-bold text-primary">${store.gmv.toFixed(0)}</span>
                    </div>
                  ))}
                  {(data?.storeLeague ?? []).length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">No data</div>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
