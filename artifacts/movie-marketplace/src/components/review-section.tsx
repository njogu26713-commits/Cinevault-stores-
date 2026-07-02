import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, MessageCircle, Trash2, Pencil, Flag, Pin, ChevronDown, ChevronUp, Loader2, Star } from "lucide-react";
import { useUserAuth } from "../contexts/user-auth";
import { toast } from "sonner";

/* ── helpers ─────────────────────────────────────────────────── */
function relTime(date: string | Date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

const AVATAR_COLORS = [
  "bg-red-600", "bg-blue-600", "bg-green-600", "bg-purple-600",
  "bg-orange-500", "bg-pink-600", "bg-cyan-600", "bg-yellow-500",
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

/* ── sub-components ──────────────────────────────────────────── */
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hov, setHov] = useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHov(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHov(s)}
          className="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none"
        >
          <span className={(hov || value) >= s ? "text-yellow-400" : "text-muted-foreground/25"}>★</span>
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "text-lg" : "text-sm";
  return (
    <span className={`flex gap-px ${cls}`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={rating >= s ? "text-yellow-400" : "text-muted-foreground/25"}>★</span>
      ))}
    </span>
  );
}

function UserAvatar({ username, size = "sm" }: { username: string; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  return (
    <div className={`${sz} rounded-full ${avatarColor(username)} flex items-center justify-center text-white font-bold shrink-0`}>
      {username[0].toUpperCase()}
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-muted" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-32 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
      </div>
      <div className="h-3.5 bg-muted rounded w-full" />
      <div className="h-3.5 bg-muted rounded w-4/5" />
    </div>
  );
}

/* ── types ───────────────────────────────────────────────────── */
interface Reply { _id: string; userId: string; username: string; text: string; createdAt: string; }
interface Review {
  _id: string; contentType: string; contentId: string;
  userId: string; username: string; rating: number; text: string;
  likeCount: number; liked: boolean; reported: boolean; pinned: boolean;
  replies: Reply[]; createdAt: string;
}
interface AggRating { avg: number; count: number; }
interface Pagination { page: number; pages: number; total: number; }

/* ── main component ──────────────────────────────────────────── */
export interface ReviewSectionProps {
  contentType: "movie" | "series";
  contentId: string;
}

export function ReviewSection({ contentType, contentId }: ReviewSectionProps) {
  const { user } = useUserAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [aggRating, setAggRating] = useState<AggRating>({ avg: 0, count: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // form state
  const [formRating, setFormRating] = useState(0);
  const [formText, setFormText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // reply state: reviewId → text
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null);

  const fetchReviews = useCallback(async (page = 1, append = false) => {
    try {
      const res = await fetch(`/api/reviews/${contentType}/${contentId}?page=${page}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setReviews((prev) => append ? [...prev, ...data.reviews] : data.reviews);
      setAggRating(data.rating);
      setPagination(data.pagination);
    } catch {
      if (!append) toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [contentType, contentId]);

  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  const loadMore = () => {
    if (loadingMore || pagination.page >= pagination.pages) return;
    setLoadingMore(true);
    fetchReviews(pagination.page + 1, true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRating) return toast.error("Please select a star rating");
    if (formText.trim().length < 10) return toast.error("Review must be at least 10 characters");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId, rating: formRating, text: formText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setFormRating(0); setFormText("");
      setReviews((prev) => [data, ...prev]);
      setAggRating((r) => ({ avg: Math.round(((r.avg * r.count + formRating) / (r.count + 1)) * 10) / 10, count: r.count + 1 }));
      toast.success("Review posted!");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to post review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (reviewId: string) => {
    if (!user) return toast.error("Sign in to like reviews");
    const res = await fetch(`/api/reviews/${reviewId}/like`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setReviews((prev) => prev.map((r) => r._id === reviewId ? { ...r, liked: data.liked, likeCount: data.likeCount } : r));
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Delete your review?")) return;
    const res = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete");
    setReviews((prev) => prev.filter((r) => r._id !== reviewId));
    setAggRating((r) => ({ ...r, count: Math.max(0, r.count - 1) }));
    toast.success("Review deleted");
  };

  const startEdit = (r: Review) => { setEditId(r._id); setEditRating(r.rating); setEditText(r.text); };
  const cancelEdit = () => setEditId(null);

  const handleSaveEdit = async () => {
    if (!editId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/reviews/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: editRating, text: editText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setReviews((prev) => prev.map((r) => r._id === editId ? { ...r, rating: data.rating, text: data.text } : r));
      setEditId(null);
      toast.success("Review updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  const handleReport = async (reviewId: string) => {
    if (!user) return toast.error("Sign in to report");
    const res = await fetch(`/api/reviews/${reviewId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Inappropriate content" }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error ?? "Failed");
    setReviews((prev) => prev.map((r) => r._id === reviewId ? { ...r, reported: true } : r));
    toast.success("Reported — thanks for keeping things civil");
  };

  const handleAddReply = async (reviewId: string) => {
    const text = replyTexts[reviewId] ?? "";
    if (text.trim().length < 2) return;
    setReplySubmitting(reviewId);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setReviews((prev) => prev.map((r) => r._id === reviewId ? { ...r, replies: [...r.replies, data] } : r));
      setReplyTexts((p) => ({ ...p, [reviewId]: "" }));
    } catch (err: any) {
      toast.error(err.message ?? "Failed to post reply");
    } finally {
      setReplySubmitting(null);
    }
  };

  const handleDeleteReply = async (reviewId: string, replyId: string) => {
    const res = await fetch(`/api/reviews/${reviewId}/replies/${replyId}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete reply");
    setReviews((prev) => prev.map((r) => r._id === reviewId ? { ...r, replies: r.replies.filter((rep) => rep._id !== replyId) } : r));
  };

  const alreadyReviewed = user ? reviews.some((r) => r.userId === user.id) : false;

  return (
    <section className="mt-12 space-y-8">
      {/* Header + aggregate */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reviews</h2>
          <p className="text-sm text-muted-foreground">
            {aggRating.count === 0 ? "No reviews yet — be the first!" : `${aggRating.count} review${aggRating.count === 1 ? "" : "s"}`}
          </p>
        </div>
        {aggRating.count > 0 && (
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-5 py-3">
            <span className="text-3xl font-bold text-foreground">{aggRating.avg.toFixed(1)}</span>
            <div>
              <StarDisplay rating={Math.round(aggRating.avg)} size="lg" />
              <p className="text-xs text-muted-foreground mt-0.5">out of 5</p>
            </div>
          </div>
        )}
      </div>

      {/* Write review form */}
      {user && !alreadyReviewed && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <UserAvatar username={user.username} size="md" />
            <div>
              <p className="font-semibold text-sm">{user.username}</p>
              <p className="text-xs text-muted-foreground">Write your review</p>
            </div>
          </div>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Your rating</p>
              <StarInput value={formRating} onChange={setFormRating} />
            </div>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Share your thoughts about this title…"
              rows={4}
              maxLength={2000}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{formText.length}/2000</span>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg transition flex items-center gap-2 text-sm"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Post Review
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {!user && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">
            <a href="/login" className="text-primary hover:underline font-medium">Sign in</a> to write a review
          </p>
        </div>
      )}

      {user && alreadyReviewed && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 text-sm text-muted-foreground">
          You've already reviewed this title. Edit your review below.
        </div>
      )}

      {/* Reviews list */}
      <div className="space-y-4">
        {loading && [1, 2, 3].map((i) => <ReviewSkeleton key={i} />)}

        <AnimatePresence>
          {!loading && reviews.map((review, idx) => (
            <motion.div
              key={review._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: idx * 0.04 }}
              className={`bg-card border rounded-xl p-5 space-y-3 ${review.pinned ? "border-primary/40 shadow-primary/10 shadow-sm" : "border-border"}`}
            >
              {/* Review header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserAvatar username={review.username} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{review.username}</span>
                      {review.pinned && (
                        <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarDisplay rating={review.rating} />
                      <span className="text-xs text-muted-foreground">{relTime(review.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit mode */}
              {editId === review._id ? (
                <div className="space-y-3">
                  <StarInput value={editRating} onChange={setEditRating} />
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} disabled={editSaving} className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition flex items-center gap-1.5">
                      {editSaving && <Loader2 size={12} className="animate-spin" />} Save
                    </button>
                    <button onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{review.text}</p>
              )}

              {/* Actions */}
              {editId !== review._id && (
                <div className="flex items-center gap-4 pt-1 flex-wrap">
                  <button
                    onClick={() => handleLike(review._id)}
                    className={`flex items-center gap-1.5 text-xs transition ${review.liked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <ThumbsUp size={14} className={review.liked ? "fill-current" : ""} />
                    <span>{review.likeCount > 0 ? review.likeCount : ""} {review.likeCount === 1 ? "Like" : "Likes"}</span>
                  </button>

                  {user && (
                    <button
                      onClick={() => setOpenReply(openReply === review._id ? null : review._id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      <MessageCircle size={14} />
                      <span>{review.replies.length > 0 ? `${review.replies.length} ` : ""}Reply</span>
                      {openReply === review._id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    {user?.id === review.userId && (
                      <>
                        <button onClick={() => startEdit(review)} className="text-muted-foreground hover:text-foreground transition p-1 rounded" title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(review._id)} className="text-muted-foreground hover:text-destructive transition p-1 rounded" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                    {user && user.id !== review.userId && !review.reported && (
                      <button onClick={() => handleReport(review._id)} className="text-muted-foreground/50 hover:text-yellow-500 transition p-1 rounded" title="Report">
                        <Flag size={13} />
                      </button>
                    )}
                    {review.reported && <span className="text-xs text-muted-foreground/40 flex items-center gap-1"><Flag size={11} /> Reported</span>}
                  </div>
                </div>
              )}

              {/* Replies */}
              <AnimatePresence>
                {(openReply === review._id || review.replies.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-l-2 border-border/50 ml-4 pl-4 mt-2 space-y-3">
                      {review.replies.map((reply) => (
                        <div key={reply._id} className="flex items-start gap-2.5 group">
                          <div className={`w-6 h-6 rounded-full ${avatarColor(reply.username)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}>
                            {reply.username[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-xs font-semibold">{reply.username}</span>
                              <span className="text-xs text-muted-foreground">{relTime(reply.createdAt)}</span>
                            </div>
                            <p className="text-xs text-foreground/80 mt-0.5">{reply.text}</p>
                          </div>
                          {user?.id === reply.userId && (
                            <button
                              onClick={() => handleDeleteReply(review._id, reply._id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Reply input */}
                      {user && openReply === review._id && (
                        <div className="flex gap-2 mt-3">
                          <div className={`w-6 h-6 rounded-full ${avatarColor(user.username)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1`}>
                            {user.username[0].toUpperCase()}
                          </div>
                          <div className="flex-1 flex gap-2">
                            <input
                              value={replyTexts[review._id] ?? ""}
                              onChange={(e) => setReplyTexts((p) => ({ ...p, [review._id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddReply(review._id)}
                              placeholder="Write a reply…"
                              className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                            />
                            <button
                              onClick={() => handleAddReply(review._id)}
                              disabled={replySubmitting === review._id}
                              className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                            >
                              {replySubmitting === review._id ? <Loader2 size={12} className="animate-spin" /> : "Post"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && reviews.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-3">🎬</p>
            <p className="font-medium">No reviews yet</p>
            <p className="text-sm mt-1">{user ? "Be the first to share your thoughts!" : "Sign in to write the first review."}</p>
          </div>
        )}

        {/* Load more */}
        {pagination.page < pagination.pages && (
          <div className="flex justify-center pt-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 px-6 py-2 rounded-lg transition flex items-center gap-2"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" />}
              Load more reviews ({pagination.total - reviews.length} remaining)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
