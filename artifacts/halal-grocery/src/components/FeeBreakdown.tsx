import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FeeRow {
  label: string;
  amount: number;
  negative?: boolean;
  info?: string;
  muted?: boolean;
}

interface FeeBreakdownProps {
  rows: FeeRow[];
  total: number;
  currency?: string;
  hasMeat?: boolean;
}

export function FeeBreakdown({ rows, total, currency = 'CAD', hasMeat }: FeeBreakdownProps) {
  const fmt = (n: number) => `$${Math.abs(n).toFixed(2)}`;

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className={`flex items-center justify-between text-sm ${row.muted ? 'text-muted-foreground' : ''}`}>
          <div className="flex items-center gap-1">
            <span>{row.label}</span>
            {row.info && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">{row.info}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className={row.negative ? 'text-primary font-medium' : ''}>
            {row.negative ? '-' : ''}{fmt(row.amount)}
          </span>
        </div>
      ))}
      <div className="border-t border-border/50 pt-2 mt-2">
        <div className="flex items-center justify-between font-semibold">
          <span>Estimated Total</span>
          <span className="text-lg text-primary">${total.toFixed(2)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{currency} · Including all fees</p>
      </div>
      {hasMeat && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>⚖️ Fresh meat note:</strong> Meat items are priced by final weight. We pre-authorize the estimated amount and only charge the final amount after weighing.
          </p>
        </div>
      )}
    </div>
  );
}
