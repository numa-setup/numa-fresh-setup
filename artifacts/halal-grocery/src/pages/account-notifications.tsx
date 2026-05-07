import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { Bell, ShoppingBag, Tag, Store, Megaphone, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AccountSidebar } from '@/components/layout/AccountSidebar';

const STORAGE_KEY = 'hg_notif_prefs';

interface NotifPrefs {
  email_orders: boolean;
  email_promos: boolean;
  email_stores: boolean;
  email_news: boolean;
  push_orders: boolean;
  push_promos: boolean;
  push_stores: boolean;
  sms_orders: boolean;
  sms_promos: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  email_orders: true,
  email_promos: true,
  email_stores: false,
  email_news: false,
  push_orders: true,
  push_promos: false,
  push_stores: false,
  sms_orders: true,
  sms_promos: false,
};

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PREFS;
}

const SECTIONS = [
  {
    title: 'Order Updates',
    icon: ShoppingBag,
    description: 'Order confirmations, status changes, and delivery updates.',
    keys: ['orders'] as const,
    channels: ['email', 'push', 'sms'] as const,
  },
  {
    title: 'Promotions & Deals',
    icon: Tag,
    description: 'Exclusive offers, discount codes, and seasonal deals.',
    keys: ['promos'] as const,
    channels: ['email', 'push', 'sms'] as const,
  },
  {
    title: 'New Stores',
    icon: Store,
    description: 'When new halal stores join near you.',
    keys: ['stores'] as const,
    channels: ['email', 'push'] as const,
  },
  {
    title: 'Platform News',
    icon: Megaphone,
    description: 'Product updates, feature announcements, and newsletters.',
    keys: ['news'] as const,
    channels: ['email'] as const,
  },
];

const CHANNEL_LABELS: Record<string, string> = { email: 'Email', push: 'Push', sms: 'SMS' };

export default function AccountNotificationsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(loadPrefs);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    toast.success('Notification preferences saved');
    setTimeout(() => setSaved(false), 3000);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif font-bold text-2xl mb-2">Sign in to manage notifications</h2>
          <Link href="/login"><Button className="hg-gradient-primary border-0 text-white">Sign In</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Notification Preferences | Numa Fresh</title>
        <meta name="description" content="Manage your Numa Fresh notification preferences." />
      </Helmet>

      <div className="min-h-screen py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <AccountSidebar active="notifications" />

            <div className="flex-1 min-w-0">
              <Link href="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 md:hidden">
                <ArrowLeft className="w-4 h-4" /> Back to Account
              </Link>

              <div className="flex items-center justify-between mb-6">
                <h1 className="font-serif font-bold text-2xl">Notifications</h1>
                <Button
                  onClick={handleSave}
                  className={`gap-2 ${saved ? 'bg-emerald-500 hover:bg-emerald-600 border-0' : 'hg-gradient-primary border-0'} text-white`}
                  size="sm"
                >
                  {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Preferences'}
                </Button>
              </div>

              {/* Channel Header */}
              <div className="hidden md:flex justify-end gap-4 pr-1 mb-2">
                {['Email', 'Push', 'SMS'].map((ch) => (
                  <span key={ch} className="w-12 text-center text-xs font-semibold text-muted-foreground">{ch}</span>
                ))}
              </div>

              <div className="space-y-4">
                {SECTIONS.map(({ title, icon: Icon, description, keys, channels }, i) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-2xl border border-border/50 p-5"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{title}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {channels.map((ch) => {
                        const prefKey = `${ch}_${keys[0]}` as keyof NotifPrefs;
                        return (
                          <div key={ch} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{CHANNEL_LABELS[ch]}</span>
                            </div>
                            <Switch
                              checked={!!prefs[prefKey]}
                              onCheckedChange={() => toggle(prefKey)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Unsubscribe All */}
              <div className="mt-6 bg-card rounded-2xl border border-border/50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">Pause All Notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Temporarily stop all marketing communications.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      const paused = Object.fromEntries(
                        Object.keys(DEFAULT_PREFS).map((k) => {
                          const key = k as keyof NotifPrefs;
                          return [key, key.includes('orders') ? true : false];
                        })
                      ) as NotifPrefs;
                      setPrefs(paused);
                      setSaved(false);
                      toast.info('Marketing notifications paused. Order updates remain active.');
                    }}
                  >
                    Pause Marketing
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                Order updates cannot be fully disabled to ensure you receive important information about your orders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
