import { Calendar, Clock, ShoppingBag, Plus, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { AccountSidebar } from '@/components/layout/AccountSidebar';
import { Button } from '@/components/ui/button';

const DEMO_SCHEDULED = [
  { id: '1', label: 'Weekly Halal Basket', nextDate: 'Apr 14, 2026', frequency: 'Weekly', items: 12, total: 87.50, status: 'active' },
  { id: '2', label: 'Monthly Spice Refill', nextDate: 'May 1, 2026', frequency: 'Monthly', items: 5, total: 34.20, status: 'paused' },
];

export default function AccountScheduledOrdersPage() {
  return (
    <>
      <Helmet>
        <title>Scheduled Orders | Numa Fresh</title>
      </Helmet>
      <div className="min-h-screen py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <AccountSidebar active="scheduled-orders" />
            <div className="flex-1 min-w-0 space-y-6">
              <Link href="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground md:hidden">
                <ArrowLeft className="w-4 h-4" /> Back to Account
              </Link>

              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-serif font-bold text-2xl">Scheduled Orders</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">Set up recurring deliveries so you never run out of halal essentials.</p>
                </div>
                <Button className="hg-gradient-primary border-0 text-white rounded-xl gap-2">
                  <Plus className="w-4 h-4" /> New Schedule
                </Button>
              </div>

              <div className="space-y-4">
                {DEMO_SCHEDULED.map(order => (
                  <div key={order.id} className="bg-card rounded-2xl border border-border/60 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{order.label}</p>
                          <p className="text-xs text-muted-foreground">{order.items} items · ${order.total.toFixed(2)}/order</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        order.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {order.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Next: {order.nextDate}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {order.frequency}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl text-xs h-8">Edit</Button>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs h-8">
                        {order.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl text-xs h-8 text-destructive hover:text-destructive ml-auto">Cancel</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border-2 border-dashed border-border/60 p-8 text-center">
                <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-semibold text-sm mb-1">Create your first recurring order</h3>
                <p className="text-xs text-muted-foreground mb-4">Choose products, set a frequency (weekly, bi-weekly, monthly) and we'll handle the rest.</p>
                <Button variant="outline" className="rounded-xl gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Schedule Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
