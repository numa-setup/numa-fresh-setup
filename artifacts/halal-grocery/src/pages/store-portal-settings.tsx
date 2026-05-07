import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Bell, Globe, Shield, ChevronRight, Save, Sparkles,
  MapPin, Camera, Clock, Package, Tag, ToggleLeft, ToggleRight, Layers, Trash2, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PortalLayout } from '@/components/portal/PortalLayout';

const TABS = [
  { id: 'info',        label: 'Info',       icon: Globe },
  { id: 'location',   label: 'Location',   icon: MapPin },
  { id: 'media',      label: 'Media',      icon: Camera },
  { id: 'operations', label: 'Operations', icon: Package },
  { id: 'hours',      label: 'Hours',      icon: Clock },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'halal',      label: 'Halal',      icon: Shield },
  { id: 'featured',   label: 'Featured',   icon: Sparkles },
  { id: 'notifications', label: 'Alerts',  icon: Bell },
  { id: 'security',   label: 'Security',   icon: Settings },
] as const;

type TabId = typeof TABS[number]['id'];
type FeaturedImage = { src: string; tag: string; label: string; price: string };

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const SLOT_DURATIONS = ['15','30','45','60'];
const AMENITY_OPTIONS = ['Free Parking','Wheelchair Accessible','Drive-Through','Online Ordering','Same-Day Pickup','Bulk Orders','Custom Cuts','Catering','Gift Cards','Loyalty Program'];

const HALAL_CATEGORY_PRESETS: { name: string; emoji: string }[] = [
  { name: 'Fresh Meat', emoji: '🥩' },
  { name: 'Chicken', emoji: '🐔' },
  { name: 'Lamb', emoji: '🐑' },
  { name: 'Beef', emoji: '🐄' },
  { name: 'Goat', emoji: '🐐' },
  { name: 'Offal & Organ Meats', emoji: '🫀' },
  { name: 'Seafood & Fish', emoji: '🐟' },
  { name: 'Fresh Produce', emoji: '🥬' },
  { name: 'Vegetables', emoji: '🧅' },
  { name: 'Fruits', emoji: '🍎' },
  { name: 'Rice & Grains', emoji: '🌾' },
  { name: 'Lentils & Pulses', emoji: '🫘' },
  { name: 'Spices & Seasonings', emoji: '🌶️' },
  { name: 'Herbs & Aromatics', emoji: '🌿' },
  { name: 'Oils & Ghee', emoji: '🫙' },
  { name: 'Dairy & Eggs', emoji: '🥛' },
  { name: 'Cheese & Cultured', emoji: '🧀' },
  { name: 'Bread & Bakery', emoji: '🥖' },
  { name: 'Flatbread & Pita', emoji: '🫓' },
  { name: 'Frozen Foods', emoji: '🧊' },
  { name: 'Packaged Goods', emoji: '📦' },
  { name: 'Snacks', emoji: '🍿' },
  { name: 'Beverages', emoji: '🧃' },
  { name: 'Coffee & Tea', emoji: '☕' },
  { name: 'Sweets & Desserts', emoji: '🍯' },
  { name: 'Dried Fruits & Nuts', emoji: '🥜' },
  { name: 'Condiments & Sauces', emoji: '🥫' },
  { name: 'Breakfast & Cereals', emoji: '🥣' },
  { name: 'Ready-to-Cook', emoji: '🍱' },
  { name: 'International Foods', emoji: '🌍' },
  { name: 'Supplements & Health', emoji: '💊' },
  { name: 'Household & Cleaning', emoji: '🧴' },
  { name: 'Special Occasions', emoji: '🎂' },
];

const defaultImages: FeaturedImage[] = Array(4).fill(null).map(() => ({ src:'', tag:'', label:'', price:'' }));

export default function StorePortalSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: sd } = useQuery({
    queryKey: ['portal','settings'],
    queryFn: () => api.get<any>('/store/onboarding/settings'),
    retry: false,
  });

  // ── Info ──────────────────────────────────────────────────────
  const [infoForm, setInfoForm] = useState({
    name:'', branchName:'', tagline:'', description:'', email:'', phone:'',
    acceptingOrders: true, isActive: true,
  });
  useEffect(() => {
    if (!sd) return;
    setInfoForm({
      name: sd.name ?? '', branchName: sd.branchName ?? '',
      tagline: sd.tagline ?? '', description: sd.description ?? '',
      email: sd.email ?? '', phone: sd.phone ?? '',
      acceptingOrders: sd.isActiveManual ?? true,
      isActive: sd.showOnWebsite ?? true,
    });
  }, [sd]);

  // ── Location ──────────────────────────────────────────────────
  const [locForm, setLocForm] = useState({
    address:'', city:'', province:'TX', postalCode:'', googleMapsLink:'',
  });
  useEffect(() => {
    if (!sd) return;
    setLocForm({
      address: sd.address ?? '', city: sd.city ?? '',
      province: sd.province ?? 'TX', postalCode: sd.postalCode ?? '',
      googleMapsLink: sd.googleMapsLink ?? '',
    });
  }, [sd]);

  // ── Media ─────────────────────────────────────────────────────
  const [mediaForm, setMediaForm] = useState({ logo:'', banner:'', cardImage:'' });
  useEffect(() => {
    if (!sd) return;
    setMediaForm({ logo: sd.logo ?? '', banner: sd.banner ?? '', cardImage: sd.cardImage ?? '' });
  }, [sd]);

  // ── Operations ────────────────────────────────────────────────
  const [opsForm, setOpsForm] = useState({
    pickupAvailable: true, curbsideAvailable: false, deliveryAvailable: false,
    minOrderAmount: '0', convenienceFee: '0', avgPrepTimeMinutes: '15',
    slotDurationMinutes: '30', maxOrdersPerSlot: '5',
    amenityTags: [] as string[],
  });
  useEffect(() => {
    if (!sd) return;
    setOpsForm({
      pickupAvailable: sd.pickupAvailable ?? true,
      curbsideAvailable: sd.curbsideAvailable ?? false,
      deliveryAvailable: sd.deliveryAvailable ?? false,
      minOrderAmount: String(sd.minOrderAmount ?? '0'),
      convenienceFee: String(sd.convenienceFee ?? '0'),
      avgPrepTimeMinutes: String(sd.avgPrepTimeMinutes ?? '15'),
      slotDurationMinutes: String(sd.slotDurationMinutes ?? '30'),
      maxOrdersPerSlot: String(sd.maxOrdersPerSlot ?? '5'),
      amenityTags: sd.amenityTags ?? [],
    });
  }, [sd]);

  // ── Hours ─────────────────────────────────────────────────────
  const [hoursForm, setHoursForm] = useState<Record<string, { open:string; close:string; closed?:boolean }>>({});
  useEffect(() => {
    if (!sd) return;
    const saved = sd.openingHoursJson && Object.keys(sd.openingHoursJson).length > 0
      ? sd.openingHoursJson
      : null;
    if (saved) {
      setHoursForm(saved);
    } else {
      const defaults: Record<string, { open:string; close:string; closed?:boolean }> = {};
      DAY_KEYS.forEach(k => { defaults[k] = { closed: k === 'sunday', open:'09:00', close:'21:00' }; });
      setHoursForm(defaults);
    }
  }, [sd]);

  // ── Halal ─────────────────────────────────────────────────────
  const [halalForm, setHalalForm] = useState({
    isHalalCertified: false, halalCertNumber:'', halalCertBody:'', halalCertExpiry:'',
  });
  useEffect(() => {
    if (!sd) return;
    setHalalForm({
      isHalalCertified: sd.isHalalCertified ?? false,
      halalCertNumber: sd.halalCertNumber ?? '',
      halalCertBody: sd.halalCertBody ?? '',
      halalCertExpiry: sd.halalCertExpiry ? String(sd.halalCertExpiry).slice(0,10) : '',
    });
  }, [sd]);

  // ── Categories ────────────────────────────────────────────────
  type StoreCat = { name: string; emoji?: string; imageUrl?: string };
  const [catsForm, setCatsForm] = useState<StoreCat[]>([]);
  const [newCat, setNewCat] = useState({ name: '', emoji: '', imageUrl: '' });
  useEffect(() => {
    if (!sd) return;
    setCatsForm((sd as any).storeCategories ?? []);
  }, [sd]);

  // ── Featured ──────────────────────────────────────────────────
  const [featuredForm, setFeaturedForm] = useState({
    premiumFreshBadgeTitle:'', premiumFreshHeading:'', premiumFreshDesc:'',
    premiumFreshCutTags:[] as string[],
    premiumFreshBullet1:'', premiumFreshBullet2:'', premiumFreshBullet3:'',
    premiumFreshImages: defaultImages as FeaturedImage[],
  });
  useEffect(() => {
    if (!sd) return;
    setFeaturedForm({
      premiumFreshBadgeTitle: sd.premiumFreshBadgeTitle ?? '',
      premiumFreshHeading: sd.premiumFreshHeading ?? '',
      premiumFreshDesc: sd.premiumFreshDesc ?? '',
      premiumFreshCutTags: sd.premiumFreshCutTags ?? [],
      premiumFreshBullet1: sd.premiumFreshBullet1 ?? '',
      premiumFreshBullet2: sd.premiumFreshBullet2 ?? '',
      premiumFreshBullet3: sd.premiumFreshBullet3 ?? '',
      premiumFreshImages: (sd.premiumFreshImages && sd.premiumFreshImages.length > 0) ? sd.premiumFreshImages : defaultImages,
    });
  }, [sd]);
  const [newTag, setNewTag] = useState('');

  // ── Notifications ─────────────────────────────────────────────
  const [notifForm, setNotifForm] = useState({
    emailOnNewOrder: true, emailOnCancellation: true, smsOnNewOrder: false, lowStockAlerts: true,
  });

  // ── Save helpers ──────────────────────────────────────────────
  const save = async (payload: Record<string, unknown>, extras?: () => Promise<void>) => {
    setSaving(true);
    try {
      await api.patch('/store/onboarding/settings/store', payload);
      if (extras) await extras();
      qc.invalidateQueries({ queryKey: ['portal'] });
      toast({ title: '✅ Saved successfully' });
    } catch (e: any) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveBtn = (label = 'Save Changes') => (
    <Button
      className="w-full h-12 hg-gradient-primary border-0 text-white rounded-xl font-semibold gap-2"
      disabled={saving}
      type="submit"
    >
      <Save className="h-4 w-4" />
      {saving ? 'Saving…' : label}
    </Button>
  );

  const field = (label: string, el: React.ReactNode, hint?: string) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {el}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  return (
    <PortalLayout title="Settings">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Tab strip */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-shrink-0 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── INFO ──────────────────────────────────────────────── */}
        {activeTab === 'info' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
            onSubmit={e => { e.preventDefault(); save(infoForm, async () => {
              if (infoForm.acceptingOrders !== (sd?.isActiveManual ?? true))
                await api.patch('/store/onboarding/toggle-active', { isActive: infoForm.acceptingOrders });
              if (infoForm.isActive !== (sd?.showOnWebsite ?? true))
                await api.patch('/store/onboarding/toggle-visibility', { visible: infoForm.isActive });
            }); }}
          >
            <h3 className="font-semibold">Store Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {field('Store Name *',
                <Input value={infoForm.name} onChange={e => setInfoForm(f => ({...f, name: e.target.value}))} className="h-12 rounded-xl" placeholder="My Halal Market" />
              )}
              {field('Branch / Location Name',
                <Input value={infoForm.branchName} onChange={e => setInfoForm(f => ({...f, branchName: e.target.value}))} className="h-12 rounded-xl" placeholder="Downtown" />
              )}
              <div className="sm:col-span-2">
                {field('Tagline',
                  <Input value={infoForm.tagline} onChange={e => setInfoForm(f => ({...f, tagline: e.target.value}))} className="h-12 rounded-xl" placeholder="Fresh. Halal. Always." />
                )}
              </div>
              <div className="sm:col-span-2">
                {field('Description',
                  <textarea value={infoForm.description} onChange={e => setInfoForm(f => ({...f, description: e.target.value}))}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary resize-none"
                    rows={3} placeholder="Tell customers about your store…" />
                )}
              </div>
              {field('Email', <Input type="email" value={infoForm.email} onChange={e => setInfoForm(f => ({...f, email: e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Phone', <Input value={infoForm.phone} onChange={e => setInfoForm(f => ({...f, phone: e.target.value}))} className="h-12 rounded-xl" />)}
            </div>
            <div className="space-y-2 pt-2">
              {[
                { key:'isActive', label:'Visible on Marketplace', desc:'Customers can find and view your store' },
                { key:'acceptingOrders', label:'Accepting New Orders', desc:'New orders can be placed' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Switch checked={infoForm[key as keyof typeof infoForm] as boolean}
                    onCheckedChange={v => setInfoForm(f => ({...f, [key]: v}))} />
                </div>
              ))}
            </div>
            {saveBtn()}
          </motion.form>
        )}

        {/* ── LOCATION ──────────────────────────────────────────── */}
        {activeTab === 'location' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
            onSubmit={e => { e.preventDefault(); save(locForm); }}
          >
            <h3 className="font-semibold">Store Location</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                {field('Street Address',
                  <Input value={locForm.address} onChange={e => setLocForm(f => ({...f, address: e.target.value}))} className="h-12 rounded-xl" placeholder="123 Halal Blvd" />
                )}
              </div>
              {field('City', <Input value={locForm.city} onChange={e => setLocForm(f => ({...f, city: e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Postal / ZIP Code', <Input value={locForm.postalCode} onChange={e => setLocForm(f => ({...f, postalCode: e.target.value}))} className="h-12 rounded-xl" />)}
              <div className="sm:col-span-2">
                {field('State / Province',
                  <Select value={locForm.province} onValueChange={v => setLocForm(f => ({...f, province: v}))}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="sm:col-span-2">
                {field('Google Maps Link', <Input value={locForm.googleMapsLink} onChange={e => setLocForm(f => ({...f, googleMapsLink: e.target.value}))} className="h-12 rounded-xl" placeholder="https://maps.google.com/…" />, 'Paste a Google Maps share link — lat/lng are extracted automatically')}
              </div>
            </div>
            {saveBtn()}
          </motion.form>
        )}

        {/* ── MEDIA ─────────────────────────────────────────────── */}
        {activeTab === 'media' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-5"
            onSubmit={e => { e.preventDefault(); save(mediaForm); }}
          >
            <div>
              <h3 className="font-semibold">Photos & Media</h3>
              <p className="text-xs text-muted-foreground mt-1">Paste publicly accessible image URLs (Cloudinary, Imgur, etc.)</p>
            </div>
            {(['logo','banner','cardImage'] as const).map(key => {
              const labels: Record<string, string> = { logo:'Store Logo', banner:'Banner Image', cardImage:'Card Image (marketplace thumbnail)' };
              return (
                <div key={key} className="space-y-2">
                  {field(labels[key], <Input value={mediaForm[key]} onChange={e => setMediaForm(f => ({...f, [key]: e.target.value}))} className="h-12 rounded-xl" placeholder="https://…" />)}
                  {mediaForm[key] && (
                    <div className={`overflow-hidden rounded-xl border border-border/50 ${key === 'banner' ? 'h-32' : 'h-20 w-20'}`}>
                      <img src={mediaForm[key]} alt={key} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    </div>
                  )}
                </div>
              );
            })}
            {saveBtn()}
          </motion.form>
        )}

        {/* ── OPERATIONS ────────────────────────────────────────── */}
        {activeTab === 'operations' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-5"
            onSubmit={e => { e.preventDefault(); save({
              ...opsForm,
              minOrderAmount: Number(opsForm.minOrderAmount) || 0,
              convenienceFee: Number(opsForm.convenienceFee) || 0,
              avgPrepTimeMinutes: Number(opsForm.avgPrepTimeMinutes) || 15,
              slotDurationMinutes: Number(opsForm.slotDurationMinutes) || 30,
              maxOrdersPerSlot: Number(opsForm.maxOrdersPerSlot) || 5,
            }); }}
          >
            <h3 className="font-semibold">Operations & Services</h3>
            <div className="space-y-2">
              {[
                { key:'pickupAvailable', label:'In-Store Pickup', desc:'Customers walk in to collect', emoji:'🏪' },
                { key:'curbsideAvailable', label:'Curbside Pickup', desc:'Customers stay in their car', emoji:'🚗' },
                { key:'deliveryAvailable', label:'Delivery', desc:'You deliver to customers', emoji:'🚚' },
              ].map(({ key, label, desc, emoji }) => (
                <div key={key} className={`flex items-center gap-3 p-4 border rounded-2xl ${opsForm[key as keyof typeof opsForm] ? 'border-primary/30 bg-primary/5' : 'border-border/50'}`}>
                  <span className="text-2xl">{emoji}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Switch checked={opsForm[key as keyof typeof opsForm] as boolean}
                    onCheckedChange={v => setOpsForm(f => ({...f, [key]: v}))} />
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {field('Min Order Amount ($)', <Input type="number" min="0" value={opsForm.minOrderAmount} onChange={e => setOpsForm(f => ({...f, minOrderAmount: e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Convenience Fee ($)', <Input type="number" min="0" step="0.01" value={opsForm.convenienceFee} onChange={e => setOpsForm(f => ({...f, convenienceFee: e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Avg Prep Time (min)', <Input type="number" min="1" value={opsForm.avgPrepTimeMinutes} onChange={e => setOpsForm(f => ({...f, avgPrepTimeMinutes: e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Pickup Slot Duration',
                <Select value={opsForm.slotDurationMinutes} onValueChange={v => setOpsForm(f => ({...f, slotDurationMinutes: v}))}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{SLOT_DURATIONS.map(d => <SelectItem key={d} value={d}>{d} minutes</SelectItem>)}</SelectContent>
                </Select>
              )}
              {field('Max Orders per Slot', <Input type="number" min="1" max="50" value={opsForm.maxOrdersPerSlot} onChange={e => setOpsForm(f => ({...f, maxOrdersPerSlot: e.target.value}))} className="h-12 rounded-xl" />)}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Amenities & Features</label>
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map(tag => {
                  const sel = opsForm.amenityTags.includes(tag);
                  return (
                    <button type="button" key={tag}
                      onClick={() => setOpsForm(f => ({...f, amenityTags: sel ? f.amenityTags.filter(t => t !== tag) : [...f.amenityTags, tag]}))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${sel ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/20'}`}>
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            {saveBtn()}
          </motion.form>
        )}

        {/* ── HOURS ─────────────────────────────────────────────── */}
        {activeTab === 'hours' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
            onSubmit={e => { e.preventDefault(); save({ openingHoursJson: hoursForm }); }}
          >
            <div>
              <h3 className="font-semibold">Opening Hours</h3>
              <p className="text-xs text-muted-foreground mt-1">Toggle each day open/closed and set your hours</p>
            </div>
            <div className="space-y-2">
              {DAY_KEYS.map((key, i) => {
                const h = hoursForm[key] || { closed: true, open:'09:00', close:'21:00' };
                const isOpen = !h.closed;
                return (
                  <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border ${isOpen ? 'border-primary/20 bg-primary/5' : 'border-border/50'}`}>
                    <div className="w-20 shrink-0 text-sm font-medium">{DAY_LABELS[i].slice(0,3)}</div>
                    <button type="button"
                      onClick={() => setHoursForm(prev => ({...prev, [key]: {...(prev[key]||{open:'09:00',close:'21:00'}), closed: isOpen}}))}
                      className="shrink-0"
                    >
                      {isOpen ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    {isOpen ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input type="time" value={h.open || '09:00'}
                          onChange={e => setHoursForm(prev => ({...prev, [key]: {...(prev[key]||{closed:false,close:'21:00'}), open: e.target.value}}))}
                          className="h-9 w-28 rounded-lg text-xs" />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input type="time" value={h.close || '21:00'}
                          onChange={e => setHoursForm(prev => ({...prev, [key]: {...(prev[key]||{closed:false,open:'09:00'}), close: e.target.value}}))}
                          className="h-9 w-28 rounded-lg text-xs" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground ml-2">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
            {saveBtn('Save Hours')}
          </motion.form>
        )}

        {/* ── CATEGORIES ────────────────────────────────────────── */}
        {activeTab === 'categories' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-5"
            onSubmit={e => { e.preventDefault(); save({ storeCategories: catsForm }); }}
          >
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Browse-by-Category Setup</h3>
              <p className="text-xs text-muted-foreground mt-1">Define the categories shown in your store's "Browse by Category" section. Add each category with a name and an optional emoji. The name must exactly match the category tags on your products.</p>
            </div>

            {/* Existing categories */}
            {catsForm.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                No categories yet — add one below
              </div>
            ) : (
              <div className="space-y-2">
                {catsForm.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 border border-border/50 rounded-xl bg-muted/20">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xl w-8 text-center flex-shrink-0">{cat.emoji || '🛒'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cat.name}</p>
                      {cat.imageUrl && <p className="text-[10px] text-muted-foreground truncate">{cat.imageUrl}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => setCatsForm(f => f.filter((_,j) => j !== i))}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new category */}
            <div className="border border-dashed border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Add Category</p>

              {/* Quick-add from preset list */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Pick from common halal categories</label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {HALAL_CATEGORY_PRESETS.filter(p => !catsForm.some(c => c.name === p.name)).map(preset => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => {
                        setCatsForm(f => [...f, { name: preset.name, emoji: preset.emoji }]);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/50 text-xs hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <span>{preset.emoji}</span> {preset.name}
                    </button>
                  ))}
                  {HALAL_CATEGORY_PRESETS.every(p => catsForm.some(c => c.name === p.name)) && (
                    <p className="text-xs text-muted-foreground py-1">All presets added</p>
                  )}
                </div>
              </div>

              <div className="border-t border-border/30 pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Or add a custom category</p>
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  {field('Category Name *',
                    <Input value={newCat.name} onChange={e => setNewCat(f=>({...f,name:e.target.value}))}
                      className="h-11 rounded-xl" placeholder="e.g. Fresh Meat" />
                  )}
                  {field('Emoji',
                    <Input value={newCat.emoji} onChange={e => setNewCat(f=>({...f,emoji:e.target.value}))}
                      className="h-11 rounded-xl text-center text-xl" placeholder="🥩" maxLength={2} />
                  )}
                </div>
                {field('Category Image URL (optional)',
                  <Input value={newCat.imageUrl} onChange={e => setNewCat(f=>({...f,imageUrl:e.target.value}))}
                    className="h-11 rounded-xl" placeholder="https://… (overrides emoji if set)" />,
                  'If provided, this image replaces the emoji icon in the browse section'
                )}
                <Button type="button"
                  onClick={() => {
                    if (!newCat.name.trim()) return;
                    setCatsForm(f => [...f, { name: newCat.name.trim(), emoji: newCat.emoji.trim()||undefined, imageUrl: newCat.imageUrl.trim()||undefined }]);
                    setNewCat({ name:'', emoji:'', imageUrl:'' });
                  }}
                  className="w-full h-10 rounded-xl hg-gradient-primary border-0 text-white text-sm gap-2 mt-2"
                >
                  + Add Custom Category
                </Button>
              </div>
            </div>

            {saveBtn('Save Categories')}
          </motion.form>
        )}

        {/* ── HALAL ─────────────────────────────────────────────── */}
        {activeTab === 'halal' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
            onSubmit={e => { e.preventDefault(); save({
              ...halalForm,
              halalCertExpiry: halalForm.halalCertExpiry || null,
            }); }}
          >
            <div>
              <h3 className="font-semibold">Halal Certification</h3>
              <p className="text-xs text-muted-foreground mt-1">Verified certification unlocks the Gold Halal Badge</p>
            </div>
            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div>
                <div className="font-semibold text-sm">Is your store Halal Certified?</div>
                <div className="text-xs text-muted-foreground mt-0.5">Required for the Gold Halal Badge</div>
              </div>
              <Switch checked={halalForm.isHalalCertified} onCheckedChange={v => setHalalForm(f => ({...f, isHalalCertified: v}))} />
            </div>
            {halalForm.isHalalCertified && (
              <div className="grid sm:grid-cols-2 gap-4">
                {field('Certificate Number', <Input value={halalForm.halalCertNumber} onChange={e => setHalalForm(f => ({...f, halalCertNumber: e.target.value}))} className="h-12 rounded-xl" placeholder="CERT-12345" />)}
                {field('Certifying Body', <Input value={halalForm.halalCertBody} onChange={e => setHalalForm(f => ({...f, halalCertBody: e.target.value}))} className="h-12 rounded-xl" placeholder="ISNA, IFANCA…" />)}
                {field('Expiry Date', <Input type="date" value={halalForm.halalCertExpiry} onChange={e => setHalalForm(f => ({...f, halalCertExpiry: e.target.value}))} className="h-12 rounded-xl" />)}
              </div>
            )}
            {saveBtn('Save Halal Info')}
          </motion.form>
        )}

        {/* ── FEATURED ──────────────────────────────────────────── */}
        {activeTab === 'featured' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-5"
            onSubmit={async e => { e.preventDefault(); setSaving(true); try {
              await api.patch('/store/onboarding/settings/featured', featuredForm);
              qc.invalidateQueries({ queryKey: ['portal'] });
              toast({ title: '✅ Featured section saved' });
            } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setSaving(false); } }}
          >
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Featured Section</h3>
              <p className="text-xs text-muted-foreground mt-1">The dark green showcase banner on your store page</p>
            </div>
            <div className="space-y-3">
              {field('Badge Title', <Input value={featuredForm.premiumFreshBadgeTitle} onChange={e => setFeaturedForm(f => ({...f, premiumFreshBadgeTitle: e.target.value}))} placeholder="PREMIUM FRESH CUTS" className="h-11 rounded-xl" />)}
              {field('Section Heading', <Input value={featuredForm.premiumFreshHeading} onChange={e => setFeaturedForm(f => ({...f, premiumFreshHeading: e.target.value}))} placeholder="Cut Fresh, Just For You" className="h-11 rounded-xl" />)}
              {field('Description', <textarea value={featuredForm.premiumFreshDesc} onChange={e => setFeaturedForm(f => ({...f, premiumFreshDesc: e.target.value}))}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary resize-none" rows={3} placeholder="Describe your featured products or services…" />)}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Product Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {featuredForm.premiumFreshCutTags.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-muted rounded-lg text-xs font-medium">
                    {t}
                    <button type="button" onClick={() => setFeaturedForm(f => ({...f, premiumFreshCutTags: f.premiumFreshCutTags.filter((_,j) => j !== i)}))} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); if (newTag.trim()) { setFeaturedForm(f => ({...f, premiumFreshCutTags: [...f.premiumFreshCutTags, newTag.trim()]})); setNewTag(''); } }}} placeholder="e.g. 🐑 Lamb" className="h-10 rounded-xl flex-1 text-sm" />
                <Button type="button" onClick={() => { if (!newTag.trim()) return; setFeaturedForm(f => ({...f, premiumFreshCutTags: [...f.premiumFreshCutTags, newTag.trim()]})); setNewTag(''); }} className="h-10 px-4 rounded-xl hg-gradient-primary border-0 text-white text-sm">Add</Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">Short Description Points (up to 3)</label>
              {([1,2,3] as const).map(n => (
                <Input key={n} value={featuredForm[`premiumFreshBullet${n}` as keyof typeof featuredForm] as string}
                  onChange={e => setFeaturedForm(f => ({...f, [`premiumFreshBullet${n}`]: e.target.value}))}
                  placeholder={`Point ${n} — e.g. Custom cut to your specifications`} className="h-11 rounded-xl" />
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">4 Product Images</label>
              <div className="space-y-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className="bg-muted/30 rounded-xl p-4 space-y-2 border border-border/50">
                    <p className="text-xs font-semibold">Image {i+1}</p>
                    <Input value={featuredForm.premiumFreshImages[i]?.src||''} onChange={e => { const imgs=[...featuredForm.premiumFreshImages]; imgs[i]={...imgs[i],src:e.target.value}; setFeaturedForm(f=>({...f,premiumFreshImages:imgs})); }} placeholder="Image URL" className="h-10 rounded-xl text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      {(['tag','label','price'] as const).map(k => (
                        <div key={k}>
                          <label className="text-[10px] text-muted-foreground block mb-1 capitalize">{k==='tag'?'Top Badge':k==='label'?'Product Name':'Price'}</label>
                          <Input value={featuredForm.premiumFreshImages[i]?.[k]||''} onChange={e => { const imgs=[...featuredForm.premiumFreshImages]; imgs[i]={...imgs[i],[k]:e.target.value}; setFeaturedForm(f=>({...f,premiumFreshImages:imgs})); }} placeholder={k==='tag'?'Best Seller':k==='label'?'Boneless Lamb':'$16.99/lb'} className="h-9 rounded-lg text-xs" />
                        </div>
                      ))}
                    </div>
                    {featuredForm.premiumFreshImages[i]?.src && (
                      <div className="mt-1 w-16 h-16 rounded-lg overflow-hidden border border-border/50">
                        <img src={featuredForm.premiumFreshImages[i].src} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {saveBtn('Save Featured Section')}
          </motion.form>
        )}

        {/* ── NOTIFICATIONS ─────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
            <h3 className="font-semibold">Notification Preferences</h3>
            <div className="space-y-1">
              {[
                { key:'emailOnNewOrder', label:'Email on New Order', desc:'Get notified when a new order comes in' },
                { key:'emailOnCancellation', label:'Email on Cancellation', desc:'Get notified when an order is cancelled' },
                { key:'smsOnNewOrder', label:'SMS Alerts', desc:'Receive text message alerts (coming soon)' },
                { key:'lowStockAlerts', label:'Low Stock Alerts', desc:'Get notified when products run low' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3.5 border-b border-border/50 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Switch checked={notifForm[key as keyof typeof notifForm]} onCheckedChange={v => setNotifForm(f => ({...f, [key]: v}))} />
                </div>
              ))}
            </div>
            <Button className="w-full h-12 hg-gradient-primary border-0 text-white rounded-xl font-semibold gap-2"
              onClick={() => toast({ title: '✅ Notification preferences saved' })}>
              <Save className="h-4 w-4" /> Save Preferences
            </Button>
          </motion.div>
        )}

        {/* ── SECURITY ──────────────────────────────────────────── */}
        {activeTab === 'security' && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="space-y-4">
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
              {[
                { label:'Change Password', desc:'Update your account password', action:'Change' },
                { label:'Two-Factor Authentication', desc:'2FA via authenticator app', action:'Enable' },
                { label:'Active Sessions', desc:'Manage where you are logged in', action:'View' },
              ].map(({ label, desc, action }, i) => (
                <div key={label} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl gap-1">{action} <ChevronRight className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-5">
              <h4 className="font-semibold text-destructive text-sm mb-1">Danger Zone</h4>
              <p className="text-xs text-muted-foreground mb-4">These actions are permanent and cannot be undone.</p>
              <Button variant="outline" size="sm" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                Deactivate Store Account
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </PortalLayout>
  );
}
