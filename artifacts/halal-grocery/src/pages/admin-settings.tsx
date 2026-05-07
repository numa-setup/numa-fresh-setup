import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Save, Settings, DollarSign, Star, Globe, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface PlatformSettings {
  defaultCommissionRate: number;
  defaultConvenienceFee: number;
  defaultCurbsideFee: number;
  loyaltyPointsPerDollar: number;
  pointsRedemptionRate: number;
  minOrderForLoyalty: number;
  payoutSchedule: string;
  supportedStates: string[];
  maintenanceMode: boolean;
  platformName: string;
  supportEmail: string;
  maxOrdersPerSlot: number;
  defaultSlotDurationMinutes: number;
}

const SECTIONS = [
  { key: 'commission', label: 'Commission & Fees', icon: DollarSign },
  { key: 'platform', label: 'Platform Config', icon: Globe },
  { key: 'maintenance', label: 'Maintenance', icon: Shield },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('commission');

  useEffect(() => {
    setLoading(true);
    api.get<PlatformSettings>('/admin/settings').then(d => {
      setSettings(d); setDraft(d); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleChange = <K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: val } : prev);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await api.put('/admin/settings', draft);
      setSettings(updated); setDraft(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);

  return (
    <AdminLayout title="Platform Settings" subtitle="Configure global platform parameters">
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar nav */}
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${activeSection === s.key ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <s.icon className="w-4 h-4 shrink-0" /> {s.label}
              </button>
            ))}
          </div>

          {/* Settings form */}
          <div className="lg:col-span-3 space-y-4">
            {loading ? (
              <div className="space-y-4">{Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : draft ? (
              <>
                {/* Commission & Fees */}
                {activeSection === 'commission' && (
                  <Card>
                    <CardHeader><CardTitle className="font-serif text-base">Commission & Fees</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Default Commission Rate (%)</Label>
                          <div className="relative">
                            <Input type="number" min="0" max="50" step="0.5" value={draft.defaultCommissionRate}
                              onChange={e => handleChange('defaultCommissionRate', Number(e.target.value))} className="rounded-xl pr-8" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Applied to new stores by default</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Default Convenience Fee ($)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                            <Input type="number" min="0" step="0.01" value={draft.defaultConvenienceFee}
                              onChange={e => handleChange('defaultConvenienceFee', Number(e.target.value))} className="rounded-xl pl-7" />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Per-order platform fee</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Default Curbside Fee ($)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                            <Input type="number" min="0" step="0.01" value={draft.defaultCurbsideFee}
                              onChange={e => handleChange('defaultCurbsideFee', Number(e.target.value))} className="rounded-xl pl-7" />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Curbside pickup service fee</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Payout Schedule</Label>
                        <div className="flex gap-2">
                          {['daily', 'weekly', 'biweekly', 'monthly'].map(s => (
                            <button key={s} onClick={() => handleChange('payoutSchedule', s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${draft.payoutSchedule === s ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Platform */}
                {activeSection === 'platform' && (
                  <Card>
                    <CardHeader><CardTitle className="font-serif text-base">Platform Configuration</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Platform Name</Label>
                          <Input value={draft.platformName} onChange={e => handleChange('platformName', e.target.value)} className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Support Email</Label>
                          <Input type="email" value={draft.supportEmail} onChange={e => handleChange('supportEmail', e.target.value)} className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Max Orders per Slot</Label>
                          <Input type="number" min="1" value={draft.maxOrdersPerSlot} onChange={e => handleChange('maxOrdersPerSlot', Number(e.target.value))} className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Default Slot Duration (minutes)</Label>
                          <Input type="number" min="15" step="15" value={draft.defaultSlotDurationMinutes} onChange={e => handleChange('defaultSlotDurationMinutes', Number(e.target.value))} className="rounded-xl" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Supported States</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {['TX', 'IL', 'CA', 'NY', 'FL', 'NJ', 'VA', 'MI', 'OH', 'GA', 'MD', 'PA', 'WA', 'CO', 'AZ'].map(state => (
                            <button key={state} onClick={() => {
                              const cur = draft.supportedStates;
                              handleChange('supportedStates', cur.includes(state) ? cur.filter(s => s !== state) : [...cur, state]);
                            }} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${draft.supportedStates.includes(state) ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                              {state}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Maintenance */}
                {activeSection === 'maintenance' && (
                  <Card>
                    <CardHeader><CardTitle className="font-serif text-base">Maintenance Mode</CardTitle></CardHeader>
                    <CardContent>
                      <div className={`p-4 rounded-xl border-2 ${draft.maintenanceMode ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                        <div className="flex items-start gap-3">
                          {draft.maintenanceMode ? <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
                          <div className="flex-1">
                            <p className={`font-semibold ${draft.maintenanceMode ? 'text-red-700' : 'text-green-700'}`}>
                              {draft.maintenanceMode ? 'Maintenance Mode Active' : 'Platform is Live'}
                            </p>
                            <p className={`text-sm mt-0.5 ${draft.maintenanceMode ? 'text-red-600' : 'text-green-600'}`}>
                              {draft.maintenanceMode
                                ? 'The platform is in maintenance mode. Customers will see a maintenance page.'
                                : 'The platform is fully operational and accepting orders.'}
                            </p>
                          </div>
                          <button onClick={() => handleChange('maintenanceMode', !draft.maintenanceMode)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${draft.maintenanceMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                            {draft.maintenanceMode ? 'Take Offline' : 'Enable Maintenance'}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Save bar */}
                {dirty && (
                  <div className="sticky bottom-4 flex items-center justify-between bg-white border border-border shadow-lg rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-muted-foreground">You have unsaved changes</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDraft(settings)} className="rounded-xl">Discard</Button>
                      <Button size="sm" onClick={save} disabled={saving} className="rounded-xl hg-gradient-primary gap-1.5">
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                )}
                {saved && !dirty && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle className="w-4 h-4" /> Settings saved successfully!
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
