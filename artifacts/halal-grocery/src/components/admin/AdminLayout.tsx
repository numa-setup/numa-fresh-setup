import { useState, useEffect, createContext, useContext, useLayoutEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Store, ShoppingBag, Users, DollarSign, BarChart3,
  Settings, FileText, ChevronRight, Menu, X,
  LogOut, Image, Shield, ChevronDown, Package, Globe, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const NAV_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/admin/stores', icon: Store, label: 'Store Management', badge: 'pending' },
  { href: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
  { href: '/admin/products', icon: Package, label: 'Products', badge: 'pending' },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/finance', icon: DollarSign, label: 'Finance' },
  { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/admin/content', icon: Image, label: 'Content' },
  { href: '/admin/website', icon: Globe, label: 'Website CMS' },
  { href: '/admin/reviews', icon: Star, label: 'Reviews (Orders)' },
  { href: '/admin/site-reviews', icon: Star, label: 'Reviews (Community)' },
  { href: '/admin/audit', icon: FileText, label: 'Audit Log' },
];

interface AdminLayoutCtxType {
  setTitle: (t?: string) => void;
  setSubtitle: (s?: string) => void;
}
export const AdminLayoutCtx = createContext<AdminLayoutCtxType | null>(null);

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const ctx = useContext(AdminLayoutCtx);

  // Header state — only meaningful when this is the root shell
  const [headerTitle, setHeaderTitle] = useState<string | undefined>(undefined);
  const [headerSubtitle, setHeaderSubtitle] = useState<string | undefined>(undefined);

  // All auth/UI state must be declared unconditionally (Rules of Hooks)
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // When nested: push title/subtitle up to the root shell's header
  useLayoutEffect(() => {
    if (ctx) {
      ctx.setTitle(title);
      ctx.setSubtitle(subtitle);
    }
  }, [title, subtitle, ctx]);

  // When root: redirect unauthenticated / wrong-role users
  useEffect(() => {
    if (!ctx && (!user || user.role !== 'ADMIN')) setLocation('/admin');
  }, [user, ctx]);

  // ── NESTED MODE ────────────────────────────────────────────────────────────
  // Root shell already owns sidebar + header. Just pass the page content through.
  if (ctx) return <>{children}</>;

  // ── ROOT MODE ──────────────────────────────────────────────────────────────
  if (!user || user.role !== 'ADMIN') return null;

  const isActive = (href: string, exact?: boolean) =>
    exact ? location === href : location === href || location.startsWith(href + '/');

  return (
    <AdminLayoutCtx.Provider value={{ setTitle: setHeaderTitle, setSubtitle: setHeaderSubtitle }}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 flex flex-col transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/10">
            <div className="w-8 h-8 rounded-lg hg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm font-serif">حل</span>
            </div>
            <div>
              <span className="font-serif font-bold text-white text-sm leading-none block">Numa Fresh</span>
              <span className="text-white/40 text-[10px] tracking-wider">Admin Panel</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 overflow-y-auto">
            <div className="px-3 space-y-0.5">
              {NAV_ITEMS.map(({ href, icon: Icon, label, exact, badge }) => (
                <Link key={href} href={href} onClick={() => setSidebarOpen(false)}>
                  <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${
                    isActive(href, exact)
                      ? 'bg-primary text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/8'
                  }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {badge === 'pending' && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">!</span>
                    )}
                    {badge && badge !== 'pending' && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">{badge}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </nav>

          {/* User card */}
          <div className="p-4 border-t border-white/10">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/8 transition-colors text-left"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary text-white">
                    {user.firstName[0]}{user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold leading-none truncate">{user.firstName} {user.lastName}</p>
                  <p className="text-white/40 text-[10px] mt-0.5 truncate">{user.email}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/40" />
              </button>
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-xl"
                  >
                    <Link href="/" onClick={() => setUserMenuOpen(false)}>
                      <div className="flex items-center gap-2 px-3 py-2.5 text-white/70 text-xs hover:bg-white/8 cursor-pointer">
                        <ChevronRight className="w-3.5 h-3.5" /> Customer App
                      </div>
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); setShowLogoutConfirm(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-red-400 text-xs hover:bg-white/8 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>

        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top bar */}
          <header className="shrink-0 h-14 bg-white border-b border-border/50 flex items-center gap-3 px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              {(headerTitle) && (
                <div>
                  <h1 className="font-serif font-bold text-base leading-none truncate">{headerTitle}</h1>
                  {headerSubtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{headerSubtitle}</p>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell role="ADMIN" />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium">
                <Shield className="w-3.5 h-3.5 text-primary" />
                Admin
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Logout confirmation */}
        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of Admin Portal?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll be signed out of your admin account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => { logout(); setLocation('/admin-login'); }}
              >
                Sign Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayoutCtx.Provider>
  );
}
