import { AlertTriangle, CheckCircle2, Clock, XCircle, Ban, RefreshCw, ToggleLeft, ToggleRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface StoreStatusBannerProps {
  storeStatus?: string;
  isActiveManual?: boolean;
  showOnWebsite?: boolean;
  isCurrentlyOpen?: boolean;
  rejectionReason?: string;
  onboardingCompleted?: boolean;
}

export function StoreStatusBanner({
  storeStatus, isActiveManual, showOnWebsite, isCurrentlyOpen, rejectionReason, onboardingCompleted,
}: StoreStatusBannerProps) {
  const qc = useQueryClient();
  const [toggling, setToggling] = useState<string | null>(null);

  const toggle = async (type: 'active' | 'visibility') => {
    setToggling(type);
    try {
      if (type === 'active') {
        await api.patch('/store/onboarding/toggle-active', { isActive: !isActiveManual });
        toast.success(isActiveManual ? 'Store paused — no new orders' : 'Store is now accepting orders');
      } else {
        await api.patch('/store/onboarding/toggle-visibility', { visible: !showOnWebsite });
        toast.success(showOnWebsite ? 'Store hidden from website' : 'Store is now visible on website');
      }
      qc.invalidateQueries({ queryKey: ['portal'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
    setToggling(null);
  };

  if (!storeStatus) return null;

  // Banners by status
  if (storeStatus === 'pending' || !onboardingCompleted) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-amber-900 text-sm">
            {!onboardingCompleted ? 'Setup Incomplete' : 'Pending Admin Review'}
          </p>
          <p className="text-amber-700 text-xs mt-0.5">
            {!onboardingCompleted
              ? 'Complete your store setup to submit for approval. Your store won\'t appear on the marketplace until approved.'
              : 'Your store application is being reviewed. We\'ll notify you within 24–48 hours.'}
          </p>
        </div>
      </div>
    );
  }

  if (storeStatus === 'declined') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-red-900 text-sm">Application Declined</p>
          {rejectionReason && <p className="text-red-700 text-xs mt-0.5">Reason: {rejectionReason}</p>}
          <p className="text-red-700 text-xs mt-1">Please update your information and contact support to reapply.</p>
        </div>
      </div>
    );
  }

  if (storeStatus === 'suspended') {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
        <Ban className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-orange-900 text-sm">Store Suspended</p>
          {rejectionReason && <p className="text-orange-700 text-xs mt-0.5">Reason: {rejectionReason}</p>}
          <p className="text-orange-700 text-xs mt-1">Your store is currently suspended and not visible to customers. Contact support for assistance.</p>
        </div>
      </div>
    );
  }

  if (storeStatus === 'approved') {
    return (
      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold">Store Approved</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              isCurrentlyOpen ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {isCurrentlyOpen ? '● Open Now' : '○ Closed'}
            </span>
          </div>
        </div>
        {/* Control toggles */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => toggle('active')}
            disabled={!!toggling}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              isActiveManual ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
            }`}
          >
            {toggling === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isActiveManual ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {isActiveManual ? 'Accepting Orders' : 'Paused Orders'}
          </button>
          <button
            onClick={() => toggle('visibility')}
            disabled={!!toggling}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              showOnWebsite ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {toggling === 'visibility' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : showOnWebsite ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showOnWebsite ? 'Visible' : 'Hidden'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
