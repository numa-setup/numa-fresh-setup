import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign, ShoppingBag, Store, Users, TrendingUp, Clock,
  AlertTriangle, CheckCircle, ArrowUp, ExternalLink, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';

interface DashboardData {
  kpis: {
    totalGMV: number; totalOrders: number; activeStores: number;
    platformRevenue: number; pendingApprovals: number; totalUsers: number;
    todayOrders: number; todayRevenue: number;
  };
  revenueByDay: { date: string; gmv: number; orders: number }[];
  recentOrders: { id: string; orderNumber: string; status: string; orderType: string; estimatedTotal: number; finalTotal: number; createdAt: string; customerFirst: string; customerLast: string; storeName: string }[];
  activityFeed: { type: string; message: string; store: string; time: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  STORE_CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PREPARATION: 'bg-purple-100 text-purple-800',
  READY_FOR_PICKUP: 'bg-teal-100 text-teal-800',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
};

const ACTIVITY_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  new_order: { icon: ShoppingBag, color: 'text-blue-500' },
  refund: { icon: AlertTriangle, color: 'text-orange-500' },
  order_update: { icon: CheckCircle, color: 'text-green-500' },
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.get('/admin/dashboard'));
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const kpiCards = data ? [
    { label: 'Total GMV', value: `$${data.kpis.totalGMV.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `Today: $${data.kpis.todayRevenue.toFixed(2)}`, trend: 'up' },
    { label: 'Platform Revenue', value: `$${data.kpis.platformRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10', sub: '7% commission rate', trend: 'up' },
    { label: 'Total Orders', value: data.kpis.totalOrders.toLocaleString(), icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', sub: `Today: ${data.kpis.todayOrders}`, trend: 'up' },
    { label: 'Active Stores', value: data.kpis.activeStores.toString(), icon: Store, color: 'text-violet-600', bg: 'bg-violet-50', sub: `${data.kpis.pendingApprovals} pending review`, trend: data.kpis.pendingApprovals > 0 ? 'warn' : 'neutral' },
    { label: 'Total Users', value: data.kpis.totalUsers.toLocaleString(), icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'Registered accounts', trend: 'neutral' },
    { label: 'Pending Approvals', value: data.kpis.pendingApprovals.toString(), icon: Clock, color: 'text-red-600', bg: 'bg-red-50', sub: 'Stores awaiting review', trend: data.kpis.pendingApprovals > 0 ? 'warn' : 'neutral' },
  ] : [];

  return (
    <AdminLayout title="Dashboard" subtitle="Platform overview & key metrics">
      <div className="p-4 lg:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Last updated: {lastRefresh.toLocaleTimeString()}</p>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl gap-1.5 text-xs h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {loading ? Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-24" /></Card>
          )) : kpiCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    {card.trend === 'up' && <ArrowUp className="w-3.5 h-3.5 text-green-500" />}
                    {card.trend === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <p className="font-bold text-xl leading-none">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-sm">GMV Trend — Last 30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={208}>
                  <AreaChart data={data?.revenueByDay ?? []} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3FB196" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3FB196" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'GMV']} />
                    <Area type="monotone" dataKey="gmv" stroke="#3FB196" strokeWidth={2} fill="url(#gmvGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-sm">Daily Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={208}>
                  <BarChart data={(data?.revenueByDay ?? []).slice(-14)} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => [v, 'Orders']} />
                    <Bar dataKey="orders" fill="#D4AF37" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Recent Orders */}
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-sm">Recent Orders</CardTitle>
              <Link href="/admin/orders">
                <Button variant="ghost" size="sm" className="rounded-xl text-xs h-7 gap-1">
                  View all <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="h-48 bg-muted/30 animate-pulse m-4 rounded-lg" /> : (
                <div className="divide-y divide-border/50">
                  {(data?.recentOrders ?? []).slice(0, 7).map(order => (
                    <div key={order.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-semibold">{order.orderNumber}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_COLOR[order.status] ?? 'bg-muted'}`}>
                            {order.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{order.customerFirst} {order.customerLast} · {order.storeName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold">${(order.finalTotal ?? order.estimatedTotal ?? 0).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  {(data?.recentOrders ?? []).length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">No orders yet</div>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Live Activity</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="h-48 bg-muted/30 animate-pulse m-4 rounded-lg" /> : (
                <div className="divide-y divide-border/50">
                  {(data?.activityFeed ?? []).map((item, i) => {
                    const { icon: Icon, color } = ACTIVITY_ICON[item.type] ?? ACTIVITY_ICON.order_update;
                    return (
                      <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-snug">{item.message}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{item.store}</p>
                        </div>
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  {(data?.activityFeed ?? []).length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">No activity</div>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
