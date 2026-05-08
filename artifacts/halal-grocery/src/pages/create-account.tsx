import { UserPlus } from 'lucide-react';
import { OtpLoginFlow } from '@/components/auth/OtpLoginFlow';

export default function CreateAccountPage() {
  return (
    <OtpLoginFlow
      portal="customer"
      title="Join Numa Fresh"
      subtitle="Create your free account in seconds"
      heroIcon={
        <div className="hg-gradient-primary w-12 h-12 rounded-2xl flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
      }
      pageWrapperClass="bg-gradient-to-br from-primary/5 via-background to-emerald-50/30"
      primaryButtonClass="hg-gradient-primary border-0 text-white hover:opacity-90 flex items-center justify-center gap-1"
      alternatePortalLink={{ href: '/login', label: 'Already have an account? Sign in →' }}
    />
  );
}
