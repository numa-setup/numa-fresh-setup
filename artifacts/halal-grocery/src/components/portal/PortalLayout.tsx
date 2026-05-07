import { useState, useEffect, createContext, useContext, useLayoutEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, Package, BarChart3, DollarSign, Settings,
  Menu, X, ChevronRight, CheckCircle2, XCircle, LogOut, Loader2,
  ClipboardList, Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { NotificationBell } from '@/components/NotificationBell';

interface PortalLayoutCtxType {
  setTitle: (t?: string) => void;
}
export const PortalLayoutCtx = createContext<PortalLayoutCtxType | null>(null);

interface PortalLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const NAV_ITEMS = [
  { href: '/store-portal', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/store-portal/orders', icon: ShoppingBag, label: 'Orders' },
  { href: '/store-portal/products', icon: Package, label: 'Products' },
  { href: '/store-portal/inventory', icon: Boxes, label: 'Inventory' },
  { href: '/store-portal/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/store-portal/payouts', icon: DollarSign, label: 'Payouts' },
  { href: '/store-portal/onboarding', icon: ClipboardList, label: 'Setup' },
  { href: '/store-portal/settings', icon: Settings, label: 'Settings' },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right">
      <div className="text-sm font-bold tabular-nums">
        {now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

export function PortalLayout({ children, title }: PortalLayoutProps) {
  const ctx = useContext(PortalLayoutCtx);

  // Header state — only meaningful when this is the root shell
  const [headerTitle, setHeaderTitle] = useState<string | undefined>(undefined);

  // All hooks declared unconditionally (Rules of Hooks)
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPortalSwitch, setShowPortalSwitch] = useState(false);

  const { data: dashboard } = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: () => api.get<any>('/store/dashboard'),
    refetchInterval: 10000,
    retry: false,
    enabled: !ctx, // only fetch when root shell
  });

  const pendingCount = Number(dashboard?.pendingOrders || 0);

  const handleToggleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      await api.patch('/store/onboarding/toggle-active', { isActive: next });
    } catch {
      setIsOpen(!next);
    }
  };

  useEffect(() => {
    const manual = dashboard?.store?.isActiveManual;
    if (manual !== undefined && manual !== null) {
      setIsOpen(Boolean(manual));
    }
  }, [dashboard?.store?.isActiveManual]);

  // When nested: push title up to the root shell's header
  useLayoutEffect(() => {
    if (ctx) {
      ctx.setTitle(title);
    }
  }, [title, ctx]);

  // ── NESTED MODE ────────────────────────────────────────────────────────────
  if (ctx) return <>{children}</>;

  // ── ROOT MODE ──────────────────────────────────────────────────────────────

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? 'w-72' : 'w-64'}`}>
      {/* Logo — on mobile, leave room for the ✕ close button at top-right */}
      <div className={`p-5 border-b border-border/50 ${mobile ? 'pr-14' : ''}`}>
        <Link href="/store-portal" className="flex items-center gap-2.5 group" onClick={() => mobile && setSidebarOpen(false)}>
          <div className="w-9 h-9 rounded-xl hg-gradient-primary flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm font-serif">حل</span>
          </div>
          <div>
            <div className="font-serif font-bold text-sm leading-none">Store Portal</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Numa Fresh</div>
          </div>
        </Link>
      </div>

      {/* Store Status */}
      {dashboard?.store && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">{dashboard.store.name}</div>
          <button
            onClick={handleToggleOpen}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              isOpen
                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
            }`}
          >
            <span className="flex items-center gap-2">
              {isOpen ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {isOpen ? 'STORE OPEN' : 'STORE CLOSED'}
            </span>
            <span className="text-[10px] opacity-60">tap to toggle</span>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? location === href : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => mobile && setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                active
                  ? 'hg-gradient-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              <span className="flex-1">{label}</span>
              {label === 'Orders' && pendingCount > 0 && (
                <Badge className="h-5 min-w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-white border-0 rounded-full">
                  {pendingCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full hg-gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-[10px] text-muted-foreground">Store Owner</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs h-8 rounded-lg"
            onClick={() => { if (mobile) setSidebarOpen(false); setShowPortalSwitch(true); }}>
            <ChevronRight className="h-3 w-3 mr-1 rotate-180" /> Customer View
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowLogoutConfirm(true)}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <PortalLayoutCtx.Provider value={{ setTitle: setHeaderTitle }}>
      <div className="h-screen overflow-hidden flex bg-muted/30">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col bg-card border-r border-border/50 shrink-0 w-64 h-screen overflow-y-auto overflow-x-hidden">
          <Sidebar />
        </aside>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
                onTouchEnd={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed left-0 top-0 h-full bg-card z-50 md:hidden flex flex-col"
                style={{ overflowY: 'auto', overflowX: 'hidden' }}
              >
                {/* Close button — high z-index, 44px touch target, handles both click and touch */}
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setSidebarOpen(false)}
                  onTouchEnd={(e) => { e.preventDefault(); setSidebarOpen(false); }}
                  className="absolute top-3 right-3 z-[9999] flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  style={{ width: 44, height: 44, minHeight: 'unset' }}
                >
                  <X className="h-5 w-5" />
                </button>
                <Sidebar mobile />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-sm border-b border-border/50 px-4 sm:px-6 h-14 flex items-center gap-3 shrink-0">
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-4.5 w-4.5" />
            </Button>

            <div className="flex-1">
              {headerTitle && <h1 className="font-semibold text-sm truncate">{headerTitle}</h1>}
            </div>

            <div className="flex items-center gap-3">
              <Clock />
              <NotificationBell role="STORE_OWNER" />
            </div>
          </header>

          {/* Page Content — only this area scrolls */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>

        {/* Switch to Customer View confirmation */}
        <AlertDialog open={showPortalSwitch} onOpenChange={setShowPortalSwitch}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch Portal?</AlertDialogTitle>
              <AlertDialogDescription>
                You are currently managing your store as <strong>{user?.firstName} {user?.lastName}</strong> (Store Owner). You will be taken to the customer-facing website. Your store session will remain active.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="hg-gradient-primary border-0 text-white hover:opacity-90"
                onClick={() => setLocation('/')}
              >
                Yes, Switch
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Logout confirmation */}
        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of Store Portal?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll be signed out of your store management account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => { logout(); setLocation('/store-login'); }}
              >
                Sign Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PortalLayoutCtx.Provider>
  );
}
