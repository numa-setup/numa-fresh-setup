import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface HalalBadgeProps {
  certNumber?: string | null;
  variant?: 'default' | 'minimal' | 'gold';
  className?: string;
}

export function HalalBadge({ certNumber, variant = 'default', className }: HalalBadgeProps) {
  if (variant === 'minimal') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium text-primary', className)}>
        <CheckCircle2 className="h-3 w-3" />
        Halal Certified
      </span>
    );
  }

  if (variant === 'gold') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold hg-gold-badge', className)}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Halal Certified{certNumber && ` · ${certNumber}`}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20', className)}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      Halal Certified
    </span>
  );
}
