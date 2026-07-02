import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListMovies, useDeleteMovie, getListMoviesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Search, Edit2, Trash2, Film, Star, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SyncResult {
  matched: Array<{ type: string; title: string; fileId: string; episodeInfo?: string }>;
  unmatched: Array<{ fileName: string; caption: string; fileId: string }>;
  bufferCount: number;
}

export function Movies() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [quality, setQuality] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useListMovies({
    search: debouncedSearch || undefined,
    quality: quality !== "all" ? quality : undefined,
    page,
    limit: 10,
  });

  const deleteMovie = useDeleteMovie();

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMovie.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Movie deleted" });
          queryClient.invalidateQueries({ queryKey: getListMoviesQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to delete movie", variant: "destructive" });
        }
      });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/telegram/sync", { method: "POST" });
      const data: SyncResult = await res.json();
      if (!res.ok) {
        toast({ title: (data as any).error || "Sync failed", variant: "destructive" });
        return;
      }
      setSyncResult(data);
      setSyncOpen(true);
      if (data.matched.length > 0) {
        queryClient.invalidateQueries({ queryKey: getListMoviesQueryKey() });
      }
    } catch {
      toast({ title: "Sync failed — network error", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const formatMoney = (amount: number) => `KES ${amount.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Movies</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync Telegram
          </Button>
          <Link href="/movies/add">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Movie
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search movies..."
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={quality} onValueChange={setQuality}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Quality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Qualities</SelectItem>
            <SelectItem value="720p">720p</SelectItem>
            <SelectItem value="1080p">1080p</SelectItem>
            <SelectItem value="4K">4K</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Movie</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-12 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data?.movies.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No movies found.
                </TableCell>
              </TableRow>
            ) : (
              data.movies.map((movie) => (
                <TableRow key={movie.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-muted">
                        {movie.posterUrl ? (
                          <img src={movie.posterUrl} alt={movie.title} className="h-full w-full object-cover" />
                        ) : (
                          <Film className="h-full w-full p-2 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {movie.title}
                          {movie.featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{movie.duration} • {movie.fileSize}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{movie.quality}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {movie.genre.slice(0, 2).map(g => (
                        <Badge key={g} variant="secondary" className="text-[10px] px-1 py-0">{g}</Badge>
                      ))}
                      {movie.genre.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">+{movie.genre.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{movie.year}</TableCell>
                  <TableCell className="font-medium">{formatMoney(movie.price)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/movies/${movie.id}/edit`}>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(movie.id, movie.title)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <div className="flex items-center text-sm">Page {page} of {data.totalPages}</div>
          <Button variant="outline" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Sync Results Dialog */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Telegram Sync Results</DialogTitle>
            <DialogDescription>
              {syncResult?.bufferCount === 0
                ? "No files found in the channel buffer yet."
                : `Processed ${syncResult?.bufferCount ?? 0} file(s) from the channel.`}
            </DialogDescription>
          </DialogHeader>

          {syncResult?.bufferCount === 0 && (
            <div className="rounded-md bg-muted/50 border p-4 text-sm space-y-2">
              <p className="font-medium">Buffer is empty — here's why:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Make sure your bot is an <strong>admin</strong> of the channel</li>
                <li>Upload or re-send a file to the channel <strong>after</strong> the server started</li>
                <li>Click <strong>Sync Telegram</strong> again</li>
              </ol>
            </div>
          )}

          {syncResult && syncResult.matched.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-500 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Auto-linked ({syncResult.matched.length})
              </p>
              <div className="space-y-1">
                {syncResult.matched.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="font-medium">{m.title}</span>
                    {m.episodeInfo && <span className="text-muted-foreground text-xs">{m.episodeInfo}</span>}
                    <Badge variant="outline" className="ml-auto text-[10px]">{m.type}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {syncResult && syncResult.unmatched.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-yellow-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                No match found ({syncResult.unmatched.length}) — paste File ID manually
              </p>
              <div className="space-y-1">
                {syncResult.unmatched.map((u, i) => (
                  <div key={i} className="p-2 rounded bg-muted/50 border text-sm space-y-0.5">
                    <p className="font-mono text-xs text-muted-foreground truncate">{u.fileId}</p>
                    <p className="text-xs">{u.caption || u.fileName}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: include the movie title in the file's caption when uploading to the channel so it can be matched automatically.
              </p>
            </div>
          )}

          {syncResult && syncResult.matched.length === 0 && syncResult.bufferCount > 0 && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-muted-foreground">
              Files were found but no movie/series titles matched their captions or filenames. Make sure the file caption contains the movie title (e.g. "Inception") when uploading to the channel.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
