import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Settings, Megaphone, ImageIcon, Award, Plus, Trash2, Save,
  ChevronUp, ChevronDown, Loader2, CheckCircle2, AlertCircle, Star,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import {
  CMS_DEFAULTS, type CmsSettings, type CmsAnnouncement, type CmsHeroStore,
  type CmsFooterCertificate, type CmsFeaturedReview,
} from '@/lib/cms';

type Tab = 'nav' | 'announcements' | 'hero' | 'reviews' | 'footer';

const TABS: { id: Tab; label: string; icon: typeof Settings; desc: string }[] = [
  { id: 'nav', label: 'Site Settings', icon: Settings, desc: 'Global toggles for site-wide elements' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, desc: 'Sliding badges below header' },
  { id: 'hero', label: 'Hero Featured Stores', icon: ImageIcon, desc: '3 image slots on the homepage hero' },
  { id: 'reviews', label: 'Featured Reviews', icon: Star, desc: 'Reviews shown in "Loved by the Community"' },
  { id: 'footer', label: 'Footer Certificates', icon: Award, desc: 'Up to 6 certification badges' },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function AdminWebsitePage() {
  const [tab, setTab] = useState<Tab>('nav');
  const qc = useQueryClient();

  const { data: cms, isLoading } = useQuery<CmsSettings>({
    queryKey: ['cms', 'admin', 'site'],
    queryFn: () => api.get<CmsSettings>('/cms/site'),
  });

  const [draft, setDraft] = useState<CmsSettings | null>(null);
  const [saving, setSaving] = useState<Tab | null>(null);
  const [savedAt, setSavedAt] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cms && !draft) setDraft(cms);
  }, [cms, draft]);

  const current: CmsSettings = draft ?? cms ?? CMS_DEFAULTS;

  const updateKey = <K extends keyof CmsSettings>(key: K, value: CmsSettings[K]) => {
    setDraft(prev => ({ ...(prev ?? current), [key]: value }));
  };

  const saveSection = async (key: keyof CmsSettings, sectionTab: Tab, overrideValue?: unknown) => {
    setSaving(sectionTab);
    setError(null);
    try {
      const short = key.replace(/^cms\./, '');
      const valueToSave = overrideValue !== undefined ? overrideValue : current[key];
      await api.put(`/cms/admin/${short}`, valueToSave);
      qc.invalidateQueries({ queryKey: ['cms', 'site'] });
      qc.invalidateQueries({ queryKey: ['cms', 'admin', 'site'] });
      setSavedAt(sectionTab);
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  if (isLoading || !draft) {
    return (
      <AdminLayout title="Website Management" subtitle="Loading CMS settings…">
        <div className="p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Website Management" subtitle="Control headers, banners, hero, products, Eid page & footer">
      <div className="p-4 lg:p-6">
        <div className="grid lg:grid-cols-[260px,1fr] gap-5">
          {/* Tabs */}
          <div className="space-y-1.5">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white border border-border/50 hover:bg-muted text-foreground'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-white' : 'text-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className={`text-[11px] mt-0.5 ${active ? 'text-white/80' : 'text-muted-foreground'}`}>{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            {tab === 'nav' && (
              <NavSection
                value={current['cms.nav']}
                onChange={v => updateKey('cms.nav', v)}
                onSave={(v?: unknown) => saveSection('cms.nav', 'nav', v)}
                saving={saving === 'nav'}
                saved={savedAt === 'nav'}
              />
            )}
            {tab === 'announcements' && (
              <AnnouncementsSection
                value={current['cms.announcements']}
                onChange={v => updateKey('cms.announcements', v)}
                onSave={() => saveSection('cms.announcements', 'announcements')}
                saving={saving === 'announcements'}
                saved={savedAt === 'announcements'}
              />
            )}
            {tab === 'hero' && (
              <HeroSection
                value={current['cms.heroStores']}
                onChange={v => updateKey('cms.heroStores', v)}
                onSave={() => saveSection('cms.heroStores', 'hero')}
                saving={saving === 'hero'}
                saved={savedAt === 'hero'}
              />
            )}
            {tab === 'reviews' && (
              <ReviewsSection
                value={current['cms.featuredReviews']}
                onChange={v => updateKey('cms.featuredReviews', v)}
                onSave={() => saveSection('cms.featuredReviews', 'reviews')}
                saving={saving === 'reviews'}
                saved={savedAt === 'reviews'}
              />
            )}
            {tab === 'footer' && (
              <FooterSection
                value={current['cms.footerCertificates']}
                onChange={v => updateKey('cms.footerCertificates', v)}
                onSave={() => saveSection('cms.footerCertificates', 'footer')}
                saving={saving === 'footer'}
                saved={savedAt === 'footer'}
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// ── Reusable bits ───────────────────────────────────────────────

function SectionHeader({ title, desc, onSave, saving, saved }: { title: string; desc: string; onSave: () => void; saving: boolean; saved: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-serif text-lg font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Button onClick={onSave} disabled={saving} className="rounded-xl hg-gradient-primary text-white gap-1.5 h-9">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
      </Button>
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 group"
    >
      <span className={`relative w-10 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-1'}`} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}

// ── 3A: Header Nav ─────────────────────────────────────────────

function NavSection({ value, onChange, onSave, saving, saved }: { value: CmsSettings['cms.nav']; onChange: (v: CmsSettings['cms.nav']) => void; onSave: (v?: unknown) => void; saving: boolean; saved: boolean }) {
  const handleToggle = (v: boolean) => {
    const updated = { ...value, announcementsEnabled: v };
    onChange(updated);
    onSave(updated);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <h2 className="font-serif text-lg font-bold">Announcements Settings</h2>
          <p className="text-xs text-muted-foreground">Master switch for the announcement banner. Changes save instantly.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between bg-muted/30 px-4 py-3 rounded-xl">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              📣 Show Announcements
              {saving && <span className="text-xs text-muted-foreground font-normal">Saving…</span>}
              {saved && !saving && <span className="text-xs text-primary font-normal">✓ Saved</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {value.announcementsEnabled !== false
                ? 'Announcements are currently visible on the site.'
                : 'Announcements are hidden from the site.'}
            </div>
          </div>
          <Toggle value={value.announcementsEnabled !== false} onChange={handleToggle} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── 3B: Announcements ─────────────────────────────────────────

function AnnouncementsSection({ value, onChange, onSave, saving, saved }: { value: CmsAnnouncement[]; onChange: (v: CmsAnnouncement[]) => void; onSave: () => void; saving: boolean; saved: boolean }) {
  const update = (idx: number, patch: Partial<CmsAnnouncement>) => onChange(value.map((a, i) => i === idx ? { ...a, ...patch } : a));
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= 5) return;
    onChange([...value, { id: uid(), text: 'New announcement', code: '', linkUrl: '', linkLabel: 'Shop Now', active: true, bgFrom: '#0D3327', bgVia: '#1B4D3E', bgTo: '#D4AF37' }]);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange(next);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader title="Announcement Badges" desc={`${value.length}/5 — sliding banners below the header (rotate every 6s)`} onSave={onSave} saving={saving} saved={saved} />
      </CardHeader>
      <CardContent className="space-y-3">
        {value.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No announcements. Add one below.</div>
        )}
        {value.map((a, idx) => (
          <motion.div key={a.id} layout className="border border-border/50 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                <Toggle value={a.active} onChange={v => update(idx, { active: v })} label={a.active ? 'Active' : 'Hidden'} />
              </div>
              <div className="flex gap-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === value.length - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Message</Label>
                <Input value={a.text} onChange={e => update(idx, { text: e.target.value })} className="rounded-xl" placeholder="🎉 Get 15% off your first order!" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Promo Code (optional)</Label>
                <Input value={a.code || ''} onChange={e => update(idx, { code: e.target.value })} className="rounded-xl" placeholder="NUMA15" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CTA Label</Label>
                <Input value={a.linkLabel || ''} onChange={e => update(idx, { linkLabel: e.target.value })} className="rounded-xl" placeholder="Shop Now" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">CTA Link</Label>
                <Input value={a.linkUrl || ''} onChange={e => update(idx, { linkUrl: e.target.value })} className="rounded-xl" placeholder="/stores/al-madina-halal" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs mb-1.5 block">Background Gradient (Hex)</Label>
                <div className="flex gap-2">
                  {(['bgFrom', 'bgVia', 'bgTo'] as const).map(field => (
                    <div key={field} className="flex-1 flex items-center gap-1.5 border border-border rounded-xl px-2 py-1.5 bg-white">
                      <input type="color" value={a[field] || '#0D3327'} onChange={e => update(idx, { [field]: e.target.value })} className="w-7 h-7 rounded cursor-pointer border-0" />
                      <Input value={a[field] || ''} onChange={e => update(idx, { [field]: e.target.value })} className="rounded-lg border-0 h-7 px-1 text-xs" placeholder="#0D3327" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-2 rounded-lg overflow-hidden p-3 text-white text-sm" style={{ background: `linear-gradient(90deg, ${a.bgFrom || '#0D3327'} 0%, ${a.bgVia || '#1B4D3E'} 40%, ${a.bgTo || '#D4AF37'} 100%)` }}>
              <span className="font-semibold">{a.text || '(empty)'}</span>
              {a.code && <span className="ml-3 text-xs opacity-75">Use code <strong>{a.code}</strong></span>}
            </div>
          </motion.div>
        ))}
        {value.length < 5 && (
          <Button variant="outline" onClick={add} className="w-full rounded-xl border-dashed gap-2 h-10"><Plus className="w-4 h-4" /> Add Announcement</Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── 3C: Hero Stores ──────────────────────────────────────────

function HeroSection({ value, onChange, onSave, saving, saved }: { value: CmsHeroStore[]; onChange: (v: CmsHeroStore[]) => void; onSave: () => void; saving: boolean; saved: boolean }) {
  const update = (idx: number, patch: Partial<CmsHeroStore>) => onChange(value.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= 3) return;
    onChange([...value, { id: uid(), imageUrl: '', label: 'New Slot', size: 'small', active: true }]);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader title="Hero Featured Stores" desc={`${value.length}/3 image slots in the homepage hero (1 large, 2 small)`} onSave={onSave} saving={saving} saved={saved} />
      </CardHeader>
      <CardContent className="space-y-3">
        {value.map((s, idx) => (
          <div key={s.id} className="border border-border/50 rounded-xl p-4 bg-white">
            <div className="flex items-start gap-4">
              <div className="w-32 h-20 shrink-0 rounded-lg overflow-hidden bg-muted border border-border">
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt={s.label} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
                )}
              </div>
              <div className="flex-1 grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Image URL</Label>
                  <Input value={s.imageUrl} onChange={e => update(idx, { imageUrl: e.target.value })} className="rounded-xl" placeholder="https://images.unsplash.com/…" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Caption Label</Label>
                  <Input value={s.label} onChange={e => update(idx, { label: e.target.value })} className="rounded-xl" placeholder="ZABIHA HALAL" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Slot Size</Label>
                  <select value={s.size || 'small'} onChange={e => update(idx, { size: e.target.value as 'large' | 'small' })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10">
                    <option value="large">Large (top, full width)</option>
                    <option value="small">Small (bottom row)</option>
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Store Link (clicking the image takes customer here)</Label>
                  <Input value={s.linkUrl || ''} onChange={e => update(idx, { linkUrl: e.target.value })} className="rounded-xl" placeholder="/stores/al-madina-halal-mississauga" />
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Toggle value={s.active} onChange={v => update(idx, { active: v })} />
                <button onClick={() => remove(idx)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {value.length < 3 && (
          <Button variant="outline" onClick={add} className="w-full rounded-xl border-dashed gap-2 h-10"><Plus className="w-4 h-4" /> Add Hero Slot</Button>
        )}
        <p className="text-xs text-muted-foreground pt-1">Recommended: one image with size "Large" plus two with size "Small" for the original 1+2 collage layout.</p>
      </CardContent>
    </Card>
  );
}


// ── 3E: Featured Reviews ──────────────────────────────────────

function ReviewsSection({ value, onChange, onSave, saving, saved }: { value: CmsFeaturedReview[]; onChange: (v: CmsFeaturedReview[]) => void; onSave: () => void; saving: boolean; saved: boolean }) {
  const update = (idx: number, patch: Partial<CmsFeaturedReview>) => onChange(value.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= 12) return;
    onChange([...value, { id: uid(), name: '', city: '', avatar: '', rating: 5, text: '', active: true }]);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange(next);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader title="Featured Reviews" desc={`${value.length}/12 — reviews displayed in the "Loved by the Community" section`} onSave={onSave} saving={saving} saved={saved} />
      </CardHeader>
      <CardContent className="space-y-3">
        {value.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No featured reviews. Add one below.</div>
        )}
        {value.map((r, idx) => (
          <motion.div key={r.id} layout className="border border-border/50 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                <Toggle value={r.active} onChange={v => update(idx, { active: v })} label={r.active ? 'Featured' : 'Hidden'} />
              </div>
              <div className="flex gap-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === value.length - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name</Label>
                <Input value={r.name} onChange={e => update(idx, { name: e.target.value })} className="rounded-xl" placeholder="Fatima R." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={r.city} onChange={e => update(idx, { city: e.target.value })} className="rounded-xl" placeholder="Houston, TX" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Avatar Initial</Label>
                <Input value={r.avatar} maxLength={2} onChange={e => update(idx, { avatar: e.target.value.toUpperCase() })} className="rounded-xl" placeholder="F" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rating (1-5)</Label>
                <select value={r.rating} onChange={e => update(idx, { rating: Number(e.target.value) })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10">
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n})</option>)}
                </select>
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-xs">Review Text</Label>
                <textarea
                  value={r.text}
                  onChange={e => update(idx, { text: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                  placeholder="What the customer said about your service..."
                />
              </div>
            </div>
          </motion.div>
        ))}
        {value.length < 12 && (
          <Button variant="outline" onClick={add} className="w-full rounded-xl border-dashed gap-2 h-10"><Plus className="w-4 h-4" /> Add Featured Review</Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── 3F: Footer Certificates ───────────────────────────────────

function FooterSection({ value, onChange, onSave, saving, saved }: { value: CmsFooterCertificate[]; onChange: (v: CmsFooterCertificate[]) => void; onSave: () => void; saving: boolean; saved: boolean }) {
  const update = (idx: number, patch: Partial<CmsFooterCertificate>) => onChange(value.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= 6) return;
    onChange([...value, { id: uid(), iconKey: 'shield', label: 'NEW', sub: 'Certified', linkUrl: '', active: true }]);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader title="Footer Certificates" desc={`${value.length}/6 — Halal certification badges in the footer`} onSave={onSave} saving={saving} saved={saved} />
      </CardHeader>
      <CardContent className="space-y-3">
        {value.map((c, idx) => (
          <div key={c.id} className="border border-border/50 rounded-xl p-3 bg-white grid sm:grid-cols-[120px,1fr,auto] gap-3 items-start">
            <div className="space-y-1">
              <Label className="text-xs">Icon</Label>
              <select value={c.iconKey} onChange={e => update(idx, { iconKey: e.target.value as CmsFooterCertificate['iconKey'] })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm h-10">
                <option value="shield">🛡️ Shield</option>
                <option value="award">🏆 Award</option>
                <option value="check">✅ Check</option>
                <option value="star">⭐ Star</option>
                <option value="leaf">🌿 Leaf</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={c.label} onChange={e => update(idx, { label: e.target.value })} className="rounded-xl" placeholder="ISNA" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sub-text</Label>
                <Input value={c.sub} onChange={e => update(idx, { sub: e.target.value })} className="rounded-xl" placeholder="Certified" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link URL (optional)</Label>
                <Input value={c.linkUrl || ''} onChange={e => update(idx, { linkUrl: e.target.value })} className="rounded-xl" placeholder="https://isna.net" />
              </div>
            </div>
            <div className="flex flex-col gap-2 items-center pt-5">
              <Toggle value={c.active} onChange={v => update(idx, { active: v })} />
              <button onClick={() => remove(idx)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {value.length < 6 && (
          <Button variant="outline" onClick={add} className="w-full rounded-xl border-dashed gap-2 h-10"><Plus className="w-4 h-4" /> Add Certificate</Button>
        )}
      </CardContent>
    </Card>
  );
}
