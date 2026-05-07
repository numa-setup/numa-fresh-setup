import { Store } from 'lucide-react';
import { OtpLoginFlow } from '@/components/auth/OtpLoginFlow';

export default function StoreLoginPage() {
  return (
    <OtpLoginFlow
      portal="seller"
      title="Store Owner Portal"
      subtitle="Sign in to manage your halal store"
      heroIcon={
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <Store className="w-6 h-6 text-white" />
        </div>
      }
      pageWrapperClass="bg-gradient-to-br from-amber-50 via-background to-orange-50/30"
      cardBorderClass="border-amber-200/60"
      primaryButtonClass="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white hover:opacity-90 flex items-center justify-center gap-1"
      alternatePortalLink={{ href: '/login', label: 'Customer sign-in →' }}
    />
  );
}
