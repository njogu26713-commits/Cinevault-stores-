import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Bell, BellOff, Users, Film, Clock } from "lucide-react";
import { Layout } from "@/components/layout";

interface NotificationRow {
  movieId: string;
  movieTitle: string;
  posterUrl: string;
  pendingCount: number;
  notifiedCount: number;
  subscribers: {
    telegramUsername: string;
    notifiedAt: string | null;
    createdAt: string;
  }[];
}

async function fetchMovieNotifications(): Promise<NotificationRow[]> {
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
  const [expandedMovie, setExpandedMovie] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "movie-notifications"],
    queryFn: fetchMovieNotifications,
    refetchInterval: 30_000,
  });

  const filtered = (data ?? []).filter((row) =>
    row.movieTitle.toLowerCase().includes(search.toLowerCase())
  );

  const totalPending = (data ?? []).reduce((s, r) => s + r.pendingCount, 0);
  const totalNotified = (data ?? []).reduce((s, r) => s + r.notifiedCount, 0);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notify Me Subscribers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Users who want to be pinged when a Coming Soon movie drops.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Film className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Movies with waitlist</p>
              <p className="text-xl font-bold">{data?.length ?? "—"}</p>
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
              <p className="text-xs text-muted-foreground">Already notified</p>
              <p className="text-xl font-bold">{data ? totalNotified : "—"}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search movie title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
                  <TableHead className="w-[320px]">Movie</TableHead>
                  <TableHead className="text-center">Waiting</TableHead>
                  <TableHead className="text-center">Notified</TableHead>
                  <TableHead className="text-right">Subscribers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <>
                    <TableRow
                      key={row.movieId}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedMovie(expandedMovie === row.movieId ? null : row.movieId)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={row.posterUrl}
                            alt={row.movieTitle}
                            className="w-8 h-12 object-cover rounded"
                          />
                          <div>
                            <p className="font-semibold text-sm leading-tight">{row.movieTitle}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-purple-400" />
                              <span className="text-[11px] text-purple-400 font-medium">Coming Soon</span>
                            </div>
                          </div>
                        </div>
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
                          {expandedMovie === row.movieId ? "▲ hide" : "▼ view all"}
                        </span>
                      </TableCell>
                    </TableRow>

                    {expandedMovie === row.movieId && (
                      <TableRow key={`${row.movieId}-expanded`}>
                        <TableCell colSpan={4} className="bg-muted/30 p-0">
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
