import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, body, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{title}</h3>
      {body && <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{body}</p>}
      {action && (
        <Button className="mt-5 hg-gradient-primary border-0 text-white rounded-xl" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
