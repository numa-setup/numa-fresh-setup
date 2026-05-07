import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { MapPin, Plus, Trash2, CheckCircle, ArrowLeft, Home, Briefcase, Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useAddresses, useAddAddress } from '@/hooks/useUser';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { AccountSidebar } from '@/components/layout/AccountSidebar';

const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(3, 'Street address required'),
  city: z.string().min(2, 'City required'),
  province: z.string().min(2, 'State required'),
  postalCode: z.string().min(5, 'ZIP code required'),
  isDefault: z.boolean().default(false),
});

type AddressForm = z.infer<typeof addressSchema>;

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const LABEL_ICONS: Record<string, typeof Home> = {
  Home: Home,
  Work: Briefcase,
  Other: Building2,
};

export default function AccountAddressesPage() {
  const { user } = useAuth();
  const { data: addresses = [], isLoading } = useAddresses();
  const addAddress = useAddAddress();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const deleteAddress = useMutation({
    mutationFn: (id: string) => api.delete(`/users/addresses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'addresses'] });
      toast.success('Address removed');
    },
    onError: () => toast.error('Failed to remove address'),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patch(`/users/addresses/${id}`, { isDefault: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'addresses'] });
      toast.success('Default address updated');
    },
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: { province: 'TX', isDefault: false },
  });

  const onSubmit = (data: AddressForm) => {
    addAddress.mutate(data, {
      onSuccess: () => {
        toast.success('Address saved!');
        reset({ province: 'TX', isDefault: false });
        setShowForm(false);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to add address';
        toast.error(msg);
      },
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif font-bold text-2xl mb-2">Sign in to manage addresses</h2>
          <Link href="/login"><Button className="hg-gradient-primary border-0 text-white">Sign In</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Saved Addresses | Numa Fresh</title>
        <meta name="description" content="Manage your delivery addresses on Numa Fresh." />
      </Helmet>

      <div className="min-h-screen py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <AccountSidebar active="addresses" />

            <div className="flex-1 min-w-0">
              <Link href="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 md:hidden">
                <ArrowLeft className="w-4 h-4" /> Back to Account
              </Link>

              <div className="flex items-center justify-between mb-6">
                <h1 className="font-serif font-bold text-2xl">Saved Addresses</h1>
                <Button
                  onClick={() => setShowForm(v => !v)}
                  className="hg-gradient-primary border-0 text-white gap-2"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  {showForm ? 'Cancel' : 'Add New'}
                </Button>
              </div>

              {/* Add Address Form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-card rounded-2xl border border-border/50 p-5 mb-5">
                      <h3 className="font-semibold mb-4">New Address</h3>
                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                          <Label>Label</Label>
                          <div className="flex gap-2 mt-1">
                            {['Home', 'Work', 'Other'].map((l) => {
                              const Icon = LABEL_ICONS[l];
                              const current = watch('label');
                              return (
                                <button
                                  key={l}
                                  type="button"
                                  onClick={() => setValue('label', l)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${current === l ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`}
                                >
                                  <Icon className="w-3.5 h-3.5" /> {l}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <Label>Street Address *</Label>
                          <Input className="mt-1" {...register('street')} placeholder="123 Main St, Unit 4" />
                          {errors.street && <p className="text-xs text-destructive mt-1">{errors.street.message}</p>}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <Label>City *</Label>
                            <Input className="mt-1" {...register('city')} placeholder="Houston" />
                            {errors.city && <p className="text-xs text-destructive mt-1">{errors.city.message}</p>}
                          </div>
                          <div>
                            <Label>State *</Label>
                            <Select value={watch('province')} onValueChange={(v) => setValue('province', v, { shouldValidate: true })}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {US_STATES.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>ZIP Code *</Label>
                            <Input className="mt-1" {...register('postalCode')} placeholder="10001" />
                            {errors.postalCode && <p className="text-xs text-destructive mt-1">{errors.postalCode.message}</p>}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" {...register('isDefault')} className="rounded" />
                          Set as default delivery address
                        </label>

                        <Button type="submit" className="hg-gradient-primary border-0 text-white" disabled={addAddress.isPending}>
                          {addAddress.isPending ? 'Saving...' : 'Save Address'}
                        </Button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Address List */}
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : addresses.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence>
                    {addresses.map((addr: any, i: number) => {
                      const Icon = LABEL_ICONS[addr.label] || MapPin;
                      return (
                        <motion.div
                          key={addr.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`bg-card rounded-2xl border p-4 ${addr.isDefault ? 'border-primary/30 bg-primary/5' : 'border-border/50'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${addr.isDefault ? 'bg-primary/10' : 'bg-muted'}`}>
                              <Icon className={`w-5 h-5 ${addr.isDefault ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {addr.label && <p className="font-medium text-sm">{addr.label}</p>}
                                {addr.isDefault && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                    <CheckCircle className="w-3 h-3" /> Default
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{addr.line1 || addr.street}</p>
                              <p className="text-sm text-muted-foreground">{addr.city}, {addr.province} {addr.postalCode}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!addr.isDefault && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 text-muted-foreground"
                                  onClick={() => setDefault.mutate(addr.id)}
                                  disabled={setDefault.isPending}
                                >
                                  Set Default
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteAddress.mutate(addr.id)}
                                disabled={deleteAddress.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium mb-1">No addresses saved</p>
                  <p className="text-sm text-muted-foreground mb-4">Add a delivery address to speed up checkout.</p>
                  <Button onClick={() => setShowForm(true)} className="hg-gradient-primary border-0 text-white gap-2">
                    <Plus className="w-4 h-4" /> Add Address
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
