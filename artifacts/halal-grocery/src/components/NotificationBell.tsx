import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, ShoppingBag, Store, Star, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { connectForRole, type Role } from '@/lib/socket';
import { useLocation as useWouter } from 'wouter';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  orderId?: string;
  dataJson?: { orderId?: string; conversationId?: string; storeId?: string };
}

function getNavTarget(notif: Notification): string {
  const d = notif.dataJson ?? {};
  switch (notif.type) {
    case 'ORDER_PLACED':
    case 'ORDER_STATUS':
    case 'NEW_ORDER_SAVED':
      return d.orderId ? `/orders/${d.orderId}` : '/orders';
    case 'NEW_ORDER':
      return d.orderId ? `/store-portal/orders/${d.orderId}` : '/store-portal/orders';
    case 'STORE_APPROVED':
    case 'STORE_REJECTED':
      return '/store-portal';
    default:
      return '/';
  }
}

function NotifIcon({ type }: { type: string }) {
  if (type.includes('ORDER')) return <ShoppingBag className="w-4 h-4 text-primary shrink-0" />;
  if (type.includes('STORE')) return <Store className="w-4 h-4 text-emerald-500 shrink-0" />;
  return <Star className="w-4 h-4 text-amber-500 shrink-0" />;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface Props {
  role?: Role;
  className?: string;
  iconClassName?: string;
}

export function NotificationBell({ role = 'CUSTOMER', className = '', iconClassName = '' }: Props) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [, navigate] = useWouter();
  const qc = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);

  const { data, refetch } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=30'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  // Real-time via socket
  useEffect(() => {
    if (!isAuthenticated) return;
    const handle = connectForRole(role);
    if (!handle) return;
    const { socket, release } = handle;

    const onNew = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    socket.on('new_notification', onNew);
    return () => {
      socket.off('new_notification', onNew);
      release();
    };
  }, [isAuthenticated, role, qc]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = useCallback(async (id: string) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/mark-all-read').catch(() => {});
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  const handleClick = async (notif: Notification) => {
    if (!notif.isRead) await markRead(notif.id);
    setOpen(false);
    navigate(getNavTarget(notif));
  };

  if (!isAuthenticated) return null;

  return (
    <div ref={dropRef} className={`relative ${className}`}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) refetch(); }}
        className="relative p-2 rounded-xl hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className={`w-[18px] h-[18px] ${iconClassName}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80 sm:mt-2 max-h-[420px] bg-card border border-border/50 rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-primary hover:underline">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b border-border/20 last:border-0 ${!n.isRead ? 'bg-primary/4' : ''}`}
                >
                  <div className="mt-0.5">
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-snug ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {n.title}
                      {!n.isRead && <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-primary rounded-full align-middle" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
