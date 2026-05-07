import { useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Star, CheckCircle, Trash2, Sparkles, Filter, RefreshCw, MessageSquare, Store, Package, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface SiteReview {
  id: string;
  targetType: 'platform' | 'store' | 'product';
  storeId: string | null;
  storeName: string | null;
  productSlug: string | null;
  authorId: string | null;
  authorName: string;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'}`} />)}
    </div>
  );
}

const TYPE_ICON = { platform: Globe, store: Store, product: Package };
const TYPE_LABEL = { platform: 'Platform', store: 'Store', product: 'Product' };
const TYPE_COLOR = { platform: 'bg-primary/10 text-primary', store: 'bg-blue-100 text-blue-700', product: 'bg-purple-100 text-purple-700' };

export default function AdminSiteReviewsPage() {
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const qc = useQueryClient();

  const { data: reviews = [], isLoading, refetch } = useQuery<SiteReview[]>({
    queryKey: ['admin', 'site-reviews', filterType, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterType !== 'all') p.set('targetType', filterType);
      if (filterStatus !== 'all') p.set('isApproved', filterStatus === 'approved' ? 'true' : 'false');
      return api.get<SiteReview[]>(`/site-reviews/admin?${p}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/site-reviews/admin/${id}/approve`, {}),
    onSuccess: () => { toast.success('Review approved — now publicly visible'); qc.invalidateQueries({ queryKey: ['admin', 'site-reviews'] }); },
    onError: () => toast.error('Failed to approve review'),
  });

  const featureMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/site-reviews/admin/${id}/feature`, {}),
    onSuccess: () => { toast.success('Feature status updated'); qc.invalidateQueries({ queryKey: ['admin', 'site-reviews'] }); },
    onError: () => toast.error('Failed to update feature status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/site-reviews/admin/${id}`),
    onSuccess: () => { toast.success('Review deleted'); qc.invalidateQueries({ queryKey: ['admin', 'site-reviews'] }); },
    onError: () => toast.error('Failed to delete review'),
  });

  const pending = reviews.filter(r => !r.isApproved).length;
  const approved = reviews.filter(r => r.isApproved).length;
  const featured = reviews.filter(r => r.isFeatured).length;

  return (
    <AdminLayout title="Reviews Management" subtitle="Approve, feature, and manage all submitted reviews">
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending Approval', value: pending, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Approved', value: approved, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
            { label: 'Featured on Homepage', value: featured, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-card rounded-2xl border border-border/50 p-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 h-9 text-sm rounded-xl"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="platform">Platform</SelectItem>
              <SelectItem value="store">Store</SelectItem>
              <SelectItem value="product">Product</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-9 text-sm rounded-xl"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto h-9 rounded-xl gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        {/* Reviews list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">No reviews found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Reviews submitted by customers will appear here for approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => {
              const TypeIcon = TYPE_ICON[r.targetType];
              return (
                <div key={r.id} className={`bg-card rounded-2xl border p-5 ${!r.isApproved ? 'border-amber-200 bg-amber-50/30' : 'border-border/50'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[r.targetType]}`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{r.authorName}</span>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLOR[r.targetType]}`}>
                          {TYPE_LABEL[r.targetType]}{r.storeName ? ` · ${r.storeName}` : ''}{r.productSlug ? ` · ${r.productSlug}` : ''}
                        </Badge>
                        {!r.isApproved && <Badge className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">Pending</Badge>}
                        {r.isApproved && <Badge className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">Approved</Badge>}
                        {r.isFeatured && <Badge className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full gap-1"><Sparkles className="w-2.5 h-2.5" />Featured</Badge>}
                      </div>
                      <Stars rating={r.rating} />
                      {r.comment && <p className="text-sm text-foreground mt-2 leading-relaxed">"{r.comment}"</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!r.isApproved && (
                        <Button size="sm" onClick={() => approveMutation.mutate(r.id)}
                          disabled={approveMutation.isPending}
                          className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg gap-1.5 text-xs">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </Button>
                      )}
                      {r.isApproved && r.targetType === 'platform' && (
                        <Button size="sm" variant="outline" onClick={() => featureMutation.mutate(r.id)}
                          disabled={featureMutation.isPending}
                          className={`h-8 px-3 rounded-lg gap-1.5 text-xs ${r.isFeatured ? 'border-primary text-primary' : ''}`}>
                          <Sparkles className="w-3.5 h-3.5" /> {r.isFeatured ? 'Unfeature' : 'Feature'}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { if (confirm('Delete this review?')) deleteMutation.mutate(r.id); }}
                        disabled={deleteMutation.isPending}
                        className="h-8 w-8 p-0 rounded-lg text-red-500 border-red-200 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
