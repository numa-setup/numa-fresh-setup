import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { Star, TrendingUp, ShoppingBag, MessageSquare, Users, Gift, ChevronRight, ArrowLeft, Crown, Zap, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useLoyalty } from '@/hooks/useUser';
import { AccountSidebar } from '@/components/layout/AccountSidebar';

const TIERS = [
  { name: 'Bronze', min: 0, max: 499, color: 'from-amber-700 to-amber-600', icon: Star, perks: ['5% points on orders', 'Birthday bonus'] },
  { name: 'Silver', min: 500, max: 1999, color: 'from-slate-400 to-slate-500', icon: Zap, perks: ['7% points on orders', 'Priority support', 'Free delivery once/month'] },
  { name: 'Gold', min: 2000, max: 4999, color: 'from-amber-400 to-yellow-500', icon: Award, perks: ['10% points on orders', 'Dedicated support', '2× free deliveries/month', 'Exclusive deals'] },
  { name: 'Platinum', min: 5000, max: Infinity, color: 'from-primary to-emerald-600', icon: Crown, perks: ['15% points on orders', 'VIP support', 'Unlimited free delivery', 'Early access', 'Monthly gift'] },
];

const EARN_WAYS = [
  { icon: ShoppingBag, label: 'Place an order', points: '5% of order value', desc: 'Earn on every purchase' },
  { icon: MessageSquare, label: 'Leave a review', points: '+50 pts', desc: 'After order completion' },
  { icon: Users, label: 'Refer a friend', points: '+200 pts', desc: 'When they place first order' },
  { icon: Gift, label: 'Birthday bonus', points: '+100 pts', desc: 'On your birthday' },
];

const TYPE_COLORS: Record<string, string> = {
  ORDER: 'bg-primary/10 text-primary',
  REVIEW: 'bg-violet-100 text-violet-700',
  REFERRAL: 'bg-blue-100 text-blue-700',
  BONUS: 'bg-amber-100 text-amber-700',
  REDEMPTION: 'bg-red-100 text-red-700',
  EXPIRY: 'bg-slate-100 text-slate-600',
};

function getCurrentTier(points: number) {
  return TIERS.find((t) => points >= t.min && points <= t.max) || TIERS[0];
}

function getNextTier(points: number) {
  const idx = TIERS.findIndex((t) => points >= t.min && points <= t.max);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export default function AccountLoyaltyPage() {
  const { user } = useAuth();
  const { data: loyalty, isLoading } = useLoyalty();
  const points = user?.loyaltyPoints ?? loyalty?.points ?? 0;
  const tier = getCurrentTier(points);
  const nextTier = getNextTier(points);
  const progressToNext = nextTier ? ((points - tier.min) / (nextTier.min - tier.min)) * 100 : 100;
  const TierIcon = tier.icon;
  // API returns 'transactions', hook type says 'history' — support both
  const historyItems = (loyalty as any)?.transactions || loyalty?.history || [];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif font-bold text-2xl mb-2">Sign in to view your loyalty</h2>
          <Link href="/login"><Button className="hg-gradient-primary border-0 text-white">Sign In</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Loyalty Rewards | Numa Fresh</title>
        <meta name="description" content="View your Numa Fresh loyalty points, tier status, and rewards history." />
      </Helmet>

      <div className="min-h-screen py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <AccountSidebar active="loyalty" />

            <div className="flex-1 min-w-0">
              {/* Back on mobile */}
              <Link href="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 md:hidden">
                <ArrowLeft className="w-4 h-4" /> Back to Account
              </Link>

              <h1 className="font-serif font-bold text-2xl mb-6">Loyalty Rewards</h1>

              {/* Hero Points Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-3xl bg-gradient-to-br ${tier.color} p-6 text-white mb-6 relative overflow-hidden`}
              >
                <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute -right-4 -bottom-12 w-56 h-56 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-white/80 text-sm font-medium mb-1">Your Points Balance</p>
                      <div className="text-5xl font-bold tracking-tight">{points.toLocaleString()}</div>
                      <p className="text-white/70 text-xs mt-1">≈ ${(points / 100).toFixed(2)} reward value</p>
                    </div>
                    <div className="bg-white/20 rounded-2xl p-3">
                      <TierIcon className="w-7 h-7" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-white/20 rounded-full px-3 py-1 text-sm font-semibold">{tier.name} Member</span>
                  </div>

                  {nextTier ? (
                    <div>
                      <div className="flex justify-between text-xs text-white/80 mb-1">
                        <span>{tier.name}</span>
                        <span>{nextTier.name} at {nextTier.min.toLocaleString()} pts</span>
                      </div>
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progressToNext, 100)}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                          className="h-full bg-white rounded-full"
                        />
                      </div>
                      <p className="text-xs text-white/70 mt-1">
                        {(nextTier.min - points).toLocaleString()} points to {nextTier.name}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-white/80 font-medium">🎉 You've reached the highest tier!</p>
                  )}
                </div>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Current Tier Perks */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card rounded-2xl border border-border/50 p-5"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TierIcon className="w-4 h-4 text-primary" />
                    Your {tier.name} Perks
                  </h3>
                  <ul className="space-y-2">
                    {tier.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* How to Earn */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-card rounded-2xl border border-border/50 p-5"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    How to Earn
                  </h3>
                  <div className="space-y-2.5">
                    {EARN_WAYS.map(({ icon: Icon, label, points: pts, desc }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <span className="text-xs font-semibold text-primary whitespace-nowrap">{pts}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* All Tiers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl border border-border/50 p-5 mb-6"
              >
                <h3 className="font-semibold mb-4">All Membership Tiers</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {TIERS.map((t) => {
                    const Icon = t.icon;
                    const isCurrent = t.name === tier.name;
                    return (
                      <div
                        key={t.name}
                        className={`rounded-xl p-3 border ${isCurrent ? 'border-primary bg-primary/5' : 'border-border/50'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center mb-2`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.max === Infinity ? `${t.min.toLocaleString()}+ pts` : `${t.min.toLocaleString()}–${t.max.toLocaleString()} pts`}
                        </p>
                        {isCurrent && <span className="text-xs text-primary font-medium mt-1 block">Current</span>}
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Points History */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-card rounded-2xl border border-border/50 p-5"
              >
                <h3 className="font-semibold mb-4">Points History</h3>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : historyItems.length > 0 ? (
                  <div className="space-y-2">
                    {historyItems.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[h.type] || 'bg-muted text-muted-foreground'}`}>
                            {h.type}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{h.description}</p>
                            <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <span className={`font-semibold text-sm ${h.points > 0 ? 'text-primary' : 'text-destructive'}`}>
                          {h.points > 0 ? '+' : ''}{h.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No points activity yet. Place your first order to start earning!</p>
                    <Link href="/">
                      <Button className="mt-3 hg-gradient-primary border-0 text-white text-sm">Browse Stores</Button>
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
