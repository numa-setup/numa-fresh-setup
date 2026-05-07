import { useState } from 'react';
import { Link } from 'wouter';
import { ShoppingBag, ChevronRight, Clock, Truck, Store, Search, Filter, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { motion } from 'framer-motion';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  STORE_CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PREPARATION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  REPLACEMENT_HANDLING: 'bg-purple-50 text-purple-700 border-purple-200',
  READY_FOR_PICKUP: 'bg-green-50 text-green-700 border-green-200',
  OUT_FOR_DELIVERY: 'bg-teal-50 text-teal-700 border-teal-200',
  COMPLETED: 'bg-slate-50 text-slate-600 border-slate-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-rose-50 text-rose-700 border-rose-200',
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function StorePortalOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portal', 'orders', 'all', statusFilter],
    queryFn: () => api.get<any>(`/store/orders${statusFilter ? `?status=${statusFilter}` : ''}`),
    refetchInterval: 8000,
    retry: 1,
  });

  const orders = (data?.orders || []).filter((o: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.orderNumber?.toLowerCase().includes(q) ||
      o.customer?.firstName?.toLowerCase().includes(q) ||
      o.customer?.lastName?.toLowerCase().includes(q);
  });

  return (
    <PortalLayout title="Orders">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders or customers..."
              className="pl-9 h-10 rounded-xl"
            />
          </div>
          <Select value={statusFilter || '_all'} onValueChange={v => setStatusFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-44 h-10 rounded-xl">
              <Filter className="h-3.5 w-3.5 mr-2" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Orders</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="STORE_CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="IN_PREPARATION">Preparing</SelectItem>
              <SelectItem value="READY_FOR_PICKUP">Ready</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground self-center">{data?.total || 0} orders</div>
        </div>

        {/* Order List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Could not load orders</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Make sure your store is set up and try again.</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No orders yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Orders placed by customers will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order: any, i: number) => (
              <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/store-portal/orders/${order.id}`}>
                  <div className="bg-card rounded-2xl border border-border/50 p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold">#{order.orderNumber}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || ''}`}>
                            {order.status?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {order.orderType === 'CURBSIDE_PICKUP' || order.orderType === 'STORE_DELIVERY' ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                            {order.orderType?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer?.firstName} {order.customer?.lastName}
                          {' · '}{order.items?.length || 0} items
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold">${Number(order.estimatedTotal || 0).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                          <Clock className="h-3 w-3" />
                          {timeAgo(order.createdAt)}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
