import { useParams } from "wouter";
import { useState } from "react";
import { useGetSeries, getGetSeriesQueryKey } from "@workspace/api-client-react";
import { Layout } from "../components/layout";
import { StatusBadge } from "../components/series-card";
import { SeriesCheckoutModal } from "../components/series-checkout-modal";
import { formatKes } from "../lib/utils";
import { Loader2, Star, Calendar, Tv, ChevronDown, ChevronUp, Play, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Season } from "@workspace/api-client-react/src/generated/api.schemas";

function SeasonAccordion({ season, pricePerSeason }: { season: Season; pricePerSeason: number }) {
  const [open, setOpen] = useState(season.seasonNumber === 1);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={`season-${season.seasonNumber}-episodes`}
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
            {season.seasonNumber}
          </div>
          <div>
            <p className="font-bold text-foreground">Season {season.seasonNumber}</p>
            <p className="text-xs text-muted-foreground">{season.episodes.length} episodes</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold text-primary text-sm hidden sm:block">{formatKes(pricePerSeason)}</span>
          {open
            ? <ChevronUp size={18} className="text-muted-foreground" aria-hidden />
            : <ChevronDown size={18} className="text-muted-foreground" aria-hidden />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`season-${season.seasonNumber}-episodes`}
            key="episodes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border">
              {season.episodes.map(ep => (
                <div
                  key={ep.episodeNumber}
                  className="flex items-center gap-4 px-5 py-3 bg-background hover:bg-muted/30 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Play size={12} className="fill-current" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      E{ep.episodeNumber}. {ep.title}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{ep.duration}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: series, isLoading, isError } = useGetSeries(id!, {
    query: { enabled: !!id, queryKey: getGetSeriesQueryKey(id!) }
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <AlertCircle className="text-destructive mb-3" size={40} />
          <h2 className="text-xl font-bold text-foreground mb-2">Failed to load series</h2>
          <p className="text-muted-foreground">The series could not be found or there was a server error.</p>
        </div>
      </Layout>
    );
  }

  if (!series) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Tv className="text-muted-foreground mb-3" size={40} />
          <h2 className="text-xl font-bold text-foreground mb-2">Series not found</h2>
          <p className="text-muted-foreground">This series does not exist in the vault.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full relative">
        {/* Banner */}
        <div className="absolute inset-0 h-[60vh] overflow-hidden select-none -z-10">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[80px] z-10" />
          <img
            src={series.bannerUrl || series.posterUrl}
            className="w-full h-full object-cover opacity-60"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent z-10" />
        </div>

        <div className="container mx-auto px-4 pt-12 pb-24">
          <div className="flex flex-col md:flex-row gap-8 lg:gap-16">

            {/* Left: Poster + Purchase card */}
            <div className="w-full md:w-[280px] lg:w-[340px] shrink-0">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-24">
                <div className="rounded-2xl overflow-hidden border border-border shadow-2xl aspect-[2/3] mb-6">
                  <img src={series.posterUrl} alt={series.title} className="w-full h-full object-cover" />
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Per Season</span>
                    <span className="text-3xl font-black text-foreground">{formatKes(series.pricePerSeason)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-5">
                    {series.totalSeasons} season{series.totalSeasons !== 1 ? "s" : ""} · {series.totalEpisodes} episodes total
                  </p>
                  <button
                    onClick={() => setCheckoutOpen(true)}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
                  >
                    Buy a Season
                  </button>
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    Instantly delivered to Telegram
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Right: Info + Seasons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex-1 pt-4 md:pt-12"
            >
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <StatusBadge status={series.status} className="px-3 py-1 text-xs" />
                <span className="px-3 py-1 rounded bg-muted border border-border text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  {series.quality}
                </span>
                {series.genre.map(g => (
                  <span key={g} className="px-3 py-1 rounded bg-muted border border-border text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="text-4xl md:text-6xl font-black text-foreground leading-tight mb-4">
                {series.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-8 font-medium">
                {series.rating && (
                  <div className="flex items-center gap-1.5 text-amber-500">
                    <Star size={18} className="fill-current" aria-hidden />
                    <span className="text-base">{series.rating.toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} aria-hidden />
                  {series.year}
                </div>
                <div className="flex items-center gap-1.5">
                  <Tv size={16} aria-hidden />
                  {series.totalSeasons} Seasons · {series.totalEpisodes} Episodes
                </div>
              </div>

              <p className="text-muted-foreground text-lg leading-relaxed mb-10">
                {series.description}
              </p>

              {/* YouTube Trailer */}
              {series.youtubeTrailerId && (
                <div className="mb-12">
                  <h3 className="text-xl font-bold text-foreground mb-5">Official Trailer</h3>
                  <div className="relative rounded-2xl overflow-hidden aspect-video border border-border shadow-lg bg-slate-900">
                    <iframe
                      title={`${series.title} — Official Trailer`}
                      src={`https://www.youtube.com/embed/${series.youtubeTrailerId}?autoplay=0&rel=0&modestbranding=1`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Season accordion */}
              <div>
                <h3 className="text-xl font-bold text-foreground mb-4">Episodes</h3>
                <div className="space-y-3">
                  {series.seasons.map(season => (
                    <SeasonAccordion
                      key={season.seasonNumber}
                      season={season}
                      pricePerSeason={series.pricePerSeason}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <SeriesCheckoutModal
        series={series}
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </Layout>
  );
}
