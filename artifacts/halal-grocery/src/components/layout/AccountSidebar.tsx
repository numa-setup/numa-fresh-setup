import { Link, useLocation } from 'wouter';
import { User, MapPin, Bell, Package, ChevronRight, LogOut, RefreshCw, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/account', icon: User, label: 'Profile', id: 'profile' },
  { href: '/account/addresses', icon: MapPin, label: 'Addresses', id: 'addresses' },
  { href: '/account/notifications', icon: Bell, label: 'Notifications', id: 'notifications' },
  { href: '/account/saved', icon: Heart, label: 'Saved', id: 'saved' },
  { href: '/account/scheduled-orders', icon: RefreshCw, label: 'Scheduled', id: 'scheduled-orders' },
  { href: '/orders', icon: Package, label: 'My Orders', id: 'orders' },
];

interface AccountSidebarProps {
  active?: string;
}

export function AccountSidebar({ active }: AccountSidebarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  return (
    <>
      {/* ── Mobile horizontal scrollable tab bar ── */}
      <div className="md:hidden w-full mb-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label, id }) => {
            const isActive = active === id || (!active && location === href);
            return (
              <Link key={id} href={href}>
                <div className={cn(
                  'flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap border',
                  isActive
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-card text-foreground/80 border-border/50 hover:bg-muted',
                )}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {label}
                </div>
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-xs font-medium border border-border/50 bg-card text-destructive whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0">
        {/* User card */}
        <div className="bg-card rounded-2xl border border-border/50 p-4 mb-3">
          <div className="flex items-center gap-3 mb-1">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm font-bold hg-gradient-primary text-white">
                {user.firstName[0]}{user.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          {NAV_ITEMS.map(({ href, icon: Icon, label, id }) => {
            const isActive = active === id;
            return (
              <Link key={id} href={href}>
                <div className={cn(
                  'flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-muted/50 border-b border-border/40 last:border-0 cursor-pointer',
                  isActive ? 'text-primary bg-primary/5 font-medium' : 'text-foreground/80',
                )}>
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary/60" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 text-muted-foreground hover:text-destructive justify-start gap-2 px-2"
          onClick={logout}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </aside>
    </>
  );
}
