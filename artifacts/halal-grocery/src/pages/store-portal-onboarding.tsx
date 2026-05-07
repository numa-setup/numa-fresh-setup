import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Shield, Clock, Settings, DollarSign, CreditCard, CheckCircle2, Camera,
  ChevronRight, ChevronLeft, MapPin, Phone, Mail, Globe, Tag, Sparkles, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const SLOT_DURATIONS = ['15', '30', '45', '60'];
const AMENITY_OPTIONS = ['Free Parking', 'Wheelchair Accessible', 'Drive-Through', 'Online Ordering', 'Same-Day Pickup', 'Bulk Orders', 'Custom Cuts', 'Catering', 'Gift Cards', 'Loyalty Program'];

export const STEPS = [
  { num: 1, label: 'Basic Info', icon: Building2 },
  { num: 2, label: 'Visuals', icon: Camera },
  { num: 3, label: 'Location', icon: MapPin },
  { num: 4, label: 'Hours', icon: Clock },
  { num: 5, label: 'Services', icon: Settings },
  { num: 6, label: 'Halal Cert', icon: Shield },
  { num: 7, label: 'Categories', icon: Tag },
  { num: 8, label: 'Featured', icon: Sparkles },
  { num: 9, label: 'Review', icon: CheckCircle2 },
];

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {STEPS.map((step, i) => {
        const done = i + 1 < current;
        const active = i + 1 === current;
        const Icon = step.icon;
        return (
          <div key={step.num} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-medium transition-all whitespace-nowrap ${
              done ? 'bg-primary/10 text-primary' : active ? 'hg-gradient-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              <span className="hidden sm:block">{step.label}</span>
              <span className="sm:hidden">{step.num}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className={`h-3 w-3 shrink-0 ${done ? 'text-primary' : 'text-muted-foreground/30'}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function Step1({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-xl">Business Information</h2>
      <p className="text-sm text-muted-foreground">Tell customers about your store</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Store Name *</label>
          <Input value={data.name || ''} onChange={e => onChange('name', e.target.value)} placeholder="e.g. Al-Madina Halal Market" className="h-12 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Branch Name (optional)</label>
          <Input value={data.branchName || ''} onChange={e => onChange('branchName', e.target.value)} placeholder="e.g. Houston Main Branch" className="h-12 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tagline</label>
          <Input value={data.tagline || ''} onChange={e => onChange('tagline', e.target.value)} placeholder="e.g. Fresh. Halal. Delivered." className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Phone className="h-3 w-3" /> Phone *</label>
          <Input type="tel" value={data.phone || ''} onChange={e => onChange('phone', e.target.value)} placeholder="+1 (905) 555-0100" className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Email *</label>
          <Input type="email" value={data.email || ''} onChange={e => onChange('email', e.target.value)} placeholder="store@example.com" className="h-12 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <textarea value={data.description || ''} onChange={e => onChange('description', e.target.value)} placeholder="Tell customers what makes your store special..." className="w-full h-20 px-4 py-3 rounded-xl border border-input text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
    </div>
  );
}

export function Step2({ data, onChange }: any) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif font-bold text-xl">Store Visuals</h2>
      <p className="text-sm text-muted-foreground">Add your logo, banner and card image</p>
      {[
        { key: 'logo', label: 'Logo URL', placeholder: 'https://example.com/logo.png', hint: 'Square image, min 200×200px' },
        { key: 'banner', label: 'Banner URL', placeholder: 'https://example.com/banner.jpg', hint: 'Landscape, 1200×400px recommended' },
        { key: 'cardImage', label: 'Card Image URL', placeholder: 'https://example.com/card.jpg', hint: 'Shown on store listing cards, 800×400px' },
      ].map(({ key, label, placeholder, hint }) => (
        <div key={key}>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
          <Input value={data[key] || ''} onChange={e => onChange(key, e.target.value)} placeholder={placeholder} className="h-12 rounded-xl" />
          {data[key] && (
            <img src={data[key]} alt={label} className="mt-2 rounded-xl object-cover w-full h-28 border border-border/50" onError={e => (e.currentTarget.style.display = 'none')} />
          )}
          <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
        </div>
      ))}
    </div>
  );
}

export function Step3({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-xl">Location</h2>
      <p className="text-sm text-muted-foreground">Where is your store located?</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Street Address *</label>
          <Input value={data.address || ''} onChange={e => onChange('address', e.target.value)} placeholder="123 Halal Street" className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">City *</label>
          <Input value={data.city || ''} onChange={e => onChange('city', e.target.value)} placeholder="Houston" className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">State</label>
          <Select value={data.province || 'TX'} onValueChange={v => onChange('province', v)}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select state" /></SelectTrigger>
            <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ZIP Code</label>
          <Input value={data.postalCode || ''} onChange={e => onChange('postalCode', e.target.value)} placeholder="77001" className="h-12 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Globe className="h-3 w-3" /> Google Maps Link</label>
          <Input value={data.googleMapsLink || ''} onChange={e => onChange('googleMapsLink', e.target.value)} placeholder="https://maps.google.com/..." className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function Step4({ data, onChange }: any) {
  const hours = data.openingHoursJson || {};

  // Initialise all 7 days with defaults the first time this step is shown so
  // the data the user *sees* matches what gets saved even without interaction.
  useEffect(() => {
    if (!data.openingHoursJson || Object.keys(data.openingHoursJson).length === 0) {
      const defaults: Record<string, { open: string; close: string; closed?: boolean }> = {};
      DAY_KEYS.forEach(key => {
        defaults[key] = { closed: key === 'sunday', open: '09:00', close: '21:00' };
      });
      onChange('openingHoursJson', defaults);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDay = (key: string) => {
    const current = hours[key] || { closed: true, open: '09:00', close: '21:00' };
    onChange('openingHoursJson', { ...hours, [key]: { ...current, closed: !current.closed } });
  };
  const updateTime = (key: string, field: 'open' | 'close', value: string) => {
    const current = hours[key] || { closed: false, open: '09:00', close: '21:00' };
    onChange('openingHoursJson', { ...hours, [key]: { ...current, [field]: value } });
  };

  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-xl">Operating Hours</h2>
      <p className="text-sm text-muted-foreground">Set your weekly schedule — auto-updated every minute</p>
      <div className="space-y-2">
        {DAYS.map((day, i) => {
          const key = DAY_KEYS[i];
          const h = hours[key] || { closed: key === 'sunday', open: '09:00', close: '21:00' };
          const isOpen = !h.closed;
          return (
            <div key={day} className={`flex items-center gap-3 p-3 rounded-xl border ${isOpen ? 'border-primary/20 bg-primary/5' : 'border-border/50'}`}>
              <div className="w-20 shrink-0 text-sm font-medium">{day.slice(0, 3)}</div>
              <Switch checked={isOpen} onCheckedChange={() => toggleDay(key)} />
              {isOpen ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input type="time" value={h.open || '09:00'} onChange={e => updateTime(key, 'open', e.target.value)} className="h-9 w-28 rounded-lg text-xs" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="time" value={h.close || '21:00'} onChange={e => updateTime(key, 'close', e.target.value)} className="h-9 w-28 rounded-lg text-xs" />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground ml-2">Closed</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid sm:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Pickup Slot Duration</label>
          <Select value={String(data.slotDurationMinutes || '30')} onValueChange={v => onChange('slotDurationMinutes', Number(v))}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{SLOT_DURATIONS.map(d => <SelectItem key={d} value={d}>{d} minutes</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Orders per Slot</label>
          <Input type="number" value={data.maxOrdersPerSlot || '5'} onChange={e => onChange('maxOrdersPerSlot', Number(e.target.value))} min="1" max="50" className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function Step5({ data, onChange }: any) {
  const services = [
    { key: 'pickupAvailable', label: 'In-Store Pickup', desc: 'Customers walk in to collect', emoji: '🏪' },
    { key: 'curbsideAvailable', label: 'Curbside Pickup', desc: 'Customers stay in their car', emoji: '🚗' },
    { key: 'deliveryAvailable', label: 'Delivery', desc: 'You deliver to customers', emoji: '🚚' },
  ];

  const toggleAmenity = (tag: string) => {
    const current: string[] = data.amenityTags || [];
    onChange('amenityTags', current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]);
  };

  return (
    <div className="space-y-5">
      <h2 className="font-serif font-bold text-xl">Services & Amenities</h2>
      <p className="text-sm text-muted-foreground">Choose how customers can shop and what you offer</p>
      {services.map(({ key, label, desc, emoji }) => (
        <div key={key} className={`border rounded-2xl p-4 transition-all ${data[key] ? 'border-primary/30 bg-primary/5' : 'border-border/50'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{emoji}</span>
            <div className="flex-1">
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
            <Switch checked={!!data[key]} onCheckedChange={v => onChange(key, v)} />
          </div>
        </div>
      ))}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Order Amount ($)</label>
          <Input type="number" value={data.minOrderAmount || '0'} onChange={e => onChange('minOrderAmount', e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Avg Prep Time (min)</label>
          <Input type="number" value={data.avgPrepTimeMinutes || '15'} onChange={e => onChange('avgPrepTimeMinutes', e.target.value)} className="h-12 rounded-xl" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Amenities & Features</label>
        <div className="flex flex-wrap gap-2">
          {AMENITY_OPTIONS.map(tag => {
            const selected = (data.amenityTags || []).includes(tag);
            return (
              <button key={tag} onClick={() => toggleAmenity(tag)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${selected ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/20'}`}>
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Step6({ data, onChange }: any) {
  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-xl">Halal Certification</h2>
      <p className="text-sm text-muted-foreground">Verified certification builds customer trust and unlocks the Gold Halal Badge</p>

      <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div>
          <div className="font-semibold text-sm">Is your store Halal Certified?</div>
          <div className="text-xs text-muted-foreground mt-0.5">Required for the Gold Halal Badge</div>
        </div>
        <Switch checked={!!data.isHalalCertified} onCheckedChange={v => onChange('isHalalCertified', v)} />
      </div>

      {data.isHalalCertified && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Certificate Number</label>
              <Input value={data.halalCertNumber || ''} onChange={e => onChange('halalCertNumber', e.target.value)} placeholder="e.g. ISNA-2024-00123" className="h-12 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Issuing Body</label>
              <Input value={data.halalCertBody || ''} onChange={e => onChange('halalCertBody', e.target.value)} placeholder="e.g. ISNA USA" className="h-12 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry Date</label>
              <Input type="date" value={data.halalCertExpiry || ''} onChange={e => onChange('halalCertExpiry', e.target.value)} className="h-12 rounded-xl" />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-lg font-serif">حل</span>
            </div>
            <div>
              <div className="font-bold text-sm">Gold Halal Badge Preview</div>
              <div className="text-xs text-muted-foreground">Your store will display this verified badge after admin review</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function Step7({ data, onChange }: any) {
  const cats: string[] = data.categories || ['Meat & Poultry', 'Produce', 'Dairy', 'Packaged Goods', 'Spices & Condiments'];
  const [newCat, setNewCat] = useState('');

  const add = () => {
    if (!newCat.trim()) return;
    onChange('categories', [...cats, newCat.trim()]);
    setNewCat('');
  };

  const remove = (i: number) => onChange('categories', cats.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-xl">Product Categories</h2>
      <p className="text-sm text-muted-foreground">Organize your products into categories — customers can filter by these</p>
      <div className="space-y-2">
        {cats.map((cat, i) => (
          <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-xl px-4 py-3">
            <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">{cat}</span>
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
              <ChevronRight className="h-4 w-4 rotate-90" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add a category…" className="h-12 rounded-xl flex-1" />
        <Button onClick={add} className="h-12 px-5 rounded-xl hg-gradient-primary border-0 text-white">Add</Button>
      </div>
    </div>
  );
}

export function StepFeaturedSection({ data, onChange }: any) {
  const images: Array<{ src: string; tag: string; label: string; price: string }> = data.premiumFreshImages || [
    { src: '', tag: '', label: '', price: '' },
    { src: '', tag: '', label: '', price: '' },
    { src: '', tag: '', label: '', price: '' },
    { src: '', tag: '', label: '', price: '' },
  ];

  const setImages = (imgs: typeof images) => onChange('premiumFreshImages', imgs);
  const updateImg = (i: number, field: string, val: string) => {
    const next = [...images];
    next[i] = { ...next[i], [field]: val };
    setImages(next);
  };

  const tags: string[] = data.premiumFreshCutTags || [];
  const [newTag, setNewTag] = useState('');
  const addTag = () => { if (!newTag.trim()) return; onChange('premiumFreshCutTags', [...tags, newTag.trim()]); setNewTag(''); };
  const removeTag = (i: number) => onChange('premiumFreshCutTags', tags.filter((_: any, idx: number) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif font-bold text-xl flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Featured Section</h2>
        <p className="text-sm text-muted-foreground mt-1">This is the dark green showcase banner on your store page. Fill in all fields — it's required.</p>
      </div>

      {/* Badge + Heading + Description */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Badge Title *</label>
          <Input value={data.premiumFreshBadgeTitle || ''} onChange={e => onChange('premiumFreshBadgeTitle', e.target.value)} placeholder="e.g. PREMIUM FRESH CUTS" className="h-11 rounded-xl" />
          <p className="text-[10px] text-muted-foreground mt-1">Appears as the small label at the top of the section</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Section Heading *</label>
          <Input value={data.premiumFreshHeading || ''} onChange={e => onChange('premiumFreshHeading', e.target.value)} placeholder="e.g. Cut Fresh, Just For You" className="h-11 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description *</label>
          <textarea
            value={data.premiumFreshDesc || ''}
            onChange={e => onChange('premiumFreshDesc', e.target.value)}
            placeholder="e.g. Our certified halal butchers cut meat to your exact specs…"
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary transition-colors resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Product Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t: string, i: number) => (
            <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-muted rounded-lg text-xs font-medium">
              {t}
              <button onClick={() => removeTag(i)} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="e.g. 🐑 Lamb" className="h-10 rounded-xl flex-1 text-sm" />
          <Button onClick={addTag} className="h-10 px-4 rounded-xl hg-gradient-primary border-0 text-white text-sm">Add</Button>
        </div>
      </div>

      {/* Bullet Points */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground block">Short Description Points (up to 3)</label>
        {[1, 2, 3].map(n => (
          <Input key={n} value={data[`premiumFreshBullet${n}`] || ''} onChange={e => onChange(`premiumFreshBullet${n}`, e.target.value)} placeholder={`Point ${n} — e.g. Custom cut to your specifications`} className="h-11 rounded-xl" />
        ))}
      </div>

      {/* 4 Images */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">4 Product Images *</label>
        <div className="space-y-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 space-y-2 border border-border/50">
              <p className="text-xs font-semibold text-foreground">Image {i + 1}</p>
              <Input value={images[i]?.src || ''} onChange={e => updateImg(i, 'src', e.target.value)} placeholder="Image URL (paste link)" className="h-10 rounded-xl text-sm" />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Top Badge</label>
                  <Input value={images[i]?.tag || ''} onChange={e => updateImg(i, 'tag', e.target.value)} placeholder="e.g. Best Seller" className="h-9 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Product Name</label>
                  <Input value={images[i]?.label || ''} onChange={e => updateImg(i, 'label', e.target.value)} placeholder="e.g. Boneless Lamb" className="h-9 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Price</label>
                  <Input value={images[i]?.price || ''} onChange={e => updateImg(i, 'price', e.target.value)} placeholder="e.g. $16.99/lb" className="h-9 rounded-lg text-xs" />
                </div>
              </div>
              {images[i]?.src && (
                <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-border/50">
                  <img src={images[i].src} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Step8({ data, saving, onSubmit, submitLabel, successTitle, successSubtitle }: any) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="text-center py-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
        </motion.div>
        <h2 className="font-serif font-bold text-2xl mb-2">{successTitle || 'Application Submitted!'}</h2>
        <p className="text-muted-foreground mb-2">{successSubtitle || 'Your store is pending admin review.'}</p>
        {!successTitle && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Clock className="h-4 w-4" />
            We'll notify you in 24–48 hours
          </div>
        )}
      </div>
    );
  }

  const sections = [
    { label: 'Store Name', value: data.name || '—' },
    { label: 'City, State', value: data.city && data.province ? `${data.city}, ${data.province}` : '—' },
    { label: 'Phone', value: data.phone || '—' },
    { label: 'Halal Certified', value: data.isHalalCertified ? `✅ Yes (${data.halalCertBody || 'Pending'})` : '❌ No' },
    { label: 'Services', value: [data.pickupAvailable && 'Pickup', data.curbsideAvailable && 'Curbside', data.deliveryAvailable && 'Delivery'].filter(Boolean).join(', ') || 'None selected' },
    { label: 'Categories', value: (data.categories || []).length > 0 ? (data.categories || []).join(', ') : 'None added' },
    { label: 'Commission', value: '7% (platform standard)' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-xl">Review & Submit</h2>
      <p className="text-sm text-muted-foreground">Please review your information before submitting for admin approval</p>
      <div className="bg-card border border-border/50 rounded-2xl divide-y divide-border/50 overflow-hidden">
        {sections.map(({ label, value }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
            <span className="text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <Sparkles className="h-4 w-4 inline mr-1.5" />
        By submitting, you agree to Numa Fresh's merchant terms and 7% commission structure.
      </div>
      <Button
        className="w-full h-14 text-base font-bold hg-gradient-primary border-0 text-white rounded-xl gap-2"
        onClick={async () => {
          await onSubmit();
          setSubmitted(true);
        }}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel || 'Submit for Review'} →
      </Button>
    </div>
  );
}

export default function StorePortalOnboardingPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [storeStatus, setStoreStatus] = useState<string | null>(null);
  const [, setLocation] = useLocation();

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

  // Load existing store data
  useEffect(() => {
    api.get('/store/onboarding/settings').then((store: any) => {
      if (store) {
        setFormData((prev: any) => ({ ...prev, ...store }));
        setStoreStatus(store.storeStatus || null);
      }
    }).catch(() => {}).finally(() => setInitialLoading(false));
  }, []);

  const updateField = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const saveStep = async (stepNum: number) => {
    setSaving(true);
    try {
      await api.patch(`/store/onboarding/step/${stepNum}`, formData);
    } catch (e: any) {
      toast.error('Auto-save failed: ' + (e.message || 'Please try again'));
    }
    setSaving(false);
  };

  const goNext = async () => {
    await saveStep(step);
    setStep(s => Math.min(s + 1, 9));
  };

  const goBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.patch(`/store/onboarding/step/7`, formData);
      await api.post('/store/onboarding/submit', {});
      toast.success('Application submitted! We\'ll review within 24-48 hours.');
    } catch (e: any) {
      toast.error(e.message || 'Submission failed. Please try again.');
      // Re-throw so Step8 doesn't flip to the "Application Submitted!" success
      // screen when the API actually rejected the submission (otherwise the
      // owner sees a success page while the store row stays in `draft` and
      // admin shows "Application not yet submitted").
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const stepContent: Record<number, JSX.Element> = {
    1: <Step1 data={formData} onChange={updateField} />,
    2: <Step2 data={formData} onChange={updateField} />,
    3: <Step3 data={formData} onChange={updateField} />,
    4: <Step4 data={formData} onChange={updateField} />,
    5: <Step5 data={formData} onChange={updateField} />,
    6: <Step6 data={formData} onChange={updateField} />,
    7: <Step7 data={formData} onChange={updateField} />,
    8: <StepFeaturedSection data={formData} onChange={updateField} />,
    9: <Step8 data={formData} saving={saving} onSubmit={handleSubmit} />,
  };

  if (initialLoading) {
    return (
      <PortalLayout title="Store Setup">
        <div className="max-w-2xl mx-auto flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  // Issue 2: A store owner can only have one store. If their existing store is
  // pending admin review or already approved, do not let them re-run the
  // setup wizard (which would overwrite their submitted application). Show a
  // status-appropriate screen instead.
  if (storeStatus === 'pending') {
    return (
      <PortalLayout title="Store Setup">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
              <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-10 w-10 text-amber-600" />
              </div>
            </motion.div>
            <h2 className="font-serif font-bold text-2xl mb-2">Application submitted</h2>
            <p className="text-muted-foreground mb-4">Waiting for admin approval.</p>
            <p className="text-sm text-muted-foreground">
              Our team reviews new store applications within 24–48 hours. You'll be
              notified by email as soon as a decision is made — no further setup
              action is needed in the meantime.
            </p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  if (storeStatus === 'suspended') {
    return (
      <PortalLayout title="Store Setup">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
              <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-10 w-10 text-red-600" />
              </div>
            </motion.div>
            <h2 className="font-serif font-bold text-2xl mb-2">Store suspended</h2>
            <p className="text-muted-foreground mb-2">Your store has been suspended by Numa Fresh administration.</p>
            <p className="text-sm text-muted-foreground">
              Please contact support to resolve the issue. You cannot start a new
              setup or resubmit while the suspension is in effect.
            </p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  if (storeStatus === 'approved') {
    return (
      <PortalLayout title="Store Setup">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
            </motion.div>
            <h2 className="font-serif font-bold text-2xl mb-2">Your store is live</h2>
            <p className="text-muted-foreground mb-6">
              Your application has been approved. You can update your store details any time
              from the Settings page — no need to re-run setup.
            </p>
            <Button
              className="h-12 px-6 hg-gradient-primary border-0 text-white rounded-xl gap-2 font-semibold"
              onClick={() => setLocation('/store-portal/settings')}
            >
              <Settings className="h-4 w-4" /> Edit Store Settings
            </Button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Store Setup">
      <div className="max-w-2xl mx-auto space-y-6">
        <StepIndicator current={step} />

        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="hg-gradient-primary h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {step < 9 && (
          <div className="flex gap-3">
            {step > 1 && (
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
              {step === 8 ? 'Review & Submit' : 'Save & Continue'} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 9 && (
          <Button variant="outline" className="w-full h-12 rounded-xl gap-2" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" /> Back to Edit
          </Button>
        )}
      </div>
    </PortalLayout>
  );
}
