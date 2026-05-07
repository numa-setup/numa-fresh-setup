import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: 'sm' | 'md';
}

export function StarRating({ rating, max = 5, size = 'sm' }: StarRatingProps) {
  const sz = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        return (
          <Star
            key={i}
            className={`${sz} ${filled || half ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
          />
        );
      })}
    </div>
  );
}
