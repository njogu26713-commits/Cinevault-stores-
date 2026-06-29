import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Film, PlayCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useListMovies,
  useListFeaturedMovies,
  useListGenres,
  useGetMovieStats,
  getListMoviesQueryKey
} from "@workspace/api-client-react";
import { Layout } from "../components/layout";
import { MovieCard } from "../components/movie-card";

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [heroIndex, setHeroIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

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

  // Auto-advance every 6 seconds
  useEffect(() => {
    if (!total) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, total]);

  const heroMovie = featuredMovies?.[heroIndex];

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  return (
    <Layout>
      {/* Hero Slider */}
      <section className="relative w-full aspect-[21/9] min-h-[500px] max-h-[800px] bg-slate-900 overflow-hidden">
        {loadingFeatured ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-white/40" size={32} />
          </div>
        ) : heroMovie ? (
          <>
            {/* Sliding panels */}
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={heroIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0"
              >
                {/* Background image */}
                <div className="absolute inset-0 select-none">
                  <img
                    src={heroMovie.bannerUrl || heroMovie.posterUrl}
                    alt={heroMovie.title}
                    className="w-full h-full object-cover object-top opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/20 to-transparent" />
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex items-center">
                  <div className="container mx-auto px-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
                      className="max-w-2xl"
                    >
                      <div className="flex gap-2 mb-4">
                        <span className="px-2 py-0.5 rounded bg-primary/30 text-white text-xs font-bold uppercase border border-primary/40">Featured</span>
                        <span className="px-2 py-0.5 rounded bg-white/15 text-white/90 text-xs font-bold uppercase">{heroMovie.quality}</span>
                      </div>
                      <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-4 drop-shadow-2xl">
                        {heroMovie.title}
                      </h1>
                      <p className="text-lg text-white/75 mb-8 line-clamp-3 leading-relaxed max-w-xl">
                        {heroMovie.description}
                      </p>
                      <div className="flex items-center gap-4">
                        <Link
                          href={`/movie/${heroMovie.id}`}
                          className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/25"
                        >
                          <PlayCircle size={20} />
                          View Details
                        </Link>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Prev / Next arrows */}
            {total > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* Dot indicators */}
            {total > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                {featuredMovies!.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i, i > heroIndex ? 1 : -1)}
                    className={`rounded-full transition-all duration-300 ${
                      i === heroIndex
                        ? "w-7 h-2.5 bg-white"
                        : "w-2.5 h-2.5 bg-white/40 hover:bg-white/70"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-12 -mt-8 relative z-10">

        {/* Stats & Genres */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Explore the Vault</h2>
            {stats && (
              <p className="text-sm text-muted-foreground">
                {stats.total} premium films available for instant download
              </p>
            )}
          </div>

          {/* Genre Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <button
              onClick={() => setSelectedGenre(undefined)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                !selectedGenre
                  ? "bg-primary text-white border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
              }`}
            >
              All Movies
            </button>
            {genres?.map(genre => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-2 ${
                  selectedGenre === genre
                    ? "bg-primary text-white border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                }`}
              >
                {genre}
                {stats?.byGenre[genre] && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedGenre === genre ? "bg-white/20" : "bg-muted"}`}>
                    {stats.byGenre[genre]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Movie Grid */}
        {loadingMovies ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {moviesRes?.movies.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
            {moviesRes?.movies.length === 0 && (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                <Film size={48} className="mx-auto mb-4 opacity-20" />
                <p>No movies found for this selection.</p>
              </div>
            )}
          </div>
        )}

      </section>
    </Layout>
  );
}
