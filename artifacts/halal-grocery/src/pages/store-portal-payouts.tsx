import { useState } from 'react';
import { DollarSign, TrendingDown, ArrowUpRight, ExternalLink, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { motion } from 'framer-motion';

export default function StorePortalPayoutsPage() {
  const [period, setPeriod] = useState('month');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['portal', 'payouts', period],
    queryFn: () => api.get<any>(`/store/payouts?period=${period}`),
  });

  const rows = [
    { key: 'grossRevenue', label: 'Gross Revenue', value: data ? `$${(data.grossRevenue || 0).toFixed(2)}` : '—', icon: DollarSign, color: 'text-foreground', bg: 'bg-primary/5' },
    { key: 'commission', label: `Platform Commission (${data?.commissionRate || 7}%)`, value: data ? `-$${(data.commission || 0).toFixed(2)}` : '—', icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/5' },
    { key: 'netPayout', label: 'Your Net Payout', value: data ? `$${(data.netPayout || 0).toFixed(2)}` : '—', icon: ArrowUpRight, color: 'text-primary', bg: 'bg-primary/10', bold: true },
  ];

  return (
    <PortalLayout title="Payouts">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Summary */}
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
          <h2 className="font-serif font-bold text-lg mb-4">Payout Summary</h2>
          {rows.map(({ key, label, value, icon: Icon, color, bg, bold }) => (
            <motion.div key={key} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-3 p-3 rounded-xl ${bg}`}
            >
              <div className={`h-9 w-9 rounded-lg ${bg} border border-current/10 flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="flex-1 text-sm text-muted-foreground">{label}</span>
              <span className={`font-${bold ? 'bold text-base' : 'semibold text-sm'} ${color}`}>
                {isLoading ? '—' : value}
              </span>
            </motion.div>
          ))}

          <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Payout schedule: <strong className="text-foreground">Weekly (every Monday)</strong>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              {data?.ordersCount || 0} completed orders this period
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button className="hg-gradient-primary border-0 text-white rounded-xl gap-2">
            <ArrowUpRight className="h-4 w-4" /> Request Early Payout
          </Button>
          <Button variant="outline" className="rounded-xl gap-2">
            <ExternalLink className="h-4 w-4" /> Stripe Connect Dashboard
          </Button>
        </div>

        {/* Payout History */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h3 className="font-semibold">Payout History</h3>
          </div>
          <div className="divide-y divide-border/50">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : (data?.payoutHistory || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No payout history yet</div>
            ) : (
              (data?.payoutHistory || []).map((payout: any, i: number) => (
                <motion.div key={payout.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="px-5 py-4 flex items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{payout.period}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Gross ${Number(payout.grossRevenue).toFixed(2)} · Commission -${Number(payout.commission).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-primary">${Number(payout.netPayout).toFixed(2)}</div>
                    <div className="mt-0.5">
                      {payout.status === 'PAID' ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Paid {payout.paidAt}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
