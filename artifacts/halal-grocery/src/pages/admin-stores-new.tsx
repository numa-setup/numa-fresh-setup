import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  STEPS, StepIndicator,
  Step1, Step2, Step3, Step4, Step5, Step6, Step7, StepFeaturedSection, Step8,
} from './store-portal-onboarding';

interface OwnerData {
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPassword: string;
}

function StepOwner({ owner, onChange }: { owner: OwnerData; onChange: (k: keyof OwnerData, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-primary" />
        <h2 className="font-serif font-bold text-xl">Store Owner Account</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Enter the email of the store owner. If they already have an account, it will be linked.
        Otherwise, a new STORE_OWNER account will be created with the temporary password below.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Owner Email *</label>
          <Input type="email" value={owner.ownerEmail} onChange={e => onChange('ownerEmail', e.target.value)} placeholder="owner@example.com" className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name</label>
          <Input value={owner.ownerFirstName} onChange={e => onChange('ownerFirstName', e.target.value)} placeholder="Ahmad" className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name</label>
          <Input value={owner.ownerLastName} onChange={e => onChange('ownerLastName', e.target.value)} placeholder="Khan" className="h-12 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Temporary Password</label>
          <Input value={owner.ownerPassword} onChange={e => onChange('ownerPassword', e.target.value)} placeholder="Will be auto-generated if blank" className="h-12 rounded-xl" />
          <p className="text-[10px] text-muted-foreground mt-1">Owner can change this after first login. Leave blank to auto-generate.</p>
        </div>
      </div>
    </div>
  );
}

const TOTAL_STEPS = STEPS.length + 1; // 8 wizard steps + 1 owner step at start

export default function AdminStoresNewPage() {
  const [step, setStep] = useState(0); // 0 = owner, 1-8 = wizard steps
  const [saving, setSaving] = useState(false);
  const [, setLocation] = useLocation();

  const [owner, setOwner] = useState<OwnerData>({
    ownerEmail: '', ownerFirstName: '', ownerLastName: '', ownerPassword: '',
  });

  const [formData, setFormData] = useState<Record<string, any>>({
    name: '', branchName: '', tagline: '', phone: '', email: '', description: '',
    logo: '', banner: '', cardImage: '',
    address: '', city: '', province: 'TX', postalCode: '', googleMapsLink: '',
    openingHoursJson: {},
    slotDurationMinutes: 30, maxOrdersPerSlot: 5,
    pickupAvailable: true, curbsideAvailable: false, deliveryAvailable: false,
    minOrderAmount: '0', avgPrepTimeMinutes: '15', amenityTags: [],
    isHalalCertified: false, halalCertNumber: '', halalCertBody: '', halalCertExpiry: '',
    categories: ['Meat & Poultry', 'Produce', 'Dairy', 'Packaged Goods', 'Spices & Condiments'],
  });

  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));
  const updateOwner = (key: keyof OwnerData, value: string) => setOwner(prev => ({ ...prev, [key]: value }));

  const goNext = () => {
    if (step === 0) {
      if (!owner.ownerEmail.trim()) { toast.error('Owner email is required'); return; }
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  };
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...formData, ...owner };
      const res: any = await api.post('/admin/stores', payload);
      toast.success(`Store "${res.store?.name || 'New Store'}" created and approved!`);
      setTimeout(() => setLocation('/admin/stores'), 1500);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create store');
      setSaving(false);
      throw e;
    }
  };

  const wizardStep = step; // 0 = owner, 1-8 = steps
  const stepContent: Record<number, JSX.Element> = {
    0: <StepOwner owner={owner} onChange={updateOwner} />,
    1: <Step1 data={formData} onChange={updateField} />,
    2: <Step2 data={formData} onChange={updateField} />,
    3: <Step3 data={formData} onChange={updateField} />,
    4: <Step4 data={formData} onChange={updateField} />,
    5: <Step5 data={formData} onChange={updateField} />,
    6: <Step6 data={formData} onChange={updateField} />,
    7: <Step7 data={formData} onChange={updateField} />,
    8: <StepFeaturedSection data={formData} onChange={updateField} />,
    9: (
      <Step8
        data={formData}
        saving={saving}
        onSubmit={handleSubmit}
        submitLabel="Create & Approve Store"
        successTitle="Store Created!"
        successSubtitle="The store has been created and auto-approved. Redirecting to store list…"
      />
    ),
  };

  return (
    <AdminLayout title="Add New Store" subtitle="Create & auto-approve a new store">
      <div className="max-w-2xl mx-auto space-y-6 p-4 lg:p-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/stores')} className="rounded-xl gap-1">
            <ChevronLeft className="h-4 w-4" /> Back to Stores
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Step {wizardStep === 0 ? 'Owner' : wizardStep} of {TOTAL_STEPS - 1}
          </span>
        </div>

        {wizardStep > 0 && <StepIndicator current={wizardStep} />}

        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="hg-gradient-primary h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${((wizardStep + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={wizardStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {stepContent[wizardStep]}
            </motion.div>
          </AnimatePresence>
        </div>

        {wizardStep < 9 && (
          <div className="flex gap-3">
            {wizardStep > 0 && (
              <Button variant="outline" className="flex-1 h-12 rounded-xl gap-2" onClick={goBack}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <Button
              className="flex-1 h-12 hg-gradient-primary border-0 text-white rounded-xl gap-2 font-semibold"
              onClick={goNext}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {wizardStep === 8 ? 'Review & Create' : 'Continue'} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {wizardStep === 9 && !saving && (
          <Button variant="outline" className="w-full h-12 rounded-xl gap-2" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" /> Back to Edit
          </Button>
        )}
      </div>
    </AdminLayout>
  );
}
