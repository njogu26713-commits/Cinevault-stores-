import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Bell, BellOff, Users, Film, Tv, Clock } from "lucide-react";
import { Layout } from "@/components/layout";

interface NotificationRow {
  id: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string;
  pendingCount: number;
  notifiedCount: number;
  subscribers: {
    telegramUsername: string;
    notifiedAt: string | null;
    createdAt: string;
  }[];
}

async function fetchNotifications(): Promise<NotificationRow[]> {
  const res = await fetch("/api/admin/movie-notifications", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

export function MovieNotifications() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "series">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "movie-notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  const filtered = (data ?? []).filter((row) => {
    const matchesSearch = row.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || row.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalPending = (data ?? []).reduce((s, r) => s + r.pendingCount, 0);
  const totalNotified = (data ?? []).reduce((s, r) => s + r.notifiedCount, 0);
  const movieCount = (data ?? []).filter((r) => r.type === "movie").length;
  const seriesCount = (data ?? []).filter((r) => r.type === "series").length;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notify Me Subscribers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Users who want to be pinged when a Coming Soon movie or series drops.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Film className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Movies</p>
              <p className="text-xl font-bold">{data ? movieCount : "—"}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Tv className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Series</p>
              <p className="text-xl font-bold">{data ? seriesCount : "—"}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Waiting</p>
              <p className="text-xl font-bold">{data ? totalPending : "—"}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <BellOff className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Notified</p>
              <p className="text-xl font-bold">{data ? totalNotified : "—"}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {(["all", "movie", "series"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize ${
                  typeFilter === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "All" : t === "movie" ? "🎬 Movies" : "📺 Series"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load subscribers. Check API connectivity.
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
            <Users className="h-10 w-10 opacity-20" />
            <p className="font-medium">No subscribers yet</p>
            <p className="text-xs">Users who tap "Notify Me" on Coming Soon cards will appear here.</p>
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[340px]">Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Waiting</TableHead>
                  <TableHead className="text-center">Notified</TableHead>
                  <TableHead className="text-right">Subscribers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <>
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={row.posterUrl}
                            alt={row.title}
                            className="w-8 h-12 object-cover rounded"
                          />
                          <div>
                            <p className="font-semibold text-sm leading-tight">{row.title}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-purple-400" />
                              <span className="text-[11px] text-purple-400 font-medium">Coming Soon</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.type === "movie" ? (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] gap-1">
                            <Film className="h-3 w-3" /> Movie
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] gap-1">
                            <Tv className="h-3 w-3" /> Series
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold">
                          {row.pendingCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 font-bold">
                          {row.notifiedCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs text-muted-foreground underline decoration-dashed cursor-pointer">
                          {expandedId === row.id ? "▲ hide" : "▼ view all"}
                        </span>
                      </TableCell>
                    </TableRow>

                    {expandedId === row.id && (
                      <TableRow key={`${row.id}-expanded`}>
                        <TableCell colSpan={5} className="bg-muted/30 p-0">
                          <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                              All subscribers · {row.subscribers.length} total
                            </p>
                            <div className="rounded-lg border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/40">
                                  <tr>
                                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Telegram</th>
                                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Subscribed</th>
                                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.subscribers.map((sub, idx) => (
                                    <tr key={idx} className="border-t border-border/50">
                                      <td className="px-4 py-2.5 font-mono text-xs text-blue-400">
                                        @{sub.telegramUsername}
                                      </td>
                                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                        {formatDate(sub.createdAt)}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        {sub.notifiedAt ? (
                                          <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                                            ✓ Notified {formatDate(sub.notifiedAt)}
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                                            ⏳ Waiting
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
