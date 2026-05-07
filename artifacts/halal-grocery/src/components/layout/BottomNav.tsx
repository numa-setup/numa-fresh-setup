import { Link, useLocation } from 'wouter';
import { Home, ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

const tabs = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/cart', icon: ShoppingBag, label: 'Cart', badge: true },
  { href: '/account', icon: User, label: 'Account' },
];

export function BottomNav() {
  const [location] = useLocation();
  const { itemCount } = useCart();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50 md:hidden safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map(({ href, icon: Icon, label, badge }) => {
          const isActive = location === href || (href !== '/' && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <button className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {badge && itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full hg-gradient-primary text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
