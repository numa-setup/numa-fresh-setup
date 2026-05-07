import { ShieldCheck } from 'lucide-react';

interface HalalBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function HalalBadge({ size = 'md', showLabel = true }: HalalBadgeProps) {
  const sizes = {
    sm: { icon: 'w-3 h-3', text: 'text-[10px]', px: 'px-2 py-0.5', gap: 'gap-1' },
    md: { icon: 'w-3.5 h-3.5', text: 'text-xs', px: 'px-2.5 py-1', gap: 'gap-1.5' },
    lg: { icon: 'w-4 h-4', text: 'text-sm', px: 'px-3 py-1.5', gap: 'gap-2' },
  };
  const s = sizes[size];

  return (
    <span className={`inline-flex items-center ${s.gap} ${s.px} rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-semibold`}>
      <ShieldCheck className={s.icon} />
      {showLabel && <span className={s.text}>Halal</span>}
    </span>
  );
}
