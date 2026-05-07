import { useState } from 'react';
import { Star, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface ReviewModalProps {
  targetType: 'platform' | 'store' | 'product';
  storeId?: string;
  productSlug?: string;
  targetName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReviewModal({ targetType, storeId, productSlug, targetName, onClose, onSuccess }: ReviewModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [authorName, setAuthorName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : ''
  );
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayRating = hoverRating || rating;

  const LABEL: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rating) { setError('Please select a star rating.'); return; }
    if (!authorName.trim()) { setError('Please enter your name.'); return; }
    setSubmitting(true);
    try {
      await api.post('/site-reviews', { targetType, storeId, productSlug, authorName: authorName.trim(), rating, comment: comment.trim() });
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const targetLabel = targetType === 'platform' ? 'Numa Fresh' : targetName || 'this store';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl border border-border/50 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-green-600 fill-green-500" />
            </div>
            <h3 className="font-serif text-xl font-bold mb-2">Thank you!</h3>
            <p className="text-sm text-muted-foreground mb-6">Your review has been submitted and will appear after admin approval.</p>
            <Button onClick={onClose} className="hg-gradient-primary border-0 text-white rounded-xl px-8">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-5">
              <h3 className="font-serif text-lg font-bold">Write a Review</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Share your experience with {targetLabel}</p>
            </div>

            {/* Star Rating */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-foreground mb-2 block">Your Rating</label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} type="button"
                    onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(s)}
                    className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`${s} star${s !== 1 ? 's' : ''}`}
                  >
                    <Star className={`w-7 h-7 transition-colors ${s <= displayRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
                {displayRating > 0 && (
                  <span className="ml-2 text-sm font-semibold text-amber-600">{LABEL[displayRating]}</span>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Your Name</label>
              <input
                type="text" value={authorName} onChange={e => setAuthorName(e.target.value)}
                placeholder="e.g. Fatima R."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required maxLength={80}
              />
            </div>

            {/* Comment */}
            <div className="mb-5">
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Your Review <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="What did you like or dislike? Would you recommend it?"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                maxLength={1000}
              />
              <p className="text-right text-xs text-muted-foreground mt-1">{comment.length}/1000</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}

            <p className="text-xs text-muted-foreground mb-4">Reviews are submitted for admin approval before appearing publicly.</p>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
              <Button type="submit" disabled={submitting} className="flex-1 hg-gradient-primary border-0 text-white rounded-xl gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4" /> Submit Review</>}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
