import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Save, Store, MapPin, Camera, Package, Clock, Shield, Sparkles, Loader2,
  ToggleLeft, ToggleRight, Layers, Trash2, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const SECTIONS = [
  { id: 'info',       label: 'Info',        icon: Store },
  { id: 'location',  label: 'Location',    icon: MapPin },
  { id: 'media',     label: 'Media',       icon: Camera },
  { id: 'operations',label: 'Operations',  icon: Package },
  { id: 'hours',     label: 'Hours',       icon: Clock },
  { id: 'categories',label: 'Categories',  icon: Layers },
  { id: 'halal',     label: 'Halal',       icon: Shield },
  { id: 'featured',  label: 'Featured',    icon: Sparkles },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const SLOT_DURATIONS = ['15','30','45','60'];
const AMENITY_OPTIONS = ['Free Parking','Wheelchair Accessible','Drive-Through','Online Ordering','Same-Day Pickup','Bulk Orders','Custom Cuts','Catering','Gift Cards','Loyalty Program'];

const HALAL_CATEGORY_PRESETS = [
  { name: 'Fresh Meat', emoji: '🥩' }, { name: 'Chicken', emoji: '🐔' },
  { name: 'Lamb', emoji: '🐑' }, { name: 'Beef', emoji: '🐄' },
  { name: 'Goat', emoji: '🐐' }, { name: 'Offal & Organ Meats', emoji: '🫀' },
  { name: 'Seafood & Fish', emoji: '🐟' }, { name: 'Fresh Produce', emoji: '🥬' },
  { name: 'Vegetables', emoji: '🧅' }, { name: 'Fruits', emoji: '🍎' },
  { name: 'Rice & Grains', emoji: '🌾' }, { name: 'Lentils & Pulses', emoji: '🫘' },
  { name: 'Spices & Seasonings', emoji: '🌶️' }, { name: 'Herbs & Aromatics', emoji: '🌿' },
  { name: 'Oils & Ghee', emoji: '🫙' }, { name: 'Dairy & Eggs', emoji: '🥛' },
  { name: 'Cheese & Cultured', emoji: '🧀' }, { name: 'Bread & Bakery', emoji: '🥖' },
  { name: 'Flatbread & Pita', emoji: '🫓' }, { name: 'Frozen Foods', emoji: '🧊' },
  { name: 'Packaged Goods', emoji: '📦' }, { name: 'Snacks', emoji: '🍿' },
  { name: 'Beverages', emoji: '🧃' }, { name: 'Coffee & Tea', emoji: '☕' },
  { name: 'Sweets & Desserts', emoji: '🍯' }, { name: 'Dried Fruits & Nuts', emoji: '🥜' },
  { name: 'Condiments & Sauces', emoji: '🥫' }, { name: 'Breakfast & Cereals', emoji: '🥣' },
  { name: 'Ready-to-Cook', emoji: '🍱' }, { name: 'International Foods', emoji: '🌍' },
  { name: 'Supplements & Health', emoji: '💊' }, { name: 'Household & Cleaning', emoji: '🧴' },
  { name: 'Special Occasions', emoji: '🎂' },
];

type FeaturedImage = { src: string; tag: string; label: string; price: string };
const defaultImages: FeaturedImage[] = Array(4).fill(null).map(() => ({ src:'', tag:'', label:'', price:'' }));

export default function AdminStoreEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SectionId>('info');
  const [storeName, setStoreName] = useState('');

  const [infoForm, setInfoForm] = useState({
    name:'', branchName:'', tagline:'', description:'', email:'', phone:'',
  });
  const [locForm, setLocForm] = useState({
    address:'', city:'', province:'TX', postalCode:'', googleMapsLink:'',
  });
  const [mediaForm, setMediaForm] = useState({ logo:'', banner:'', cardImage:'' });
  const [opsForm, setOpsForm] = useState({
    pickupAvailable: true, curbsideAvailable: false, deliveryAvailable: false,
    minOrderAmount: '0', convenienceFee: '0', avgPrepTimeMinutes: '15',
    slotDurationMinutes: '30', maxOrdersPerSlot: '5', amenityTags: [] as string[],
  });
  const [hoursForm, setHoursForm] = useState<Record<string, { open:string; close:string; closed?:boolean }>>({});
  const [halalForm, setHalalForm] = useState({
    isHalalCertified: false, halalCertNumber:'', halalCertBody:'', halalCertExpiry:'',
  });
  type StoreCat = { name: string; emoji?: string; imageUrl?: string };
  const [catsForm, setCatsForm] = useState<StoreCat[]>([]);
  const [newCat, setNewCat] = useState({ name: '', emoji: '', imageUrl: '' });
  const [featuredForm, setFeaturedForm] = useState({
    premiumFreshEnabled: true,
    premiumFreshBadgeTitle:'', premiumFreshHeading:'', premiumFreshDesc:'',
    premiumFreshCutTags:[] as string[],
    premiumFreshBullet1:'', premiumFreshBullet2:'', premiumFreshBullet3:'',
    premiumFreshImages: defaultImages as FeaturedImage[],
  });
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/stores/${id}`).then((sd: any) => {
      setStoreName(sd.name || 'Store');
      setInfoForm({ name: sd.name??'', branchName: sd.branchName??'', tagline: sd.tagline??'', description: sd.description??'', email: sd.email??'', phone: sd.phone??'' });
      setLocForm({ address: sd.address??'', city: sd.city??'', province: sd.province??'TX', postalCode: sd.postalCode??'', googleMapsLink: sd.googleMapsLink??'' });
      setMediaForm({ logo: sd.logo??'', banner: sd.banner??'', cardImage: sd.cardImage??'' });
      setOpsForm({
        pickupAvailable: sd.pickupAvailable??true, curbsideAvailable: sd.curbsideAvailable??false, deliveryAvailable: sd.deliveryAvailable??false,
        minOrderAmount: String(sd.minOrderAmount??'0'), convenienceFee: String(sd.convenienceFee??'0'),
        avgPrepTimeMinutes: String(sd.avgPrepTimeMinutes??'15'), slotDurationMinutes: String(sd.slotDurationMinutes??'30'),
        maxOrdersPerSlot: String(sd.maxOrdersPerSlot??'5'), amenityTags: sd.amenityTags??[],
      });
      const saved = sd.openingHoursJson && Object.keys(sd.openingHoursJson).length > 0 ? sd.openingHoursJson : null;
      if (saved) {
        setHoursForm(saved);
      } else {
        const defaults: Record<string, { open:string; close:string; closed?:boolean }> = {};
        DAY_KEYS.forEach(k => { defaults[k] = { closed: k==='sunday', open:'09:00', close:'21:00' }; });
        setHoursForm(defaults);
      }
      setHalalForm({ isHalalCertified: sd.isHalalCertified??false, halalCertNumber: sd.halalCertNumber??'', halalCertBody: sd.halalCertBody??'', halalCertExpiry: sd.halalCertExpiry ? String(sd.halalCertExpiry).slice(0,10) : '' });
      setCatsForm(sd.storeCategories ?? []);
      setFeaturedForm({
        premiumFreshEnabled: sd.premiumFreshEnabled??true,
        premiumFreshBadgeTitle: sd.premiumFreshBadgeTitle??'', premiumFreshHeading: sd.premiumFreshHeading??'',
        premiumFreshDesc: sd.premiumFreshDesc??'', premiumFreshCutTags: sd.premiumFreshCutTags??[],
        premiumFreshBullet1: sd.premiumFreshBullet1??'', premiumFreshBullet2: sd.premiumFreshBullet2??'', premiumFreshBullet3: sd.premiumFreshBullet3??'',
        premiumFreshImages: (sd.premiumFreshImages&&sd.premiumFreshImages.length>0) ? sd.premiumFreshImages : defaultImages,
      });
    }).catch(() => toast.error('Failed to load store')).finally(() => setLoading(false));
  }, [id]);

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      await api.patch(`/admin/stores/${id}`, payload);
      toast.success('Store updated successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const SaveBtn = ({ label = 'Save Changes' }: { label?: string }) => (
    <Button className="w-full h-12 hg-gradient-primary border-0 text-white rounded-xl font-semibold gap-2" disabled={saving} type="submit">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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

  if (loading) return (
    <AdminLayout title="Edit Store">
      <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    </AdminLayout>
  );

  return (
    <AdminLayout title={`Edit: ${storeName}`} subtitle="Update store information">
      <div className="max-w-2xl mx-auto space-y-6 p-4 lg:p-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/stores')} className="rounded-xl gap-1">
            <ChevronLeft className="h-4 w-4" /> Back to Stores
          </Button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl overflow-x-auto">
          {SECTIONS.map(({ id: sid, label, icon: Icon }) => (
            <button key={sid} onClick={() => setSection(sid)}
              className={`flex-shrink-0 flex items-center gap-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${section===sid ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        {/* ── INFO ── */}
        {section === 'info' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-4"
            onSubmit={e => { e.preventDefault(); save(infoForm); }}>
            <h3 className="font-serif font-bold text-lg">Store Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {field('Store Name *', <Input value={infoForm.name} onChange={e => setInfoForm(f=>({...f,name:e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Branch / Location Name', <Input value={infoForm.branchName} onChange={e => setInfoForm(f=>({...f,branchName:e.target.value}))} className="h-12 rounded-xl" placeholder="Downtown" />)}
              <div className="sm:col-span-2">
                {field('Tagline', <Input value={infoForm.tagline} onChange={e => setInfoForm(f=>({...f,tagline:e.target.value}))} className="h-12 rounded-xl" placeholder="Fresh. Halal. Always." />)}
              </div>
              <div className="sm:col-span-2">
                {field('Description', <textarea value={infoForm.description} onChange={e => setInfoForm(f=>({...f,description:e.target.value}))}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary resize-none" rows={4} placeholder="Tell customers about this store…" />)}
              </div>
              {field('Email', <Input type="email" value={infoForm.email} onChange={e => setInfoForm(f=>({...f,email:e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Phone', <Input value={infoForm.phone} onChange={e => setInfoForm(f=>({...f,phone:e.target.value}))} className="h-12 rounded-xl" />)}
            </div>
            <SaveBtn />
          </motion.form>
        )}

        {/* ── LOCATION ── */}
        {section === 'location' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-4"
            onSubmit={e => { e.preventDefault(); save(locForm); }}>
            <h3 className="font-serif font-bold text-lg">Location</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                {field('Street Address', <Input value={locForm.address} onChange={e => setLocForm(f=>({...f,address:e.target.value}))} className="h-12 rounded-xl" />)}
              </div>
              {field('City', <Input value={locForm.city} onChange={e => setLocForm(f=>({...f,city:e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Postal / ZIP Code', <Input value={locForm.postalCode} onChange={e => setLocForm(f=>({...f,postalCode:e.target.value}))} className="h-12 rounded-xl" />)}
              <div className="sm:col-span-2">
                {field('State / Province',
                  <Select value={locForm.province} onValueChange={v => setLocForm(f=>({...f,province:v}))}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="sm:col-span-2">
                {field('Google Maps Link', <Input value={locForm.googleMapsLink} onChange={e => setLocForm(f=>({...f,googleMapsLink:e.target.value}))} className="h-12 rounded-xl" placeholder="https://maps.google.com/…" />, 'Lat/lng extracted automatically from the link')}
              </div>
            </div>
            <SaveBtn />
          </motion.form>
        )}

        {/* ── MEDIA ── */}
        {section === 'media' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-5"
            onSubmit={e => { e.preventDefault(); save(mediaForm); }}>
            <div>
              <h3 className="font-serif font-bold text-lg">Photos & Media</h3>
              <p className="text-xs text-muted-foreground mt-1">Paste publicly accessible image URLs</p>
            </div>
            {(['logo','banner','cardImage'] as const).map(key => {
              const labels: Record<string, string> = { logo:'Store Logo', banner:'Banner Image', cardImage:'Card Image (marketplace thumbnail)' };
              return (
                <div key={key} className="space-y-2">
                  {field(labels[key], <Input value={mediaForm[key]} onChange={e => setMediaForm(f=>({...f,[key]:e.target.value}))} className="h-12 rounded-xl" placeholder="https://…" />)}
                  {mediaForm[key] && <div className={`overflow-hidden rounded-xl border border-border/50 ${key==='banner'?'h-32':'h-20 w-20'}`}>
                    <img src={mediaForm[key]} alt={key} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                  </div>}
                </div>
              );
            })}
            <SaveBtn />
          </motion.form>
        )}

        {/* ── OPERATIONS ── */}
        {section === 'operations' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-5"
            onSubmit={e => { e.preventDefault(); save({
              ...opsForm,
              minOrderAmount: Number(opsForm.minOrderAmount)||0,
              convenienceFee: Number(opsForm.convenienceFee)||0,
              avgPrepTimeMinutes: Number(opsForm.avgPrepTimeMinutes)||15,
              slotDurationMinutes: Number(opsForm.slotDurationMinutes)||30,
              maxOrdersPerSlot: Number(opsForm.maxOrdersPerSlot)||5,
            }); }}>
            <h3 className="font-serif font-bold text-lg">Operations & Services</h3>
            <div className="space-y-2">
              {[
                { key:'pickupAvailable', label:'In-Store Pickup', emoji:'🏪' },
                { key:'curbsideAvailable', label:'Curbside Pickup', emoji:'🚗' },
                { key:'deliveryAvailable', label:'Delivery', emoji:'🚚' },
              ].map(({ key, label, emoji }) => (
                <div key={key} className={`flex items-center gap-3 p-3 border rounded-xl ${opsForm[key as keyof typeof opsForm] ? 'border-primary/30 bg-primary/5' : 'border-border/50'}`}>
                  <span>{emoji}</span>
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <Switch checked={opsForm[key as keyof typeof opsForm] as boolean} onCheckedChange={v => setOpsForm(f=>({...f,[key]:v}))} />
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {field('Min Order Amount ($)', <Input type="number" min="0" value={opsForm.minOrderAmount} onChange={e => setOpsForm(f=>({...f,minOrderAmount:e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Convenience Fee ($)', <Input type="number" min="0" step="0.01" value={opsForm.convenienceFee} onChange={e => setOpsForm(f=>({...f,convenienceFee:e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Avg Prep Time (min)', <Input type="number" min="1" value={opsForm.avgPrepTimeMinutes} onChange={e => setOpsForm(f=>({...f,avgPrepTimeMinutes:e.target.value}))} className="h-12 rounded-xl" />)}
              {field('Slot Duration',
                <Select value={opsForm.slotDurationMinutes} onValueChange={v => setOpsForm(f=>({...f,slotDurationMinutes:v}))}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{SLOT_DURATIONS.map(d => <SelectItem key={d} value={d}>{d} min</SelectItem>)}</SelectContent>
                </Select>
              )}
              {field('Max Orders per Slot', <Input type="number" min="1" max="50" value={opsForm.maxOrdersPerSlot} onChange={e => setOpsForm(f=>({...f,maxOrdersPerSlot:e.target.value}))} className="h-12 rounded-xl" />)}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Amenities & Features</label>
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map(tag => {
                  const sel = opsForm.amenityTags.includes(tag);
                  return <button type="button" key={tag} onClick={() => setOpsForm(f=>({...f, amenityTags: sel ? f.amenityTags.filter(t=>t!==tag) : [...f.amenityTags, tag]}))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${sel ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/20'}`}>{tag}</button>;
                })}
              </div>
            </div>
            <SaveBtn />
          </motion.form>
        )}

        {/* ── HOURS ── */}
        {section === 'hours' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-4"
            onSubmit={e => { e.preventDefault(); save({ openingHoursJson: hoursForm }); }}>
            <div>
              <h3 className="font-serif font-bold text-lg">Opening Hours</h3>
              <p className="text-xs text-muted-foreground mt-1">Toggle each day open/closed and set the hours</p>
            </div>
            <div className="space-y-2">
              {DAY_KEYS.map((key, i) => {
                const h = hoursForm[key] || { closed: true, open:'09:00', close:'21:00' };
                const isOpen = !h.closed;
                return (
                  <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border ${isOpen ? 'border-primary/20 bg-primary/5' : 'border-border/50'}`}>
                    <div className="w-20 shrink-0 text-sm font-medium">{DAY_LABELS[i].slice(0,3)}</div>
                    <button type="button" onClick={() => setHoursForm(prev => ({...prev,[key]:{...(prev[key]||{open:'09:00',close:'21:00'}),closed:isOpen}}))} className="shrink-0">
                      {isOpen ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    {isOpen ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input type="time" value={h.open||'09:00'} onChange={e => setHoursForm(prev => ({...prev,[key]:{...(prev[key]||{closed:false,close:'21:00'}),open:e.target.value}}))} className="h-9 w-28 rounded-lg text-xs" />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input type="time" value={h.close||'21:00'} onChange={e => setHoursForm(prev => ({...prev,[key]:{...(prev[key]||{closed:false,open:'09:00'}),close:e.target.value}}))} className="h-9 w-28 rounded-lg text-xs" />
                      </div>
                    ) : <span className="text-xs text-muted-foreground ml-2">Closed</span>}
                  </div>
                );
              })}
            </div>
            <SaveBtn label="Save Hours" />
          </motion.form>
        )}

        {/* ── CATEGORIES ── */}
        {section === 'categories' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-5"
            onSubmit={e => { e.preventDefault(); save({ storeCategories: catsForm }); }}>
            <div>
              <h3 className="font-serif font-bold text-lg flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Store Categories</h3>
              <p className="text-xs text-muted-foreground mt-1">Define the categories shown in this store's "Browse by Category" section. Each category name must match the product category tags exactly.</p>
            </div>
            {catsForm.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                No categories defined yet
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
                    <button type="button" onClick={() => setCatsForm(f => f.filter((_,j) => j !== i))}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="border border-dashed border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Add Category</p>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Pick from halal category presets</label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {HALAL_CATEGORY_PRESETS.filter(p => !catsForm.some(c => c.name === p.name)).map(preset => (
                    <button type="button" key={preset.name}
                      onClick={() => setCatsForm(f => [...f, { name: preset.name, emoji: preset.emoji }])}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/50 text-xs hover:border-primary/40 hover:bg-primary/5 transition-colors">
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
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Category Name *</label>
                    <Input value={newCat.name} onChange={e => setNewCat(f=>({...f,name:e.target.value}))} className="h-11 rounded-xl" placeholder="e.g. Fresh Meat" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Emoji</label>
                    <Input value={newCat.emoji} onChange={e => setNewCat(f=>({...f,emoji:e.target.value}))} className="h-11 rounded-xl text-center text-xl" placeholder="🥩" maxLength={2} />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Category Image URL (optional)</label>
                  <Input value={newCat.imageUrl} onChange={e => setNewCat(f=>({...f,imageUrl:e.target.value}))} className="h-11 rounded-xl" placeholder="https://… (overrides emoji if set)" />
                </div>
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
            <SaveBtn label="Save Categories" />
          </motion.form>
        )}

        {/* ── HALAL ── */}
        {section === 'halal' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-4"
            onSubmit={e => { e.preventDefault(); save({...halalForm, halalCertExpiry: halalForm.halalCertExpiry||null}); }}>
            <div>
              <h3 className="font-serif font-bold text-lg">Halal Certification</h3>
              <p className="text-xs text-muted-foreground mt-1">Verified certification enables the Gold Halal Badge</p>
            </div>
            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div>
                <div className="font-semibold text-sm">Is this store Halal Certified?</div>
                <div className="text-xs text-muted-foreground mt-0.5">Required for the Gold Halal Badge</div>
              </div>
              <Switch checked={halalForm.isHalalCertified} onCheckedChange={v => setHalalForm(f=>({...f,isHalalCertified:v}))} />
            </div>
            {halalForm.isHalalCertified && (
              <div className="grid sm:grid-cols-2 gap-4">
                {field('Certificate Number', <Input value={halalForm.halalCertNumber} onChange={e => setHalalForm(f=>({...f,halalCertNumber:e.target.value}))} className="h-12 rounded-xl" placeholder="CERT-12345" />)}
                {field('Certifying Body', <Input value={halalForm.halalCertBody} onChange={e => setHalalForm(f=>({...f,halalCertBody:e.target.value}))} className="h-12 rounded-xl" placeholder="ISNA, IFANCA…" />)}
                {field('Expiry Date', <Input type="date" value={halalForm.halalCertExpiry} onChange={e => setHalalForm(f=>({...f,halalCertExpiry:e.target.value}))} className="h-12 rounded-xl" />)}
              </div>
            )}
            <SaveBtn label="Save Halal Info" />
          </motion.form>
        )}

        {/* ── FEATURED ── */}
        {section === 'featured' && (
          <motion.form initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="bg-card rounded-2xl border border-border/50 p-6 space-y-5"
            onSubmit={e => { e.preventDefault(); save(featuredForm); }}>
            <div>
              <h3 className="font-serif font-bold text-lg flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Featured Section</h3>
              <p className="text-xs text-muted-foreground mt-1">The dark green showcase banner displayed on the store page</p>
            </div>
            <div className="flex items-center justify-between p-3 border border-border/50 rounded-xl">
              <span className="text-sm font-medium">Enable Featured Section</span>
              <Switch checked={featuredForm.premiumFreshEnabled} onCheckedChange={v => setFeaturedForm(f=>({...f,premiumFreshEnabled:v}))} />
            </div>
            <div className="space-y-3">
              {field('Badge Title', <Input value={featuredForm.premiumFreshBadgeTitle} onChange={e => setFeaturedForm(f=>({...f,premiumFreshBadgeTitle:e.target.value}))} placeholder="PREMIUM FRESH CUTS" className="h-11 rounded-xl" />)}
              {field('Section Heading', <Input value={featuredForm.premiumFreshHeading} onChange={e => setFeaturedForm(f=>({...f,premiumFreshHeading:e.target.value}))} placeholder="Cut Fresh, Just For You" className="h-11 rounded-xl" />)}
              {field('Description', <textarea value={featuredForm.premiumFreshDesc} onChange={e => setFeaturedForm(f=>({...f,premiumFreshDesc:e.target.value}))}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary resize-none" rows={3} placeholder="Describe your featured products or services…" />)}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Product Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {featuredForm.premiumFreshCutTags.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-muted rounded-lg text-xs font-medium">
                    {t}
                    <button type="button" onClick={() => setFeaturedForm(f=>({...f,premiumFreshCutTags:f.premiumFreshCutTags.filter((_,j)=>j!==i)}))} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); if (newTag.trim()) { setFeaturedForm(f=>({...f,premiumFreshCutTags:[...f.premiumFreshCutTags,newTag.trim()]})); setNewTag(''); } }}} placeholder="e.g. 🐑 Lamb" className="h-10 rounded-xl flex-1 text-sm" />
                <Button type="button" onClick={() => { if (!newTag.trim()) return; setFeaturedForm(f=>({...f,premiumFreshCutTags:[...f.premiumFreshCutTags,newTag.trim()]})); setNewTag(''); }} className="h-10 px-4 rounded-xl hg-gradient-primary border-0 text-white text-sm">Add</Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">Short Description Points (up to 3)</label>
              {([1,2,3] as const).map(n => (
                <Input key={n} value={featuredForm[`premiumFreshBullet${n}` as keyof typeof featuredForm] as string}
                  onChange={e => setFeaturedForm(f=>({...f,[`premiumFreshBullet${n}`]:e.target.value}))}
                  placeholder={`Point ${n}`} className="h-11 rounded-xl" />
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">4 Product Images</label>
              <div className="space-y-3">
                {[0,1,2,3].map(i => (
                  <div key={i} className="bg-muted/30 rounded-xl p-4 space-y-2 border border-border/50">
                    <p className="text-xs font-semibold">Image {i+1}</p>
                    <Input value={featuredForm.premiumFreshImages[i]?.src||''} onChange={e => { const imgs=[...featuredForm.premiumFreshImages]; imgs[i]={...imgs[i],src:e.target.value}; setFeaturedForm(f=>({...f,premiumFreshImages:imgs})); }} placeholder="Image URL" className="h-10 rounded-xl text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      {(['tag','label','price'] as const).map(k => (
                        <div key={k}>
                          <label className="text-[10px] text-muted-foreground block mb-1">{k==='tag'?'Top Badge':k==='label'?'Product Name':'Price'}</label>
                          <Input value={featuredForm.premiumFreshImages[i]?.[k]||''} onChange={e => { const imgs=[...featuredForm.premiumFreshImages]; imgs[i]={...imgs[i],[k]:e.target.value}; setFeaturedForm(f=>({...f,premiumFreshImages:imgs})); }} placeholder={k==='tag'?'Best Seller':k==='label'?'Lamb':'$16.99/lb'} className="h-9 rounded-lg text-xs" />
                        </div>
                      ))}
                    </div>
                    {featuredForm.premiumFreshImages[i]?.src && (
                      <div className="mt-1 w-16 h-16 rounded-lg overflow-hidden border border-border/50">
                        <img src={featuredForm.premiumFreshImages[i].src} alt="preview" className="w-full h-full object-cover" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <SaveBtn label="Save Featured Section" />
          </motion.form>
        )}
      </div>
    </AdminLayout>
  );
}
