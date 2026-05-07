import { useState } from 'react';
import { motion } from 'framer-motion';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Package, Clock, AlertTriangle, Eye, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';

type PendingProduct = {
  id: string;
  name: string;
  category: string;
  productType: string;
  price: number;
  stockQty: number;
  isHalalCertified: boolean;
  isFreshMeat: boolean;
  images: string[];
  createdAt: string;
  store: { id: string; name: string; slug: string };
};

export default function AdminProductsPendingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ products: PendingProduct[]; total: number }>({
    queryKey: ['admin', 'products', 'pending'],
    queryFn: () => api.get('/admin/products/pending'),
    enabled: user?.role === 'ADMIN',
  });

  const approveMutation = useMutation({
    mutationFn: (productId: string) => api.post(`/admin/products/${productId}/approve`, {}),
    onSuccess: (_, productId) => {
      toast.success('Product approved and published!');
      qc.invalidateQueries({ queryKey: ['admin', 'products', 'pending'] });
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast.error('Failed to approve: ' + (err.message || 'Please try again'));
      setProcessingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ productId, reason }: { productId: string; reason: string }) =>
      api.post(`/admin/products/${productId}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Product rejected and store notified.');
      qc.invalidateQueries({ queryKey: ['admin', 'products', 'pending'] });
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast.error('Failed to reject: ' + (err.message || 'Please try again'));
      setProcessingId(null);
    },
  });

  const handleApprove = async (productId: string) => {
    setProcessingId(productId);
    await approveMutation.mutateAsync(productId);
  };

  const handleReject = async (productId: string) => {
    const reason = prompt('Reason for rejection (visible to store owner):');
    if (reason === null) return;
    setProcessingId(productId);
    await rejectMutation.mutateAsync({ productId, reason: reason || 'Does not meet halal standards' });
  };

  if (user?.role !== 'ADMIN') {
    return (
      <AdminLayout>
        <div className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="font-serif text-xl font-bold">Access Denied</h2>
        </div>
      </AdminLayout>
    );
  }

  const products = data?.products || [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif font-bold text-2xl">Product Approval Queue</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Review products submitted by store owners before they go live
            </p>
          </div>
          {data && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {data.total} pending
            </Badge>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && products.length === 0 && (
          <div className="text-center py-20 bg-card border border-border/50 rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-serif text-xl font-semibold mb-1">All Caught Up!</h3>
            <p className="text-muted-foreground text-sm">No products awaiting approval right now.</p>
          </div>
        )}

        {/* Product list */}
        <div className="space-y-3">
          {products.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-card border border-border/50 rounded-xl p-5 ${processingId === product.id ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Product image */}
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-muted-foreground/50" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-base">{product.name}</h3>
                    {product.isHalalCertified && (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 border">Halal Certified</Badge>
                    )}
                    {product.isFreshMeat && (
                      <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 border">Fresh Meat</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <Store className="w-3.5 h-3.5" />
                    <span>{product.store?.name}</span>
                    <span>·</span>
                    <span>{product.category}</span>
                    <span>·</span>
                    <span>${product.price?.toFixed(2)}</span>
                    <span>·</span>
                    <span>Stock: {product.stockQty}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Submitted {new Date(product.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/stores/${product.store?.slug}`} target="_blank">
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => handleReject(product.id)}
                    disabled={!!processingId}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 hg-gradient-primary border-0 text-white"
                    onClick={() => handleApprove(product.id)}
                    disabled={!!processingId}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="h-12" />
      </div>
    </AdminLayout>
  );
}
