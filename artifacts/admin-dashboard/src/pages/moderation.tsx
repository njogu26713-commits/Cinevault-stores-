import { useState, useEffect, useCallback } from "react";
import { Trash2, Pin, Flag, CheckCheck, Loader2, AlertCircle, Star, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Reply { _id: string; username: string; text: string; createdAt: string; }
interface Review {
  _id: string; contentType: "movie" | "series"; contentId: string;
  userId: string; username: string; rating: number; text: string;
  likeCount: number; reportCount: number; pinned: boolean;
  replies: Reply[]; createdAt: string;
}
interface Pagination { page: number; pages: number; total: number; }

function relTime(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ReviewRow({ review, onDelete, onPin, onDismissReports }: {
  review: Review;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDismissReports: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete this review by ${review.username}?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/reviews/${review._id}`, { method: "DELETE" });
    if (res.ok) onDelete(review._id);
    setDeleting(false);
  };

  const handlePin = async () => {
    setPinning(true);
    const res = await fetch(`/api/admin/reviews/${review._id}/pin`, { method: "PUT" });
    const data = await res.json();
    if (res.ok) onPin(review._id, data.pinned);
    setPinning(false);
  };

  const handleDismiss = async () => {
    setDismissing(true);
    const res = await fetch(`/api/admin/reviews/${review._id}/reports`, { method: "DELETE" });
    if (res.ok) onDismissReports(review._id);
    setDismissing(false);
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition ${review.pinned ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
            {review.username[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{review.username}</span>
              <Badge variant="outline" className="text-[10px]">
                {review.contentType === "movie" ? "🎬 Movie" : "📺 Series"}
              </Badge>
              {review.pinned && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">📌 Pinned</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={10} className={i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"} />
                ))}
              </span>
              <span>{relTime(review.createdAt)}</span>
              <span className="flex items-center gap-1"><ThumbsUp size={10} /> {review.likeCount}</span>
              {review.reportCount > 0 && (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <Flag size={10} /> {review.reportCount} report{review.reportCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {review.reportCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleDismiss} disabled={dismissing} className="h-7 text-xs gap-1">
              {dismissing ? <Loader2 size={11} className="animate-spin" /> : <CheckCheck size={11} />}
              Dismiss Reports
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePin} disabled={pinning} className="h-7 text-xs gap-1">
            {pinning ? <Loader2 size={11} className="animate-spin" /> : <Pin size={11} />}
            {review.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="h-7 text-xs gap-1">
            {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Delete
          </Button>
        </div>
      </div>

      <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 rounded-lg px-3 py-2.5">
        {review.text}
      </p>

      {review.replies.length > 0 && (
        <div className="ml-4 border-l-2 border-border/50 pl-3 space-y-1">
          {review.replies.map((reply) => (
            <div key={reply._id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{reply.username}:</span> {reply.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Moderation() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async (f: string, page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?filter=${f}&page=${page}`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
    } catch { toast({ title: "Failed to load reviews", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchReviews(filter, 1); }, [filter, fetchReviews]);

  const handleDelete = (id: string) => {
    setReviews((prev) => prev.filter((r) => r._id !== id));
    toast({ title: "Review deleted" });
  };
  const handlePin = (id: string, pinned: boolean) => {
    setReviews((prev) => prev.map((r) => r._id === id ? { ...r, pinned } : r));
    toast({ title: pinned ? "Review pinned" : "Review unpinned" });
  };
  const handleDismissReports = (id: string) => {
    setReviews((prev) => prev.map((r) => r._id === id ? { ...r, reportCount: 0 } : r));
    toast({ title: "Reports dismissed" });
  };

  const reportedCount = reviews.filter((r) => r.reportCount > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Review Moderation</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{pagination.total} total reviews</p>
        </div>
        <div className="flex items-center gap-3">
          {reportedCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5">
              <AlertCircle size={14} />
              {reportedCount} flagged
            </div>
          )}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="reported">Reported Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={28} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-border rounded-xl">
          <Flag size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">{filter === "reported" ? "No reported reviews" : "No reviews yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewRow key={review._id} review={review}
              onDelete={handleDelete} onPin={handlePin} onDismissReports={handleDismissReports} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => fetchReviews(filter, pagination.page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages}
              onClick={() => fetchReviews(filter, pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
