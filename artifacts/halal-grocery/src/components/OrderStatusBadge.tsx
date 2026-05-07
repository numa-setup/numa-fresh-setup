import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Package, Truck, XCircle, ChefHat, RotateCcw } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING:          { label: 'Pending',        color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: Clock },
  STORE_CONFIRMED:  { label: 'Confirmed',      color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: CheckCircle2 },
  PREPARING:        { label: 'Preparing',      color: 'bg-violet-100 text-violet-700 border-violet-200',    icon: ChefHat },
  READY:            { label: 'Ready!',         color: 'bg-primary/10 text-primary border-primary/20',       icon: Package },
  READY_FOR_PICKUP: { label: 'Ready!',         color: 'bg-primary/10 text-primary border-primary/20',       icon: Package },
  OUT_FOR_DELIVERY: { label: 'On the way',     color: 'bg-sky-100 text-sky-700 border-sky-200',             icon: Truck },
  COMPLETED:        { label: 'Completed',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  CANCELLED:        { label: 'Cancelled',      color: 'bg-red-100 text-red-700 border-red-200',             icon: XCircle },
  REFUNDED:         { label: 'Refunded',       color: 'bg-muted text-muted-foreground border-border',       icon: RotateCcw },
};

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function OrderStatusBadge({ status, size = 'md', pulse }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, ' '),
    color: 'bg-muted text-muted-foreground border-border',
    icon: Clock,
  };
  const Icon = config.icon;
  const isPreparing = status === 'PREPARING';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 border rounded-full font-medium',
      config.color,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
    )}>
      <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5', pulse && isPreparing && 'animate-pulse')} />
      {config.label}
    </span>
  );
}
