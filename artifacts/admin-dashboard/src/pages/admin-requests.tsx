import { useState, useEffect, useCallback } from "react";
import { Trash2, Pin, Loader2, ChevronUp, Film, Tv, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type RequestStatus = "pending" | "approved" | "rejected" | "coming_soon" | "added" | "unavailable";

interface MovieRequest {
  _id: string; title: string; category: "movie" | "series";
  posterUrl: string | null; reason: string;
  userId: string; username: string; voteCount: number;
  status: RequestStatus; adminNote: string | null; pinned: boolean; createdAt: string;
}
interface Pagination { page: number; pages: number; total: number; }

const STATUS_OPTIONS: { value: RequestStatus; label: string; color: string }[] = [
  { value: "pending",     label: "Pending",     color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  { value: "approved",    label: "Approved",    color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "coming_soon", label: "Coming Soon", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { value: "added",       label: "Added ✓",     color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "rejected",    label: "Rejected",    color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { value: "unavailable", label: "Unavailable", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
];

function relTime(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function RequestRow({ request, onUpdate, onDelete }: {
  request: MovieRequest;
  onUpdate: (id: string, updates: Partial<MovieRequest>) => void;
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminNote, setAdminNote] = useState(request.adminNote ?? "");
  const [noteOpen, setNoteOpen] = useState(false);
  const statusInfo = STATUS_OPTIONS.find((s) => s.value === request.status) ?? STATUS_OPTIONS[0];

  const updateRequest = async (updates: Partial<{ status: RequestStatus; adminNote: string; pinned: boolean }>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${request._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate(request._id, data);
      toast({ title: "Request updated" });
    } catch (err: any) {
      toast({ title: err.message ?? "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete request for "${request.title}"?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/requests/${request._id}`, { method: "DELETE" });
    if (res.ok) { onDelete(request._id); toast({ title: "Request deleted" }); }
    setDeleting(false);
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition ${request.pinned ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex gap-4">
        {/* Poster */}
        <div className="w-14 h-20 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
          {request.posterUrl ? (
            <img src={request.posterUrl} alt={request.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {request.category === "movie" ? <Film size={18} /> : <Tv size={18} />}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {request.pinned && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">📌 Pinned</Badge>}
                <Badge variant="outline" className="text-[10px]">{request.category === "movie" ? "Movie" : "TV Series"}</Badge>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
              <h3 className="font-bold text-foreground leading-tight">{request.title}</h3>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span>{request.username} · {relTime(request.createdAt)}</span>
                <span className="flex items-center gap-1"><ChevronUp size={11} /> {request.voteCount} votes</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => updateRequest({ pinned: !request.pinned })}
                disabled={saving} className="h-7 text-xs gap-1">
                <Pin size={11} /> {request.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="h-7 text-xs gap-1">
                {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Delete
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{request.reason}</p>

          {/* Status changer */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={request.status} onValueChange={(v) => updateRequest({ status: v as RequestStatus, adminNote: adminNote || null as any })}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button onClick={() => setNoteOpen((o) => !o)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition">
              <Sparkles size={11} />
              {request.adminNote ? "Edit note" : "Add note"}
            </button>

            {saving && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
          </div>

          {request.adminNote && !noteOpen && (
            <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded px-2 py-1.5">
              <span className="font-medium text-foreground">Note:</span> {request.adminNote}
            </p>
          )}

          {noteOpen && (
            <div className="mt-3 space-y-2">
              <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add a note visible to the requester (e.g. 'We're working on it!')..."
                rows={2} className="text-xs resize-none" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { updateRequest({ adminNote: adminNote || null as any }); setNoteOpen(false); }}
                  disabled={saving} className="h-7 text-xs">Save Note</Button>
                <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)} className="h-7 text-xs">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminRequests() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [requests, setRequests] = useState<MovieRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async (status: string, page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/requests?status=${status}&page=${page}`);
      const data = await res.json();
      setRequests(data.requests ?? []);
      setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
    } catch { toast({ title: "Failed to load requests", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchRequests(statusFilter, 1); }, [statusFilter, fetchRequests]);

  const handleUpdate = (id: string, updates: Partial<MovieRequest>) => {
    setRequests((prev) => prev.map((r) => r._id === id ? { ...r, ...updates } : r));
  };
  const handleDelete = (id: string) => setRequests((prev) => prev.filter((r) => r._id !== id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Movie Requests</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{pagination.total} total requests</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={28} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-border rounded-xl">
          <Film size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestRow key={r._id} request={r} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => fetchRequests(statusFilter, pagination.page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages}
              onClick={() => fetchRequests(statusFilter, pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
