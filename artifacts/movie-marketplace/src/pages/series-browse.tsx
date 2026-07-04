import { useState } from "react";
import { Tv, Loader2, AlertCircle } from "lucide-react";
import { useListSeries, useListSeriesGenres, getListSeriesQueryKey } from "../hooks/use-static-api";
import { Layout } from "../components/layout";
import { SeriesCard } from "../components/series-card";

export default function SeriesBrowse() {
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();

  const { data: genres, isError: genresError } = useListSeriesGenres();
  const { data: seriesRes, isLoading, isError } = useListSeries(
    { genre: selectedGenre, status: selectedStatus },
    { query: { queryKey: getListSeriesQueryKey({ genre: selectedGenre, status: selectedStatus }) } }
  );

  return (
    <Layout>
      <div className="container mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground mb-1">TV Series</h1>
            <p className="text-muted-foreground text-sm">
              {seriesRes?.total ?? 0} series available for season purchase
            </p>
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-2">
            {(["Ongoing", "Completed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSelectedStatus(selectedStatus === s ? undefined : s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedStatus === s
                    ? s === "Ongoing"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-primary text-white border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Genre pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-8 -mx-4 px-4 md:mx-0 md:px-0">
          <button
            onClick={() => setSelectedGenre(undefined)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              !selectedGenre
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
            }`}
          >
            All Genres
          </button>
          {!genresError && genres?.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                selectedGenre === genre
                  ? "bg-primary text-white border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* States */}
        {isLoading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="text-destructive mb-3" size={36} />
            <p className="font-semibold text-foreground mb-1">Failed to load series</p>
            <p className="text-sm text-muted-foreground">Check your connection and try refreshing the page.</p>
          </div>
        )}

        {!isLoading && !isError && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {seriesRes?.series.map((s, i) => (
              <SeriesCard key={s.id} series={s} index={i} />
            ))}
            {seriesRes?.series.length === 0 && (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                <Tv size={48} className="mx-auto mb-4 opacity-20" />
                <p>No series found for this selection.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
