import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Star, Eye, EyeOff, Trash2, MessageSquare, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  repliedAt: string | null;
  isPublic: boolean;
  createdAt: string;
  storeId: string;
  storeName: string | null;
  userId: string;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  orderId: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState("all");
  const [filterVisible, setFilterVisible] = useState("all");
  const [filterRating, setFilterRating] = useState("all");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStore !== "all") params.set("storeId", filterStore);
      if (filterVisible !== "all") params.set("isPublic", filterVisible === "visible" ? "true" : "false");
      if (filterRating !== "all") params.set("minRating", filterRating);
      const data = await api.get<Review[]>(`/api/admin/reviews?${params}`);
      setReviews(data);
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [filterStore, filterVisible, filterRating]);

  useEffect(() => { load(); }, [load]);

  const stores = Array.from(new Map(reviews.map(r => [r.storeId, r.storeName])).entries());

  const toggleVisibility = async (r: Review) => {
    setSaving(r.id);
    try {
      const updated = await api.patch<Review>(`/api/admin/reviews/${r.id}`, { isPublic: !r.isPublic });
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, isPublic: updated.isPublic } : x));
      toast.success(updated.isPublic ? "Review made public" : "Review hidden from public");
    } catch {
      toast.error("Failed to update review");
    } finally {
      setSaving(null);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Permanently delete this review? This cannot be undone.")) return;
    setSaving(id);
    try {
      await api.delete(`/api/admin/reviews/${id}`);
      setReviews(prev => prev.filter(x => x.id !== id));
      toast.success("Review deleted");
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setSaving(null);
    }
  };

  const submitReply = async (id: string) => {
    if (!replyText.trim()) return;
    setSaving(id);
    try {
      const updated = await api.patch<Review>(`/api/admin/reviews/${id}`, { reply: replyText.trim() });
      setReviews(prev => prev.map(x => x.id === id ? { ...x, reply: updated.reply, repliedAt: updated.repliedAt } : x));
      setReplyId(null);
      setReplyText("");
      toast.success("Reply posted");
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setSaving(null);
    }
  };

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";
  const publicCount = reviews.filter(r => r.isPublic).length;

  return (
    <AdminLayout title="Customer Reviews">
      <div className="space-y-6">
        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Reviews", value: reviews.length },
            { label: "Avg Rating", value: avgRating },
            { label: "Visible", value: publicCount },
            { label: "Hidden", value: reviews.length - publicCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-border/50 rounded-2xl px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-52 h-9 rounded-xl text-sm">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterVisible} onValueChange={setFilterVisible}>
            <SelectTrigger className="w-44 h-9 rounded-xl text-sm">
              <SelectValue placeholder="All reviews" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="visible">Visible only</SelectItem>
              <SelectItem value="hidden">Hidden only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-40 h-9 rounded-xl text-sm">
              <SelectValue placeholder="Any rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Rating</SelectItem>
              <SelectItem value="4">4+ Stars</SelectItem>
              <SelectItem value="3">3+ Stars</SelectItem>
              <SelectItem value="1">1+ Stars</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Review list */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No reviews match these filters.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className={`bg-white border rounded-2xl p-5 transition-all ${r.isPublic ? "border-border/50" : "border-border/30 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StarRow rating={r.rating} />
                      <Badge variant="outline" className="text-xs rounded-full">
                        {r.storeName}
                      </Badge>
                      {!r.isPublic && (
                        <Badge variant="secondary" className="text-xs rounded-full bg-amber-100 text-amber-700 border-amber-200">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground mb-0.5">
                      {r.userFirstName} {r.userLastName}
                      {r.userEmail && <span className="text-xs text-muted-foreground font-normal ml-2">{r.userEmail}</span>}
                    </p>
                    {r.comment && <p className="text-sm text-muted-foreground leading-relaxed mt-1">{r.comment}</p>}
                    <p className="text-xs text-muted-foreground/60 mt-2">{new Date(r.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</p>

                    {r.reply && (
                      <div className="mt-3 pl-3 border-l-2 border-primary/30">
                        <p className="text-xs font-semibold text-primary mb-0.5">Admin reply</p>
                        <p className="text-sm text-muted-foreground">{r.reply}</p>
                      </div>
                    )}

                    {replyId === r.id && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Write a reply to this review…"
                          rows={2}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 rounded-xl hg-gradient-primary text-white border-0" onClick={() => submitReply(r.id)} disabled={saving === r.id || !replyText.trim()}>
                            {saving === r.id ? "Posting…" : "Post Reply"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => { setReplyId(null); setReplyText(""); }}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!r.reply && replyId !== r.id && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary" onClick={() => { setReplyId(r.id); setReplyText(""); }} title="Reply">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className={`h-8 w-8 rounded-xl ${r.isPublic ? "text-muted-foreground hover:text-amber-600" : "text-amber-600 hover:text-green-600"}`}
                      onClick={() => toggleVisibility(r)} disabled={saving === r.id} title={r.isPublic ? "Hide review" : "Make public"}>
                      {r.isPublic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600"
                      onClick={() => deleteReview(r.id)} disabled={saving === r.id} title="Delete review">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
