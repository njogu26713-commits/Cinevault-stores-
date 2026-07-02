import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp, Plus, Film, Tv, Clock, TrendingUp, Star, Loader2,
  Search, X, CheckCircle2, XCircle, Sparkles, AlertCircle
} from "lucide-react";
import { Layout } from "../components/layout";
import { useUserAuth } from "../contexts/user-auth";
import { toast } from "sonner";
import { useLocation } from "wouter";

/* ── Types ──────────────────────────────────────────────────── */
interface MovieRequest {
  _id: string;
  title: string;
  category: "movie" | "series";
  posterUrl: string | null;
  reason: string;
  userId: string;
  username: string;
  voteCount: number;
  voted: boolean;
  status: "pending" | "approved" | "rejected" | "coming_soon" | "added" | "unavailable";
  adminNote: string | null;
  pinned: boolean;
  createdAt: string;
}

interface Pagination { page: number; pages: number; total: number; }

/* ── Helpers ─────────────────────────────────────────────────── */
function relTime(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  approved:    { label: "Approved",    color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  coming_soon: { label: "Coming Soon", color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  added:       { label: "Added ✓",     color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  rejected:    { label: "Rejected",    color: "bg-red-500/10 text-red-500 border-red-500/30" },
  unavailable: { label: "Unavailable", color: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
};

const AVATAR_COLORS = [
  "bg-red-600", "bg-blue-600", "bg-green-600", "bg-purple-600",
  "bg-orange-500", "bg-pink-600", "bg-cyan-600", "bg-yellow-500",
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

/* ── Skeleton ────────────────────────────────────────────────── */
function RequestSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="w-16 h-24 bg-muted rounded-lg shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-1/4" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-4/5" />
          <div className="flex gap-2 mt-2">
            <div className="h-8 w-16 bg-muted rounded-lg" />
            <div className="h-8 w-20 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Submit Modal ────────────────────────────────────────────── */
function SubmitModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (r: MovieRequest) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"movie" | "series">("movie");
  const [posterUrl, setPosterUrl] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (reason.trim().length < 10) { setError("Reason must be at least 10 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category, posterUrl: posterUrl.trim() || null, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      toast.success("Request submitted!");
      onSuccess(data);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-0">
            <div>
              <h2 className="text-lg font-bold">Request a Title</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Suggest a movie or series to add</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-muted hover:bg-muted/70 transition text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Category</label>
              <div className="flex gap-2">
                {(["movie", "series"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border transition ${
                      category === c ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                    }`}>
                    {c === "movie" ? <Film size={14} /> : <Tv size={14} />}
                    {c === "movie" ? "Movie" : "TV Series"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Title <span className="text-destructive">*</span></label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Oppenheimer"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Poster URL <span className="text-muted-foreground text-xs">(optional)</span></label>
              <input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Why do you want it? <span className="text-destructive">*</span></label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3}
                maxLength={1000} placeholder="Tell us why this title should be added..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
              <p className="text-xs text-muted-foreground mt-1">{reason.length}/1000</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Submit Request
            </button>
          </form>
        </motion.div>
      </div>
    </>
  );
}

/* ── Request Card ────────────────────────────────────────────── */
function RequestCard({ request, onVote }: { request: MovieRequest; onVote: (id: string, voted: boolean, count: number) => void }) {
  const { user } = useUserAuth();
  const [, navigate] = useLocation();
  const [voting, setVoting] = useState(false);
  const status = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.pending;

  const handleVote = async () => {
    if (!user) { navigate("/login"); return; }
    setVoting(true);
    try {
      const res = await fetch(`/api/requests/${request._id}/vote`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onVote(request._id, data.voted, data.voteCount);
    } catch { toast.error("Failed to vote"); }
    finally { setVoting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl p-5 hover:border-border/80 transition ${request.pinned ? "border-primary/30 shadow-primary/5 shadow-sm" : "border-border"}`}>
      <div className="flex gap-4">
        {/* Poster */}
        <div className="w-16 h-24 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
          {request.posterUrl ? (
            <img src={request.posterUrl} alt={request.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {request.category === "movie" ? <Film size={22} /> : <Tv size={22} />}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {request.pinned && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  📌 Pinned
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${status.color}`}>
                {status.label}
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border uppercase tracking-wider">
                {request.category === "movie" ? "Movie" : "TV Series"}
              </span>
            </div>
          </div>

          <h3 className="font-bold text-foreground leading-tight mb-1 line-clamp-1">{request.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{request.reason}</p>

          {request.adminNote && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2 mb-3">
              <Sparkles size={11} className="text-primary mt-0.5 shrink-0" />
              <span><span className="font-medium text-foreground">Admin:</span> {request.adminNote}</span>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full ${avatarColor(request.username)} flex items-center justify-center text-white text-[9px] font-bold`}>
                {request.username[0].toUpperCase()}
              </div>
              <span className="text-xs text-muted-foreground">{request.username} · {relTime(request.createdAt)}</span>
            </div>

            <button onClick={handleVote} disabled={voting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                request.voted
                  ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
              }`}>
              {voting ? <Loader2 size={13} className="animate-spin" /> : <ChevronUp size={13} className={request.voted ? "text-primary" : ""} />}
              <span>{request.voteCount}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
type Sort = "top" | "newest" | "trending";

export default function RequestsPage() {
  const { user } = useUserAuth();
  const [, navigate] = useLocation();
  const [sort, setSort] = useState<Sort>("top");
  const [requests, setRequests] = useState<MovieRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const fetchRequests = useCallback(async (s: Sort, page: number, append = false) => {
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/requests?sort=${s}&page=${page}`);
      const data = await res.json();
      setRequests((prev) => append ? [...prev, ...data.requests] : data.requests);
      setPagination(data.pagination);
    } catch { toast.error("Failed to load requests"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  // Initial load
  useEffect(() => { fetchRequests(sort, 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSortChange = (s: Sort) => {
    setSort(s);
    fetchRequests(s, 1);
  };

  const handleVote = (id: string, voted: boolean, voteCount: number) => {
    setRequests((prev) => prev.map((r) => r._id === id ? { ...r, voted, voteCount } : r));
  };

  const handleNewRequest = (r: MovieRequest) => {
    setRequests((prev) => [r, ...prev]);
  };

  const filtered = search.trim()
    ? requests.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : requests;

  const SORTS: { key: Sort; label: string; icon: React.ReactNode }[] = [
    { key: "top",      label: "Most Requested", icon: <Star size={14} /> },
    { key: "newest",   label: "Newest",         icon: <Clock size={14} /> },
    { key: "trending", label: "Trending",        icon: <TrendingUp size={14} /> },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-6 py-10 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground">Movie Requests</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Vote for what you want added · {pagination.total} request{pagination.total !== 1 ? "s" : ""} total
            </p>
          </div>
          <button
            onClick={() => user ? setShowModal(true) : navigate("/login")}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2.5 rounded-xl transition shrink-0">
            <Plus size={16} />
            Request a Title
          </button>
        </div>

        {/* Sort + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
            {SORTS.map(({ key, label, icon }) => (
              <button key={key} onClick={() => handleSortChange(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  sort === key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {icon} {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requests…"
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Request list */}
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <RequestSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Film size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium">{search ? "No requests match your search" : "No requests yet — be the first!"}</p>
              {!search && (
                <button onClick={() => user ? setShowModal(true) : navigate("/login")}
                  className="mt-4 text-primary hover:underline text-sm font-medium">
                  Submit a request
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((request) => (
                <RequestCard key={request._id} request={request} onVote={handleVote} />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Load more */}
        {!loading && pagination.page < pagination.pages && (
          <div className="flex justify-center mt-8">
            <button onClick={() => fetchRequests(sort, pagination.page + 1, true)} disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition">
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
              Load more ({pagination.total - filtered.length} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Submit modal */}
      <AnimatePresence>
        {showModal && <SubmitModal onClose={() => setShowModal(false)} onSuccess={handleNewRequest} />}
      </AnimatePresence>
    </Layout>
  );
}
