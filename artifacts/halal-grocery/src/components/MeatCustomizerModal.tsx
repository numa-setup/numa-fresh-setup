import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ChevronRight, ChevronLeft, Scale } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

const CUT_OPTIONS = [
  { id: 'whole', label: 'Whole', emoji: '🥩', desc: 'Full cut, unprocessed' },
  { id: 'boneless', label: 'Boneless', emoji: '🔪', desc: 'Bones removed' },
  { id: 'bone-in', label: 'Bone-In', emoji: '🦴', desc: 'With bones' },
  { id: 'cubed', label: 'Cubed', emoji: '🎲', desc: 'Cut into cubes' },
  { id: 'ground', label: 'Ground', emoji: '🫙', desc: 'Minced / keema' },
  { id: 'custom', label: 'Custom', emoji: '✏️', desc: 'Specify below' },
];

const WEIGHT_OPTIONS = [
  { label: '0.5 kg', value: 0.5 },
  { label: '1 kg', value: 1 },
  { label: '1.5 kg', value: 1.5 },
  { label: '2 kg', value: 2 },
  { label: '3 kg', value: 3 },
];

const MARINATION_OPTIONS = ['None', 'Lemon & Herb', 'Tandoori', 'BBQ', 'Karahi Spice'];

interface MeatCustomizerModalProps {
  product: Product | null;
  storeId: string;
  storeSlug: string;
  storeName: string;
  onClose: () => void;
}

export function MeatCustomizerModal({ product, storeId, storeSlug, storeName, onClose }: MeatCustomizerModalProps) {
  const [step, setStep] = useState(1);
  const [selectedCut, setSelectedCut] = useState('');
  const [weight, setWeight] = useState(1);
  const [customWeight, setCustomWeight] = useState('');
  const [marination, setMarination] = useState('None');
  const [instructions, setInstructions] = useState('');
  const { addItem, setStoreInfo } = useCart();

  if (!product) return null;

  const actualWeight = customWeight ? parseFloat(customWeight) || weight : weight;
  const estimatedPrice = product.price * actualWeight;

  const handleAddToCart = () => {
    setStoreInfo(storeId, storeSlug, storeName);
    addItem(product, 1, {
      selectedCut,
      cutInstructions: [
        marination !== 'None' ? `Marination: ${marination}` : '',
        instructions,
      ].filter(Boolean).join(' | '),
      weightKg: actualWeight,
    });
    toast.success(`${product.name} added to cart`, {
      description: `${selectedCut} · ~${actualWeight}kg`,
    });
    onClose();
  };

  const steps = [
    { num: 1, label: 'Cut Type' },
    { num: 2, label: 'Weight' },
    { num: 3, label: 'Instructions' },
  ];

  return (
    <Dialog open={!!product} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-1 mb-3">
            {steps.map((s) => (
              <div key={s.num} className="flex items-center gap-1">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                  step >= s.num ? 'hg-gradient-primary text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span className={`text-xs ${step === s.num ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
                {s.num < 3 && <div className="w-8 h-px bg-border/50 mx-1" />}
              </div>
            ))}
          </div>
          <DialogTitle className="font-serif text-xl">{product.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">${product.price.toFixed(2)}/kg · Customize your cut</p>
        </DialogHeader>

        <div className="px-6 py-5 min-h-[260px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm font-medium text-muted-foreground mb-3">Select your preferred cut</p>
                <div className="grid grid-cols-3 gap-2">
                  {CUT_OPTIONS.map((cut) => (
                    <button
                      key={cut.id}
                      onClick={() => setSelectedCut(cut.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedCut === cut.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/50 hover:border-primary/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">{cut.emoji}</div>
                      <div className="text-sm font-medium leading-tight">{cut.label}</div>
                      <div className="text-xs text-muted-foreground">{cut.desc}</div>
                      {selectedCut === cut.id && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm font-medium text-muted-foreground mb-3">How much do you need?</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {WEIGHT_OPTIONS.map((w) => (
                    <button
                      key={w.value}
                      onClick={() => { setWeight(w.value); setCustomWeight(''); }}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        weight === w.value && !customWeight
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border/50 hover:border-primary/40'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Custom kg..."
                    value={customWeight}
                    onChange={(e) => setCustomWeight(e.target.value)}
                    className="w-32 px-3 py-2 rounded-xl border border-border/50 text-sm focus:border-primary outline-none"
                    step="0.25"
                    min="0.25"
                    max="10"
                  />
                  <span className="text-sm text-muted-foreground">kg</span>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary">Est. ${estimatedPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Final price based on actual weight at pickup</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Marination (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {MARINATION_OPTIONS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMarination(m)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                          marination === m ? 'border-primary bg-primary/5 text-primary' : 'border-border/50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Special Instructions</p>
                  <Textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Small pieces, single pack, remove fat..."
                    className="rounded-xl resize-none text-sm"
                    rows={3}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 pb-6 flex items-center gap-3 border-t border-border/50 pt-4">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="rounded-xl gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              className="flex-1 hg-gradient-primary border-0 text-white rounded-xl gap-1"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !selectedCut}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 hg-gradient-primary border-0 text-white rounded-xl"
              onClick={handleAddToCart}
            >
              Add to Cart · ~${estimatedPrice.toFixed(2)}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
