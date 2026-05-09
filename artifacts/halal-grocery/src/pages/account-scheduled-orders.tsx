import { Calendar, Clock, ShoppingBag, Plus, ArrowLeft, RefreshCw } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { AccountSidebar } from '@/components/layout/AccountSidebar';
import { Button } from '@/components/ui/button';

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
              </div>

              <div className="rounded-2xl border-2 border-dashed border-border/60 p-12 text-center bg-muted/20">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-serif font-bold text-xl mb-2">Recurring Orders — Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
                  Set up weekly, bi-weekly, or monthly recurring orders for your favourite halal essentials and we'll handle the rest automatically.
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-8 text-xs text-muted-foreground">
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background border border-border/60">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    <span>Pick items</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background border border-border/60">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Set frequency</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background border border-border/60">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>Auto-deliver</span>
                  </div>
                </div>
                <Button disabled className="rounded-xl gap-2 text-sm opacity-60 cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Schedule Now — Available Soon
                </Button>
              </div>

              <div className="rounded-2xl bg-card border border-border/60 p-5">
                <h4 className="font-semibold text-sm mb-3">Why use scheduled orders?</h4>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    'Never run out of halal meat, produce, or pantry staples',
                    'Lock in prices for your regular essentials',
                    'Pause, skip, or cancel any time — no commitment',
                    'Earn loyalty points on every recurring delivery',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
