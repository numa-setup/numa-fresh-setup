import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Package, Edit2, Trash2, AlertTriangle, Check, X, Link as LinkIcon, FileSpreadsheet, Image as ImageIcon, ChevronDown, Download, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PortalLayout } from '@/components/portal/PortalLayout';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const PRODUCT_TYPES = ['FRESH_MEAT', 'PRODUCE', 'SPICES', 'PACKAGED', 'DAIRY', 'BAKERY', 'FROZEN', 'BEVERAGES', 'OTHER'];
const ANIMAL_TYPES = ['CHICKEN', 'BEEF', 'LAMB', 'GOAT', 'VEAL', 'TURKEY', 'FISH'];
const CUTS = ['Whole', 'Boneless', 'Bone-in', 'Ground', 'Cubed', 'Sliced', 'Chops', 'Ribs'];
const UNITS = ['kg', 'g', 'lb', 'piece', 'pack', 'litre', 'bunch', 'bag'];

const TYPE_COLORS: Record<string, string> = {
  FRESH_MEAT: 'bg-red-100 text-red-700',
  PRODUCE: 'bg-green-100 text-green-700',
  SPICES: 'bg-orange-100 text-orange-700',
  PACKAGED: 'bg-blue-100 text-blue-700',
  DAIRY: 'bg-sky-100 text-sky-700',
  BAKERY: 'bg-amber-100 text-amber-700',
  FROZEN: 'bg-indigo-100 text-indigo-700',
  BEVERAGES: 'bg-cyan-100 text-cyan-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

const CATEGORIES = ['Fresh Meat', 'Poultry', 'Produce', 'Spices & Herbs', 'Rice & Grains', 'Oils & Ghee', 'Dairy', 'Bakery', 'Frozen', 'Beverages', 'Snacks', 'Dates & Dried Fruits', 'Lentils & Pulses', 'Condiments', 'Other'];

const defaultForm = {
  name: '', description: '', productType: 'PACKAGED', category: 'Other',
  subcategory: '', tagsInput: '',
  price: '', comparePrice: '', unit: 'piece', stockQty: '100', lowStockThreshold: '5',
  isHalalCertified: true, isFeatured: false, isActive: true, freshnessLabel: '',
  animalType: '', availableCuts: [] as string[], pricePerKg: '', sku: '',
  nutritionCalories: '', nutritionProtein: '', nutritionCarbs: '', nutritionFat: '',
  images: [] as string[],
  productDetails: '', ingredients: '', directions: '',
  certifiedFrom: '', expiryDate: '',
};

// ─── Image Upload Section ──────────────────────────────────────────────────
const MAX_IMAGES = 4;

function ImageUploadSection({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, MAX_IMAGES - images.length);
  const canAddMore = remaining > 0;

  const addImages = (urls: string[]) => {
    const merged = [...images, ...urls].slice(0, MAX_IMAGES);
    onChange(merged);
  };

  const removeAt = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const moveLeft = (idx: number) => {
    if (idx === 0) return;
    const next = [...images];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const handleUrlAdd = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!canAddMore) { alert(`Maximum ${MAX_IMAGES} images`); return; }
    addImages([trimmed]);
    setUrlInput('');
  };

  const uploadOne = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) { alert(`${file.name}: not an image file`); return null; }
    if (file.size > 5 * 1024 * 1024) { alert(`${file.name}: must be under 5 MB`); return null; }
    const token = localStorage.getItem('accessToken');
    const urlRes = await fetch(getApiUrl('/storage/uploads/request-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!urlRes.ok) throw new Error('Failed to get upload URL');
    const { uploadURL, objectPath } = await urlRes.json();
    const uploadRes = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!uploadRes.ok) throw new Error('Upload failed');
    return getApiUrl(`/storage${objectPath}`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!canAddMore) { alert(`Maximum ${MAX_IMAGES} images`); return; }

    // Cap to remaining slots so we don't over-upload then discard.
    const toUpload = files.slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const url = await uploadOne(file);
        if (url) uploaded.push(url);
      }
      if (uploaded.length) addImages(uploaded);
    } catch {
      alert('Image upload failed. Please try a URL instead.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Product Images <span className="text-muted-foreground/70">({images.length}/{MAX_IMAGES})</span>
        </label>
        <span className="text-[10px] text-muted-foreground/70">First image is the cover</span>
      </div>

      {/* Existing images grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((src, idx) => (
            <div key={`${src}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border/50 group">
              <img src={src} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {idx === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-md font-semibold">Cover</span>
              )}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label="Remove image"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition opacity-0 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => moveLeft(idx)}
                  aria-label="Move earlier"
                  className="absolute bottom-1 right-1 px-1.5 h-5 rounded-md bg-black/60 text-white text-[9px] hover:bg-black/80 transition opacity-0 group-hover:opacity-100"
                >
                  ◀
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add via URL */}
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleUrlAdd(); } }}
          placeholder={canAddMore ? 'Paste image URL…' : `Max ${MAX_IMAGES} images reached`}
          disabled={!canAddMore}
          className="h-10 rounded-xl text-xs flex-1"
        />
        <Button type="button" size="sm" variant="outline" className="h-10 rounded-xl px-3 gap-1" onClick={handleUrlAdd} disabled={!canAddMore || !urlInput.trim()}>
          <LinkIcon className="w-3 h-3" /> Add
        </Button>
      </div>

      {/* Upload one or more files */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !canAddMore}
          className="w-full h-20 rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary/70 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <><span className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /><span className="text-xs">Uploading…</span></>
          ) : canAddMore ? (
            <>
              <ImageIcon className="w-5 h-5" />
              <span className="text-xs">Click to upload images (up to {remaining} more, max 5 MB each)</span>
            </>
          ) : (
            <><ImageIcon className="w-5 h-5" /><span className="text-xs">Maximum {MAX_IMAGES} images reached — remove one to add more</span></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Product Drawer ────────────────────────────────────────────────────────
function normalizeInitialData(data: any) {
  if (!data) return defaultForm;
  return {
    ...defaultForm,
    ...data,
    tagsInput: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tagsInput || ''),
    availableCuts: data.availableCuts || [],
    images: data.images || [],
    animalType: data.meatAnimalType || data.animalType || '',
    nutritionCalories: data.nutritionJson?.calories ?? '',
    nutritionProtein: data.nutritionJson?.protein ?? '',
    nutritionCarbs: data.nutritionJson?.carbs ?? '',
    nutritionFat: data.nutritionJson?.fat ?? '',
  };
}

function ProductDrawer({ open, onClose, initialData, onSave, categoryOptions = CATEGORIES }: any) {
  const [form, setForm] = useState<any>(() => normalizeInitialData(initialData));
  const [saving, setSaving] = useState(false);

  // Re-sync form whenever the drawer opens or the product being edited changes
  useEffect(() => {
    setForm(normalizeInitialData(initialData));
  }, [initialData, open]);

  const isMeat = form.productType === 'FRESH_MEAT';

  const toggleCut = (cut: string) => {
    setForm((f: any) => ({
      ...f,
      availableCuts: f.availableCuts.includes(cut)
        ? f.availableCuts.filter((c: string) => c !== cut)
        : [...f.availableCuts, cut],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    const nutritionJson = (form.nutritionCalories || form.nutritionProtein || form.nutritionCarbs || form.nutritionFat) ? {
      calories: Number(form.nutritionCalories) || 0,
      protein: Number(form.nutritionProtein) || 0,
      carbs: Number(form.nutritionCarbs) || 0,
      fat: Number(form.nutritionFat) || 0,
    } : null;

    const tags = form.tagsInput
      ? form.tagsInput.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    try {
      await onSave({
        ...form,
        price: Number(form.price),
        comparePrice: form.comparePrice ? Number(form.comparePrice) : undefined,
        stockQty: Number(form.stockQty),
        lowStockThreshold: Number(form.lowStockThreshold),
        pricePerKg: form.pricePerKg ? Number(form.pricePerKg) : undefined,
        nutritionJson,
        tags,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initialData ? 'Edit Product' : 'Add New Product'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Image Upload */}
          <ImageUploadSection
            images={form.images || []}
            onChange={imgs => setForm((f: any) => ({ ...f, images: imgs }))}
          />

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Product Name *</label>
            <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Shan Biryani Masala" className="h-11 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
              placeholder="Short product description…"
              rows={2}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Product Type *</label>
              <Select value={form.productType} onValueChange={v => setForm((f: any) => ({ ...f, productType: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit</label>
              <Select value={form.unit} onValueChange={v => setForm((f: any) => ({ ...f, unit: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Category & Subcategory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category *</label>
              <Select value={form.category} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subcategory</label>
              <Input value={form.subcategory} onChange={e => setForm((f: any) => ({ ...f, subcategory: e.target.value }))} placeholder="e.g. Chicken, Lamb Cuts…" className="h-11 rounded-xl" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags <span className="text-muted-foreground/60">(comma-separated)</span></label>
            <Input value={form.tagsInput} onChange={e => setForm((f: any) => ({ ...f, tagsInput: e.target.value }))} placeholder="e.g. halal, fresh, boneless, certified" className="h-11 rounded-xl" />
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Price ($) *</label>
              <Input type="number" value={form.price} onChange={e => setForm((f: any) => ({ ...f, price: e.target.value }))} placeholder="0.00" className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Compare Price ($)</label>
              <Input type="number" value={form.comparePrice} onChange={e => setForm((f: any) => ({ ...f, comparePrice: e.target.value }))} placeholder="0.00" className="h-11 rounded-xl" />
            </div>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Stock Quantity</label>
              <Input type="number" value={form.stockQty} onChange={e => setForm((f: any) => ({ ...f, stockQty: e.target.value }))} className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Low Stock Alert</label>
              <Input type="number" value={form.lowStockThreshold} onChange={e => setForm((f: any) => ({ ...f, lowStockThreshold: e.target.value }))} className="h-11 rounded-xl" />
            </div>
          </div>

          {/* SKU */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU / Barcode</label>
            <Input value={form.sku} onChange={e => setForm((f: any) => ({ ...f, sku: e.target.value }))} placeholder="e.g. SKU-0012" className="h-11 rounded-xl" />
          </div>

          {/* Freshness Label */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Freshness Label</label>
            <Input value={form.freshnessLabel} onChange={e => setForm((f: any) => ({ ...f, freshnessLabel: e.target.value }))} placeholder="e.g. Cut this morning" className="h-11 rounded-xl" />
          </div>

          {/* Nutrition Facts */}
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nutrition Facts (per serving — optional)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Calories (kcal)</label>
                <Input type="number" value={form.nutritionCalories} onChange={e => setForm((f: any) => ({ ...f, nutritionCalories: e.target.value }))} placeholder="0" className="h-10 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Protein (g)</label>
                <Input type="number" value={form.nutritionProtein} onChange={e => setForm((f: any) => ({ ...f, nutritionProtein: e.target.value }))} placeholder="0" className="h-10 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Carbohydrates (g)</label>
                <Input type="number" value={form.nutritionCarbs} onChange={e => setForm((f: any) => ({ ...f, nutritionCarbs: e.target.value }))} placeholder="0" className="h-10 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Total Fat (g)</label>
                <Input type="number" value={form.nutritionFat} onChange={e => setForm((f: any) => ({ ...f, nutritionFat: e.target.value }))} placeholder="0" className="h-10 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Fresh Meat Fields */}
          {isMeat && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-red-800 uppercase tracking-wide">Fresh Meat Details</div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Animal Type</label>
                <Select value={form.animalType} onValueChange={v => setForm((f: any) => ({ ...f, animalType: v }))}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select animal" /></SelectTrigger>
                  <SelectContent>{ANIMAL_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Price per kg ($)</label>
                <Input type="number" value={form.pricePerKg} onChange={e => setForm((f: any) => ({ ...f, pricePerKg: e.target.value }))} placeholder="0.00" className="h-11 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Available Cuts</label>
                <div className="flex flex-wrap gap-2">
                  {CUTS.map(cut => (
                    <button key={cut} type="button" onClick={() => toggleCut(cut)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.availableCuts.includes(cut) ? 'bg-red-600 text-white border-red-600' : 'bg-white text-muted-foreground border-border hover:border-red-300'}`}
                    >{cut}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rich Detail Fields */}
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Detail Page Content (optional)</div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Product Details</label>
              <textarea
                value={form.productDetails}
                onChange={e => setForm((f: any) => ({ ...f, productDetails: e.target.value }))}
                placeholder="Detailed product description, origin, certifications, packaging, etc."
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ingredients</label>
              <textarea
                value={form.ingredients}
                onChange={e => setForm((f: any) => ({ ...f, ingredients: e.target.value }))}
                placeholder="Wheat flour, sugar, salt, ..."
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Usage / Cooking Directions</label>
              <textarea
                value={form.directions}
                onChange={e => setForm((f: any) => ({ ...f, directions: e.target.value }))}
                placeholder="Step-by-step usage or preparation instructions"
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Certified From</label>
                <Input
                  value={form.certifiedFrom}
                  onChange={e => setForm((f: any) => ({ ...f, certifiedFrom: e.target.value }))}
                  placeholder="e.g. ISNA Canada, HMA"
                  className="h-10 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Best Before / Expiry</label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={e => setForm((f: any) => ({ ...f, expiryDate: e.target.value }))}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {[
              { key: 'isHalalCertified', label: 'Halal Certified' },
              { key: 'isFeatured', label: 'Featured Product' },
              { key: 'isActive', label: 'Active / Visible' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm font-medium">{label}</span>
                <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={v => setForm((f: any) => ({ ...f, [key]: v }))} />
              </div>
            ))}
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 h-12 hg-gradient-primary border-0 text-white rounded-xl font-semibold" onClick={handleSave} disabled={saving || !form.name || !form.price}>
              {saving ? 'Saving…' : 'Save Product'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bulk Import Modal ─────────────────────────────────────────────────────
// Column headers in the template — plain names, no asterisks
const IMPORT_COLUMNS = ['name', 'price', 'productType', 'category', 'unit', 'stockQty', 'comparePrice', 'description', 'sku', 'image1', 'image2', 'image3', 'image4'];
const IMPORT_REQUIRED = ['name', 'price'];
const IMPORT_PRODUCT_TYPES = ['PACKAGED', 'FRESH_MEAT', 'PRODUCE', 'FROZEN', 'SPICES', 'BAKERY', 'DAIRY', 'BEVERAGES'];

function BulkImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: any[]; total: number } | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (r) => setRows(r.data as any[]),
        error: () => toast({ title: 'CSV parse error', variant: 'destructive' }),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setRows(data as any[]);
      };
      reader.readAsBinaryString(file);
    } else {
      toast({ title: 'Unsupported file type', description: 'Use CSV, XLS, or XLSX', variant: 'destructive' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleSubmit = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await api.post<any>('/store/products/bulk-import', { products: rows });
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => { setRows([]); setResult(null); onClose(); };

  const downloadTemplate = () => {
    const headers = IMPORT_COLUMNS.join(',');
    const example1 = 'Halal Chicken Breast,8.99,FRESH_MEAT,Meat & Poultry,kg,100,10.99,Fresh whole chicken breast,SKU-001,,https://example.com/chicken.jpg,,,';
    const example2 = 'Basmati Rice 5kg,12.49,PACKAGED,Rice & Grains,bag,50,,Premium aged basmati rice,SKU-002,,https://example.com/rice.jpg,https://example.com/rice2.jpg,,';
    const csv = [headers, example1, example2].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'numa-fresh-product-template.csv'; a.click();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Bulk Import Products
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-700">{result.imported}</div>
                <div className="text-xs text-green-600 mt-1">Successfully imported</div>
              </div>
              {result.errors.length > 0 && (
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-red-700">{result.errors.length}</div>
                  <div className="text-xs text-red-600 mt-1">Rows with errors</div>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground">Error details:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Row {e.row}: {e.reason}</p>
                ))}
              </div>
            )}
            <Button className="w-full hg-gradient-primary border-0 text-white rounded-xl" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ''; }}
              />
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-medium">Drop a CSV or Excel file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supports: .csv, .xlsx, .xls — Max 500 rows</p>
            </div>

            {/* Template download */}
            <button onClick={downloadTemplate} className="w-full text-center text-xs text-primary hover:underline">
              ↓ Download CSV template
            </button>

            {/* Column reference */}
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Columns (red = required, blue = images):</p>
              <div className="flex flex-wrap gap-1.5">
                {IMPORT_COLUMNS.map(c => (
                  <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${IMPORT_REQUIRED.includes(c) ? 'bg-red-100 text-red-700' : c.startsWith('image') ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>{c}</span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground"><span className="font-semibold text-blue-700">image1–image4</span>: paste direct image URLs (https://…). Leave blank if none.</p>
              <p className="text-[10px] text-muted-foreground"><span className="font-semibold">productType</span> values: {IMPORT_PRODUCT_TYPES.join(', ')}</p>
              <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">Column names are flexible — "Name", "Product Name", "product_name" all work for the name column.</p>
            </div>

            {/* Preview */}
            {rows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Preview — {rows.length} rows detected</p>
                <div className="border rounded-xl overflow-auto max-h-48">
                  <table className="text-xs w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>{Object.keys(rows[0]).slice(0, 6).map(k => <th key={k} className="px-3 py-2 text-left font-semibold truncate max-w-24">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          {Object.values(row).slice(0, 6).map((v: any, j) => <td key={j} className="px-3 py-1.5 truncate max-w-24">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 5 && <p className="text-xs text-muted-foreground text-center py-2">…and {rows.length - 5} more rows</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={handleClose}>Cancel</Button>
              <Button
                className="flex-1 hg-gradient-primary border-0 text-white rounded-xl"
                onClick={handleSubmit}
                disabled={!rows.length || importing}
              >
                {importing ? 'Importing…' : `Import ${rows.length} Product${rows.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Pagination Component ──────────────────────────────────────────────────
function Pagination({ page, totalPages, total, limit, onPageChange }: {
  page: number; totalPages: number; total: number; limit: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border/50">
      <span className="text-xs text-muted-foreground">
        Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> products
      </span>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs px-3" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>← Prev</Button>
        {pages.map((p, i) => p === '...' ? (
          <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
        ) : (
          <Button key={p} size="sm" variant={p === page ? 'default' : 'outline'}
            className={`h-8 w-8 p-0 rounded-lg text-xs ${p === page ? 'hg-gradient-primary border-0 text-white' : ''}`}
            onClick={() => onPageChange(p as number)}
          >{p}</Button>
        ))}
        <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs px-3" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next →</Button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function StorePortalProductsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Debounce search — queries ALL products in DB, not current page
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [typeFilter, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'products', typeFilter, page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (typeFilter) params.set('category', typeFilter);
      if (search) params.set('search', search);
      return api.get<any>(`/store/products?${params}`);
    },
  });

  // Dynamic stats from dedicated endpoint — always accurate, not limited by page
  const { data: statsData } = useQuery({
    queryKey: ['portal', 'product-stats'],
    queryFn: () => api.get<any>('/store/stats'),
    staleTime: 30_000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['portal', 'store-settings'],
    queryFn: () => api.get<any>('/store/settings'),
    staleTime: 60_000,
  });
  const storeCategories: string[] = (settingsData?.storeCategories ?? [])
    .map((c: any) => (typeof c === 'string' ? c : c.name))
    .filter(Boolean);
  const categoryOptions = storeCategories.length > 0 ? storeCategories : CATEGORIES;

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/store/products', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'products'] });
      qc.invalidateQueries({ queryKey: ['portal', 'product-stats'] });
      toast({ title: '✅ Product created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/store/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'products'] });
      qc.invalidateQueries({ queryKey: ['portal', 'product-stats'] });
      toast({ title: '✅ Product updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/store/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'products'] });
      qc.invalidateQueries({ queryKey: ['portal', 'product-stats'] });
      toast({ title: 'Product deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/store/products/${id}/stock`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'products'] });
      qc.invalidateQueries({ queryKey: ['portal', 'product-stats'] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, productIds }: any) => api.post('/store/products/bulk-action', { action, productIds }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['portal', 'products'] });
      qc.invalidateQueries({ queryKey: ['portal', 'product-stats'] });
      toast({ title: res?.message || 'Bulk action completed' });
      setSelectedIds(new Set());
      setShowBulkConfirm(false);
      setBulkAction('');
    },
    onError: (e: any) => toast({ title: 'Bulk action failed', description: e.message, variant: 'destructive' }),
  });

  // Search is always backend-driven — never filter on the frontend
  const products: any[] = data?.products || [];
  const pagination = data?.totalPages
    ? { totalPages: data.totalPages, total: data.total || 0, limit: 20 }
    : null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const ids = (data?.products ?? []).map((p: any) => p.id);
      if (ids.length === 0) return prev;
      const allOnPage = ids.every(i => prev.has(i));
      const next = new Set(prev);
      if (allOnPage) ids.forEach(i => next.delete(i));
      else ids.forEach(i => next.add(i));
      return next;
    });
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const url = getApiUrl('/store/products/export?format=csv');
      const token = localStorage.getItem('accessToken');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast({ title: '✅ Export complete! CSV downloaded.' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    if (editProduct) {
      await updateMutation.mutateAsync({ id: editProduct.id, ...formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setEditProduct(null);
    setDrawerOpen(false);
  };

  const openEdit = (product: any) => {
    const nutr = product.nutritionJson || {};
    setEditProduct({
      ...product,
      price: String(product.price),
      comparePrice: product.comparePrice ? String(product.comparePrice) : '',
      pricePerKg: product.pricePerKg ? String(product.pricePerKg) : '',
      stockQty: String(product.stockQty),
      lowStockThreshold: String(product.lowStockThreshold || 5),
      availableCuts: product.availableCuts || [],
      images: product.images || [],
      nutritionCalories: nutr.calories ? String(nutr.calories) : '',
      nutritionProtein: nutr.protein ? String(nutr.protein) : '',
      nutritionCarbs: nutr.carbs ? String(nutr.carbs) : '',
      nutritionFat: nutr.fat ? String(nutr.fat) : '',
    });
    setDrawerOpen(true);
  };

  const allOnPageSelected = products.length > 0 && products.every((p: any) => selectedIds.has(p.id));
  const someOnPageSelected = selectedIds.size > 0 && !allOnPageSelected;

  return (
    <PortalLayout title="Products">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Toolbar Row 1: Search + Filter + Export + Add */}
        <div className="flex flex-wrap gap-3">
          {/* Select All checkbox */}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border/50 bg-background hover:bg-muted/40 transition-colors min-w-0"
            title="Select / Deselect all on this page"
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
              ${allOnPageSelected ? 'bg-primary border-primary' : someOnPageSelected ? 'bg-primary/40 border-primary' : 'border-border'}`}
            >
              {(allOnPageSelected || someOnPageSelected) && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select'}
            </span>
          </button>

          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search all products or SKU…" className="pl-9 h-10 rounded-xl" />
          </div>

          <Select value={typeFilter || '_all'} onValueChange={v => setTypeFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-40 h-10 rounded-xl"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Types</SelectItem>
              {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2" disabled={exportLoading}>
                <Download className="h-4 w-4" />
                {exportLoading ? 'Exporting…' : 'Export'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>
                📄 Export all products as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" className="h-10 rounded-xl gap-2 border-dashed" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" /> Import
          </Button>
          <Button className="h-10 hg-gradient-primary border-0 text-white rounded-xl gap-2" onClick={() => { setEditProduct(null); setDrawerOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>

        {/* Bulk Actions Bar — visible when items selected */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-sm font-semibold text-primary">{selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-52 h-9 rounded-lg text-sm"><SelectValue placeholder="Choose bulk action…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activate">✅ Activate Selected</SelectItem>
                <SelectItem value="deactivate">🚫 Deactivate Selected</SelectItem>
                <SelectItem value="delete">🗑️ Delete Selected</SelectItem>
                <SelectItem value="mark_out_of_stock">📦 Mark as Out of Stock</SelectItem>
                <SelectItem value="mark_in_stock">📋 Mark as In Stock</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9 rounded-lg hg-gradient-primary border-0 text-white"
              disabled={!bulkAction || bulkMutation.isPending}
              onClick={() => bulkAction && setShowBulkConfirm(true)}
            >
              Apply
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => { setSelectedIds(new Set()); setBulkAction(''); }}>
              Clear
            </Button>
          </div>
        )}

        {/* Stats Bar — always uses real DB counts, not current page */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{statsData?.totalProducts ?? data?.total ?? 0}</strong> total</span>
          <span><strong className="text-green-600">{statsData?.activeProducts ?? '—'}</strong> active</span>
          <span><strong className="text-muted-foreground">{statsData?.inactiveProducts ?? '—'}</strong> inactive</span>
          <span><strong className="text-red-600">{statsData?.lowStock ?? '—'}</strong> low stock</span>
          <span><strong className="text-orange-600">{statsData?.outOfStock ?? '—'}</strong> out of stock</span>
          {statsData?.totalInventoryValue != null && (
            <span><strong className="text-primary">${Number(statsData.totalInventoryValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> inventory value</span>
          )}
        </div>

        {/* Product Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No products yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {search ? 'No products match your search across all your products' : 'Add your first product or import from a CSV/Excel file'}
            </p>
            {!search && (
              <div className="flex gap-3 justify-center">
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4" /> Import
                </Button>
                <Button className="hg-gradient-primary border-0 text-white rounded-xl gap-2" onClick={() => setDrawerOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Product
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                      <th className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAll}
                          className="rounded cursor-pointer"
                        />
                      </th>
                      <th className="px-2 py-2.5 w-12">Image</th>
                      <th className="px-3 py-2.5 text-left">Product Name</th>
                      <th className="px-3 py-2.5 text-center">Category</th>
                      <th className="px-3 py-2.5 text-right">Price</th>
                      <th className="px-3 py-2.5 text-center">Stock</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product: any) => {
                      const lowStock = Number(product.stockQty) <= (Number(product.lowStockThreshold) || 5) && Number(product.stockQty) > 0;
                      const outOfStock = Number(product.stockQty) === 0;
                      const isSelected = selectedIds.has(product.id);
                      const img = product.images?.[0] || '';
                      const approvalStatus = product.approvalStatus || (product.isApproved ? 'approved' : 'pending');

                      return (
                        <tr key={product.id}
                          className={`border-b border-border/30 transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/8' : !product.isActive ? 'opacity-60 hover:bg-muted/10' : 'hover:bg-muted/20'}`}>
                          <td className="px-3 py-2.5 text-center">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(product.id)} className="rounded cursor-pointer" />
                          </td>
                          <td className="px-2 py-2">
                            {img ? (
                              <img src={img} alt={product.name} className="w-12 h-12 rounded-md object-cover border border-border/30"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center border border-border/30">
                                <Package className="h-5 w-5 text-muted-foreground/40" />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 max-w-[200px]">
                            <div className="font-semibold text-foreground truncate">{product.name}</div>
                            {product.sku && <div className="text-[10px] text-muted-foreground mt-0.5">SKU: {product.sku}</div>}
                            {(lowStock || outOfStock) && (
                              <div className={`text-[10px] font-medium mt-0.5 flex items-center gap-1 ${outOfStock ? 'text-red-600' : 'text-orange-600'}`}>
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {outOfStock ? 'Out of Stock' : 'Low Stock'}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${TYPE_COLORS[product.productType] || TYPE_COLORS.OTHER}`}>
                              {(product.category || product.productType || 'OTHER').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="font-semibold text-primary">${Number(product.price).toFixed(2)}</div>
                            {product.comparePrice && Number(product.comparePrice) > Number(product.price) && (
                              <div className="text-[10px] text-muted-foreground line-through">${Number(product.comparePrice).toFixed(2)}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`font-medium ${outOfStock ? 'text-red-600' : lowStock ? 'text-orange-600' : 'text-foreground'}`}>
                              {product.stockQty}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {product.isActive ? 'Active' : 'Inactive'}
                              </span>
                              {approvalStatus === 'pending' && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">Pending</span>
                              )}
                              {approvalStatus === 'rejected' && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700" title={product.rejectionReason || 'Rejected'}>Rejected</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 justify-center">
                              <button title="Edit" onClick={() => openEdit(product)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <button
                                title={product.isActive ? 'Deactivate' : 'Activate'}
                                onClick={() => stockMutation.mutate({ id: product.id, isActive: !product.isActive })}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              >
                                {product.isActive
                                  ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <Eye className="h-3.5 w-3.5 text-green-600" />}
                              </button>
                              <button
                                title="Delete"
                                onClick={() => { if (confirm('Delete this product?')) deleteMutation.mutate(product.id); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination && (
              <Pagination
                page={page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            )}
          </>
        )}
      </div>

      {/* Bulk Confirm Dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-lg mb-2">Confirm Bulk Action</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to <strong>{bulkAction.replace(/_/g, ' ')}</strong> {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''}?
              {bulkAction === 'delete' && ' This will deactivate and hide them from the store.'}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowBulkConfirm(false)}>Cancel</Button>
              <Button className="flex-1 hg-gradient-primary border-0 text-white rounded-xl"
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ action: bulkAction, productIds: Array.from(selectedIds) })}
              >
                {bulkMutation.isPending ? 'Processing…' : 'Yes, Proceed'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProductDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditProduct(null); }}
        initialData={editProduct}
        onSave={handleSave}
        categoryOptions={categoryOptions}
      />

      <BulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['portal', 'products'] });
          qc.invalidateQueries({ queryKey: ['portal', 'product-stats'] });
        }}
      />
    </PortalLayout>
  );
}
