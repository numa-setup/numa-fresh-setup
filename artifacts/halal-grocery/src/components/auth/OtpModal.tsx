import { Dialog, DialogContent } from '@/components/ui/dialog';
import { OtpLoginFlow } from '@/components/auth/OtpLoginFlow';
import { ShoppingBag } from 'lucide-react';

interface OtpModalProps {
  open: boolean;
  onClose: () => void;
}

export function OtpModal({ open, onClose }: OtpModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] p-0 overflow-y-auto max-h-[90dvh] rounded-3xl border-border/50">
        <OtpLoginFlow
          inModal
          portal="customer"
          title="Numa Fresh"
          subtitle="Sign in or create your account"
          heroIcon={
            <div className="hg-gradient-primary w-12 h-12 rounded-2xl flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
          }
          pageWrapperClass="p-6"
          primaryButtonClass="hg-gradient-primary border-0 text-white hover:opacity-90"
          alternatePortalLink={{ href: '/store-login', label: 'Store Owner? Sign in here →' }}
          onSuccess={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
