import { useState } from "react";
import { Link } from "wouter";
import {
  useListSeries,
  useDeleteSeries,
  getListSeriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

const statusColors: Record<string, string> = {
  Ongoing: "bg-green-500/15 text-green-400 border-green-500/30",
  Completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function SeriesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [quality, setQuality] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const params = {
    ...(search && { search }),
    ...(quality !== "all" && { quality }),
    ...(status !== "all" && { status }),
    page,
    limit: 20,
  };

  const { data, isLoading } = useListSeries(params, {
    query: { queryKey: getListSeriesQueryKey(params) },
  });

  const deleteSeries = useDeleteSeries();

  const handleDelete = () => {
    if (!deleteId) return;
    deleteSeries.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Series deleted" });
          queryClient.invalidateQueries({ queryKey: getListSeriesQueryKey() });
          setDeleteId(null);
        },
        onError: () => {
          toast({ title: "Failed to delete series", variant: "destructive" });
          setDeleteId(null);
        },
      }
    );
  };

  const series = data?.series ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.total ?? 0} series in catalog
          </p>
        </div>
        <Link href="/series/add">
          <Button data-testid="add-series-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Series
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search series..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
          data-testid="series-search"
        />
        <Select value={quality} onValueChange={(v) => { setQuality(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Quality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quality</SelectItem>
            <SelectItem value="720p">720p</SelectItem>
            <SelectItem value="1080p">1080p</SelectItem>
            <SelectItem value="4K">4K</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Ongoing">Ongoing</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-card hover:bg-card">
              <TableHead>Title</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Seasons</TableHead>
              <TableHead>Price/Season</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : series.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No series found. Add your first series to get started.
                    </TableCell>
                  </TableRow>
                )
              : series.map((s) => (
                  <TableRow key={s.id} className="hover:bg-card/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {s.posterUrl && (
                          <img
                            src={s.posterUrl}
                            alt={s.title}
                            className="w-8 h-12 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm">{s.title}</span>
                            {s.featured && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          {s.rating && (
                            <span className="text-xs text-muted-foreground">{s.rating}/10</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.genre?.slice(0, 2).map((g) => (
                          <Badge key={g} variant="secondary" className="text-xs">
                            {g}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.year}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{s.quality}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusColors[s.status ?? "Ongoing"] ?? ""}`}>
                        {s.status ?? "Ongoing"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.seasons?.length ?? 0} season{(s.seasons?.length ?? 0) !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="font-medium">
                      KES {s.pricePerSeason?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/series/${s.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`edit-series-${s.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(s.id)}
                          data-testid={`delete-series-${s.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this series?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The series will be permanently removed from your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
