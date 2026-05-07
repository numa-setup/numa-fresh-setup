import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Image, Plus, Pencil, Trash2, Eye, EyeOff, RefreshCw, X, Check, Link as LinkIcon, GripVertical } from 'lucide-react';
import { api } from '@/lib/api';

interface Banner {
  id: string; title: string; subtitle: string; linkUrl: string;
  isActive: boolean; imageUrl: string; order: number;
}

const emptyBanner = (): Omit<Banner, 'id' | 'order'> => ({
  title: '', subtitle: '', linkUrl: '', isActive: true, imageUrl: '',
});

export default function AdminContent() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBanner, setEditBanner] = useState<Partial<Banner> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setBanners(await api.get('/admin/content/banners'));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editBanner) return;
    setSaving(true);
    try {
      if (editBanner.id) {
        const updated = await api.patch(`/admin/content/banners/${editBanner.id}`, editBanner);
        setBanners(prev => prev.map(b => b.id === updated.id ? updated : b));
      } else {
        const created = await api.post('/admin/content/banners', editBanner);
        setBanners(prev => [...prev, created]);
      }
      setEditBanner(null);
    } catch {}
    setSaving(false);
  };

  const toggleActive = async (banner: Banner) => {
    try {
      const updated = await api.patch(`/admin/content/banners/${banner.id}`, { isActive: !banner.isActive });
      setBanners(prev => prev.map(b => b.id === updated.id ? updated : b));
    } catch {}
  };

  const deleteBanner = async (id: string) => {
    try {
      await api.delete(`/admin/content/banners/${id}`);
      setBanners(prev => prev.filter(b => b.id !== id));
      setDeleteId(null);
    } catch {}
  };

  return (
    <AdminLayout title="Content Management" subtitle="Manage banners, promotions & platform content">
      <div className="p-4 lg:p-6 space-y-5">
        {/* Banners Section */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-sm">Homepage Banners</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} className="rounded-xl h-9"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button size="sm" onClick={() => setEditBanner(emptyBanner())} className="rounded-xl h-9 gap-1.5 hg-gradient-primary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Banner
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array(2).fill(0).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : banners.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Image className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No banners yet. Add your first one!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {banners.map(banner => (
                  <motion.div key={banner.id} layout className="bg-white border border-border/50 rounded-xl overflow-hidden">
                    <div className="flex items-start gap-4">
                      {/* Preview */}
                      <div className="w-32 h-20 shrink-0 overflow-hidden bg-muted">
                        <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      {/* Info */}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{banner.title}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${banner.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {banner.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{banner.subtitle}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/60">
                              <LinkIcon className="w-3 h-3" />
                              <span className="truncate">{banner.linkUrl}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => toggleActive(banner)}
                              className={`p-1.5 rounded-lg transition-colors ${banner.isActive ? 'text-green-600 hover:bg-green-50' : 'text-muted-foreground hover:bg-muted'}`}>
                              {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setEditBanner(banner)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteId(banner.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Placeholder sections */}
        {[
          { title: 'Featured Categories', desc: 'Manage which categories are highlighted on the homepage.' },
          { title: 'Promotional Emails', desc: 'Schedule and send promotional emails to customers.' },
          { title: 'Push Notifications', desc: 'Send push notifications to app users.' },
        ].map(section => (
          <Card key={section.title} className="opacity-60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-sm">{section.title}</CardTitle>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{section.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Banner Modal */}
      <AnimatePresence>
        {editBanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-lg">{editBanner.id ? 'Edit Banner' : 'New Banner'}</h3>
                <button onClick={() => setEditBanner(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input value={editBanner.title ?? ''} onChange={e => setEditBanner(prev => ({ ...prev!, title: e.target.value }))} className="rounded-xl" placeholder="e.g. Ramadan Special Offers" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtitle</Label>
                  <Input value={editBanner.subtitle ?? ''} onChange={e => setEditBanner(prev => ({ ...prev!, subtitle: e.target.value }))} className="rounded-xl" placeholder="e.g. Up to 30% off" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image URL</Label>
                  <Input value={editBanner.imageUrl ?? ''} onChange={e => setEditBanner(prev => ({ ...prev!, imageUrl: e.target.value }))} className="rounded-xl" placeholder="https://…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link URL</Label>
                  <Input value={editBanner.linkUrl ?? ''} onChange={e => setEditBanner(prev => ({ ...prev!, linkUrl: e.target.value }))} className="rounded-xl" placeholder="/products" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditBanner(prev => ({ ...prev!, isActive: !prev!.isActive }))}
                    className={`w-10 h-6 rounded-full transition-colors ${editBanner.isActive ? 'bg-primary' : 'bg-muted'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${editBanner.isActive ? 'translate-x-4' : ''}`} />
                  </button>
                  <Label className="text-xs cursor-pointer">{editBanner.isActive ? 'Active' : 'Inactive'}</Label>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <Button variant="outline" onClick={() => setEditBanner(null)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={save} disabled={saving || !editBanner.title} className="flex-1 rounded-xl hg-gradient-primary">
                  {saving ? 'Saving…' : 'Save Banner'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold mb-1.5">Delete Banner?</h3>
              <p className="text-sm text-muted-foreground mb-4">This action cannot be undone.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={() => deleteBanner(deleteId)} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700">Delete</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
