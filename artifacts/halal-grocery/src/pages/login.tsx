import { ShoppingBag } from 'lucide-react';
import { OtpLoginFlow } from '@/components/auth/OtpLoginFlow';

export default function LoginPage() {
  return (
    <OtpLoginFlow
      portal="customer"
      title="Numa Fresh"
      subtitle="Sign in to your account"
      heroIcon={
        <div className="hg-gradient-primary w-12 h-12 rounded-2xl flex items-center justify-center">
          <ShoppingBag className="w-6 h-6 text-white" />
        </div>
      }
      pageWrapperClass="bg-gradient-to-br from-primary/5 via-background to-emerald-50/30"
      primaryButtonClass="hg-gradient-primary border-0 text-white hover:opacity-90 flex items-center justify-center gap-1"
      alternatePortalLink={{ href: '/seller', label: 'Create a Seller account →' }}
    />
  );
}
