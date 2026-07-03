import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film, PlayCircle, Loader2, ChevronLeft, ChevronRight,
  Star, Clock, Download, Sparkles
} from "lucide-react";
import {
  useListMovies,
  useListFeaturedMovies,
  useListGenres,
  useGetMovieStats,
  getListMoviesQueryKey
} from "@workspace/api-client-react";
import { Layout } from "../components/layout";
import { MovieCard } from "../components/movie-card";
import { formatKes } from "../lib/utils";

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [heroIndex, setHeroIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const { data: featuredMovies, isLoading: loadingFeatured } = useListFeaturedMovies();
  const { data: genres } = useListGenres();
  const { data: stats } = useGetMovieStats();

  const { data: moviesRes, isLoading: loadingMovies } = useListMovies(
    { genre: selectedGenre },
    { query: { queryKey: getListMoviesQueryKey({ genre: selectedGenre }) } }
  );

  const total = featuredMovies?.length ?? 0;

  const goTo = useCallback((index: number, dir: number) => {
    setDirection(dir);
    setHeroIndex(index);
  }, []);

  const prev = useCallback(() => {
    if (!total) return;
    goTo((heroIndex - 1 + total) % total, -1);
  }, [heroIndex, total, goTo]);

  const next = useCallback(() => {
    if (!total) return;
    goTo((heroIndex + 1) % total, 1);
  }, [heroIndex, total, goTo]);

  useEffect(() => {
    if (!total) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, total]);

  const heroMovie = featuredMovies?.[heroIndex];

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative w-full aspect-[21/9] min-h-[480px] max-h-[780px] bg-slate-100 overflow-hidden">
        {loadingFeatured ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary/40" size={36} />
          </div>
        ) : heroMovie ? (
          <>
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={heroIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.65, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0"
              >
                {/* Background */}
                <div className="absolute inset-0 select-none">
                  <img
                    src={heroMovie.bannerUrl || heroMovie.posterUrl}
                    alt={heroMovie.title}
                    className="w-full h-full object-cover object-top"
                  />
                  {/* Gradient scrim — bottom heavy so text pops on white bg below */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/10 to-transparent" />
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex items-end pb-14">
                  <div className="max-w-[1600px] w-full mx-auto px-8">
                    <motion.div
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                      className="max-w-2xl"
                    >
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold shadow-lg shadow-primary/30">
                          <Sparkles size={11} />
                          Featured
                        </span>
                        <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-sm border border-white/25">
                          {heroMovie.quality}
                        </span>
                        {heroMovie.rating && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/90 text-amber-900 text-xs font-bold">
                            <Star size={11} className="fill-amber-900" />
                            {heroMovie.rating.toFixed(1)}
                          </span>
                        )}
                        {heroMovie.genre?.slice(0, 2).map(g => (
                          <span key={g} className="px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-medium backdrop-blur-sm border border-white/15">
                            {g}
                          </span>
                        ))}
                      </div>

                      <h1 className="text-5xl md:text-[3.75rem] font-black text-white leading-tight mb-4 drop-shadow-2xl tracking-tight">
                        {heroMovie.title}
                      </h1>

                      <p className="text-base text-white/75 mb-7 line-clamp-2 leading-relaxed max-w-lg">
                        {heroMovie.description}
                      </p>

                      <div className="flex items-center gap-3">
                        <Link
                          href={`/movie/${heroMovie.id}`}
                          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-7 rounded-full shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-all hover:scale-105 active:scale-95"
                        >
                          <PlayCircle size={18} />
                          View Details
                        </Link>
                        <span className="text-white/60 font-mono text-sm font-semibold bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3 rounded-full">
                          {formatKes(heroMovie.price)}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Arrows */}
            {total > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center backdrop-blur-md border border-white/25 transition-all hover:scale-110"
                  aria-label="Previous"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={next}
                  className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center backdrop-blur-md border border-white/25 transition-all hover:scale-110"
                  aria-label="Next"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Dot indicators + progress */}
            {total > 1 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                {featuredMovies!.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i, i > heroIndex ? 1 : -1)}
                    className={`rounded-full transition-all duration-300 ${
                      i === heroIndex
                        ? "w-8 h-2 bg-primary shadow-md shadow-primary/40"
                        : "w-2 h-2 bg-white/40 hover:bg-white/70"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* ── Stats ribbon ── */}
      {stats && (
        <div className="bg-white border-b border-border">
          <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Film size={15} className="text-primary" />
              <span className="text-primary font-black">{stats.total}</span> films
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Download size={15} className="text-primary" />
              Instant download
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock size={15} className="text-primary" />
              Via Telegram
            </div>
            <div className="ml-auto text-xs text-muted-foreground font-medium">
              {Object.keys(stats.byGenre).length} genres available
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <section className="max-w-[1600px] mx-auto w-full px-8 py-10">

        {/* Section header + Genre pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Explore the Vault</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedGenre ? `Browsing ${selectedGenre}` : "All premium films"} — click a poster to buy
            </p>
          </div>

          {/* Genre pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedGenre(undefined)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                !selectedGenre
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              }`}
            >
              All
            </button>
            {genres?.map(genre => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all border flex items-center gap-2 ${
                  selectedGenre === genre
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                    : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                }`}
              >
                {genre}
                {stats?.byGenre[genre] && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    selectedGenre === genre ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {stats.byGenre[genre]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Movie grid */}
        {loadingMovies ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-primary" size={36} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 md:gap-6">
            {moviesRes?.movies.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
            {moviesRes?.movies.length === 0 && (
              <div className="col-span-full py-24 text-center text-muted-foreground">
                <Film size={48} className="mx-auto mb-4 opacity-15" />
                <p className="font-semibold">No films found in this genre.</p>
                <button onClick={() => setSelectedGenre(undefined)} className="mt-3 text-sm text-primary hover:underline">
                  Clear filter
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </Layout>
  );
}
