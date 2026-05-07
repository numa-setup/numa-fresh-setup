import { useState } from 'react';
import { Link } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Check, Sparkles, Crown, Users, Star, Zap, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Standard access for casual shoppers',
    icon: Star,
    color: 'border-border',
    badge: null,
    features: [
      'Browse all 10+ halal stores',
      'Full product catalog (300+ items)',
      'Express Pickup & Curbside',
      'AI Meal Planner (3 plans/month)',
      'Loyalty points on every order',
      'Standard convenience fees apply',
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$4.99',
    period: '/month',
    description: 'Great for regular weekly shoppers',
    icon: Zap,
    color: 'border-primary',
    badge: null,
    features: [
      'Everything in Free',
      'Free delivery on orders over $35',
      'AI Meal Planner (unlimited)',
      'Save up to 3 meal plans',
      'Priority order confirmation',
      '2× loyalty points on first order each month',
    ],
    cta: 'Start Basic',
    disabled: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$9.99',
    period: '/month',
    description: 'Best for families who order weekly',
    icon: Crown,
    color: 'border-amber-400',
    badge: 'Most Popular',
    features: [
      'Everything in Basic',
      'Free delivery on orders over $25',
      '5% cashback on all orders',
      'Unlimited saved meal plans',
      'Eid special early access',
      'Dedicated support line',
    ],
    cta: 'Go Premium',
    disabled: false,
  },
  {
    id: 'family',
    name: 'Family',
    price: '$14.99',
    period: '/month',
    description: 'Share premium benefits with family',
    icon: Users,
    color: 'border-violet-400',
    badge: 'Best Value',
    features: [
      'Everything in Premium',
      '3 linked family member accounts',
      'Shared loyalty points pool',
      'Family meal plan templates',
      'Bulk order discounts',
      'Priority halal certification checks',
    ],
    cta: 'Get Family Plan',
    disabled: false,
  },
];

export default function AccountMembershipPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = (plan: string) => {
    toast.info(`Stripe billing for ${plan} plan coming soon! We'll notify you when it's ready.`, { duration: 5000 });
  };

  return (
    <>
      <Helmet>
        <title>Membership Plans — Numa Fresh</title>
      </Helmet>

      <div className="min-h-screen py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="mb-8">
            <Link href="/account">
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back to Account
              </button>
            </Link>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" /> Numa Fresh Premium
              </div>
              <h1 className="font-serif font-bold text-4xl mb-3">Choose Your Plan</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Unlock free delivery, cashback rewards, and more. All plans include access to 300+ halal products from 10+ certified stores.
              </p>
            </div>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${billing === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Yearly
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Save 20%</span>
              </button>
            </div>
          </div>

          {/* Plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {PLANS.map((plan, idx) => {
              const Icon = plan.icon;
              const price = billing === 'yearly' && plan.price !== '$0'
                ? `$${(parseFloat(plan.price.replace('$', '')) * 0.8).toFixed(2)}`
                : plan.price;
              const isCurrentPlan = !user || plan.id === 'free';

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className={`relative bg-card rounded-2xl border-2 ${plan.color} p-5 flex flex-col ${plan.badge ? 'shadow-lg' : ''}`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-400 text-amber-900 border-0 text-[10px] font-bold px-3">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}

                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    plan.id === 'premium' ? 'bg-amber-50 text-amber-600' :
                    plan.id === 'family' ? 'bg-violet-50 text-violet-600' :
                    plan.id === 'basic' ? 'bg-primary/10 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="font-bold text-lg mb-0.5">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>

                  <div className="flex items-end gap-1 mb-4">
                    <span className="font-serif font-bold text-3xl">{price}</span>
                    <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>
                    {billing === 'yearly' && plan.price !== '$0' && (
                      <span className="text-xs text-muted-foreground line-through mb-1">{plan.price}</span>
                    )}
                  </div>

                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => !plan.disabled && handleSubscribe(plan.name)}
                    disabled={plan.disabled || isCurrentPlan}
                    className={`w-full rounded-xl text-sm font-semibold ${
                      plan.id === 'premium' ? 'bg-amber-400 hover:bg-amber-500 text-amber-900 border-0' :
                      plan.id === 'family' ? 'bg-violet-500 hover:bg-violet-600 text-white border-0' :
                      plan.id === 'basic' ? 'hg-gradient-primary border-0 text-white' :
                      ''
                    }`}
                    variant={plan.id === 'free' ? 'outline' : 'default'}
                  >
                    {isCurrentPlan && plan.id === 'free' ? 'Current Plan' : plan.cta}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto">
            <h2 className="font-serif font-bold text-2xl text-center mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                { q: 'Can I cancel anytime?', a: 'Yes. Cancel anytime from your account settings — no lock-in, no fees.' },
                { q: 'How does cashback work?', a: 'Premium and Family members earn 5% cashback as loyalty points on every order. Points convert to $1 off per 100 points.' },
                { q: 'Does my family need separate accounts?', a: 'With the Family plan, up to 3 additional family members can link their accounts and share benefits, including a pooled loyalty point balance.' },
                { q: 'When does free delivery apply?', a: 'Basic members get free delivery on orders over $35. Premium and Family members get free delivery on orders over $25, from any store.' },
              ].map(({ q, a }) => (
                <div key={q} className="bg-card border border-border/50 rounded-xl p-4">
                  <p className="font-semibold text-sm mb-1">{q}</p>
                  <p className="text-sm text-muted-foreground">{a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-16" />
        </div>
      </div>
    </>
  );
}
