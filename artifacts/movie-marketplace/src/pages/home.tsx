import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Film, PlayCircle, Loader2, ChevronLeft, ChevronRight,
  Star, Download, Sparkles, Search, X, Flame, Clock3, Clock,
  Bell, BellOff, Check, Send,
} from "lucide-react";
import {
  useListMovies,
  useListFeaturedMovies,
  useListGenres,
  useGetMovieStats,
  useListComingSoonMovies,
  getListMoviesQueryKey,
  type Movie,
} from "@workspace/api-client-react";
import { Layout } from "../components/layout";
import { MovieCard } from "../components/movie-card";
import { formatKes } from "../lib/utils";

// ── Horizontal scrollable row ──────────────────────────────────────────────────

function MovieRow({
  title,
  icon,
  movies,
  startIndex = 0,
}: {
  title: string;
  icon?: React.ReactNode;
  movies: Movie[];
  startIndex?: number;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-80px" });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll, movies]);

  const scroll = (dir: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 600 : -600, behavior: "smooth" });
  };

  if (!movies.length) return null;

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10"
    >
      {/* Row header */}
      <div className="flex items-center justify-between px-8 mb-4">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-primary">{icon}</span>}
          <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
          <span className="text-xs text-white/25 font-medium mt-0.5">{movies.length} titles</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll("left")}
            disabled={!canLeft}
            className="w-8 h-8 rounded-full border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 hover:bg-white/8 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canRight}
            className="w-8 h-8 rounded-full border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 hover:bg-white/8 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable track */}
      <div className="relative">
        {/* Left fade */}
        <div className={`absolute left-0 top-0 bottom-6 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-200 ${canLeft ? "opacity-100" : "opacity-0"}`} />
        {/* Right fade */}
        <div className={`absolute right-0 top-0 bottom-6 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-200 ${canRight ? "opacity-100" : "opacity-0"}`} />

        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-8 pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {movies.map((movie, i) => (
            <div key={movie.id} className="w-[160px] sm:w-[180px] md:w-[200px]" style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
              <MovieCard movie={movie} index={startIndex + i} />
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Coming Soon card ──────────────────────────────────────────────────────────

type NotifyState = "idle" | "open" | "loading" | "success" | "already";

function ComingSoonCard({ movie, index = 0 }: { movie: Movie; index?: number }) {
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const openForm = () => {
    setNotifyState("open");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const closeForm = () => {
    setNotifyState("idle");
    setUsername("");
    setError("");
  };

  const submit = async () => {
    const clean = username.replace(/^@/, "").trim();
    if (!clean) { setError("Enter your Telegram username"); return; }
    setNotifyState("loading");
    setError("");
    try {
      const res = await fetch(`/api/movies/${movie.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUsername: clean }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json() as { ok: boolean; alreadySubscribed: boolean };
      setNotifyState(data.alreadySubscribed ? "already" : "success");
    } catch {
      setNotifyState("open");
      setError("Something went wrong. Try again.");
    }
  };

  const done = notifyState === "success" || notifyState === "already";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex-shrink-0"
    >
      <div className="block">
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-lg">
          {/* Blurred/dimmed poster */}
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover scale-105 blur-[2px] brightness-40"
            loading="lazy"
          />

          {/* Coming soon overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
            <div className="flex items-center gap-1.5 bg-purple-500/25 border border-purple-500/50 text-purple-300 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Clock size={11} />
              COMING SOON
            </div>
            <span className="text-white/50 text-xs font-medium">{movie.year}</span>
          </div>

          {/* Quality badge */}
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider bg-purple-500/20 text-purple-400 border-purple-500/30">
              {movie.quality}
            </span>
          </div>
        </div>

        <div className="mt-2.5 px-0.5">
          <h3 className="font-bold text-white/60 text-sm leading-snug line-clamp-1">
            {movie.title}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-white/30">{movie.genre[0]}</span>
          </div>

          {/* Notify Me section */}
          <div className="mt-2">
            <AnimatePresence mode="wait">
              {notifyState === "idle" && (
                <motion.button
                  key="bell-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={openForm}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold hover:bg-purple-500/20 hover:border-purple-500/50 transition-all"
                >
                  <Bell size={11} />
                  Notify Me
                </motion.button>
              )}

              {(notifyState === "open" || notifyState === "loading") && (
                <motion.div
                  key="notify-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-white/30 text-[11px] shrink-0">@</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                      placeholder="username"
                      disabled={notifyState === "loading"}
                      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white placeholder-white/20 outline-none focus:border-purple-500/50 focus:bg-white/8 transition-all disabled:opacity-50"
                    />
                    <button
                      onClick={submit}
                      disabled={notifyState === "loading"}
                      className="shrink-0 w-6 h-6 rounded-md bg-purple-600 hover:bg-purple-500 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      {notifyState === "loading"
                        ? <Loader2 size={10} className="animate-spin text-white" />
                        : <Send size={10} className="text-white" />}
                    </button>
                    <button
                      onClick={closeForm}
                      disabled={notifyState === "loading"}
                      className="shrink-0 w-6 h-6 rounded-md border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  {error && <p className="text-[10px] text-red-400 mt-1 leading-tight">{error}</p>}
                </motion.div>
              )}

              {done && (
                <motion.div
                  key="notify-done"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium ${
                    notifyState === "already"
                      ? "bg-white/5 border border-white/10 text-white/40"
                      : "bg-green-500/15 border border-green-500/30 text-green-400"
                  }`}
                >
                  {notifyState === "already"
                    ? <><BellOff size={11} /> Already subscribed</>
                    : <><Check size={11} /> You&apos;ll be notified!</>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Coming Soon row ───────────────────────────────────────────────────────────

function ComingSoonRow({ movies }: { movies: Movie[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-80px" });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll, movies]);

  const scroll = (dir: "left" | "right") => {
    rowRef.current?.scrollBy({ left: dir === "right" ? 600 : -600, behavior: "smooth" });
  };

  if (!movies.length) return null;

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10"
    >
      <div className="flex items-center justify-between px-8 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-purple-400"><Clock size={18} /></span>
          <h2 className="text-lg font-black text-white tracking-tight">Coming Soon</h2>
          <span className="text-xs text-white/25 font-medium mt-0.5">{movies.length} titles</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => scroll("left")} disabled={!canLeft} className="w-8 h-8 rounded-full border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 hover:bg-white/8 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scroll("right")} disabled={!canRight} className="w-8 h-8 rounded-full border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 hover:bg-white/8 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="relative">
        <div className={`absolute left-0 top-0 bottom-6 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-200 ${canLeft ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute right-0 top-0 bottom-6 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-200 ${canRight ? "opacity-100" : "opacity-0"}`} />
        <div ref={rowRef} className="flex gap-4 overflow-x-auto scrollbar-hide px-8 pb-2" style={{ scrollSnapType: "x mandatory" }}>
          {movies.map((movie, i) => (
            <div key={movie.id} className="w-[160px] sm:w-[180px] md:w-[200px]" style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
              <ComingSoonCard movie={movie} index={i} />
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: featuredMovies, isLoading: loadingFeatured } = useListFeaturedMovies();
  const { data: genres } = useListGenres();
  const { data: stats } = useGetMovieStats();
  const { data: comingSoonMovies } = useListComingSoonMovies();

  // Fetch all movies for row grouping
  const { data: allMoviesRes, isLoading: loadingAll } = useListMovies(
    {},
    { query: { queryKey: getListMoviesQueryKey({}) } }
  );

  // Filtered movies (when searching / genre selected)
  const { data: filteredRes, isLoading: loadingFiltered } = useListMovies(
    { genre: selectedGenre, search: debouncedSearch || undefined },
    {
      query: {
        queryKey: getListMoviesQueryKey({ genre: selectedGenre, search: debouncedSearch || undefined }),
        enabled: !!(selectedGenre || debouncedSearch),
      },
    }
  );

  const allMovies = allMoviesRes?.movies ?? [];
  const filteredMovies = filteredRes?.movies ?? [];

  // Group all movies by genre for rows
  const genreRows = (() => {
    const map: Record<string, Movie[]> = {};
    allMovies.forEach((m) => {
      m.genre?.forEach((g) => {
        if (!map[g]) map[g] = [];
        map[g].push(m);
      });
    });
    return Object.entries(map)
      .filter(([, ms]) => ms.length >= 2)
      .sort(([, a], [, b]) => b.length - a.length);
  })();

  // Recently added: sorted by MongoDB ObjectId (encodes creation time) — newest first
  const recentlyAdded = [...allMovies]
    .sort((a, b) => {
      // ObjectId first 4 bytes = unix timestamp — lexicographic desc gives newest first
      const tsA = a.id ? parseInt(a.id.slice(0, 8), 16) : 0;
      const tsB = b.id ? parseInt(b.id.slice(0, 8), 16) : 0;
      return tsB - tsA;
    })
    .slice(0, 20);

  const total = featuredMovies?.length ?? 0;

  const goTo = useCallback((index: number, dir: number) => {
    setDirection(dir);
    setHeroIndex(index);
  }, []);
  const prev = useCallback(() => { if (!total) return; goTo((heroIndex - 1 + total) % total, -1); }, [heroIndex, total, goTo]);
  const next = useCallback(() => { if (!total) return; goTo((heroIndex + 1) % total, 1); }, [heroIndex, total, goTo]);

  useEffect(() => {
    if (!total) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, total]);

  const heroMovie = featuredMovies?.[heroIndex];

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  const isFiltering = !!(selectedGenre || debouncedSearch);
  const isLoading = isFiltering ? loadingFiltered : loadingAll;

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative w-full aspect-[21/9] min-h-[500px] max-h-[820px] bg-black overflow-hidden">
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
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0"
              >
                <div className="absolute inset-0 select-none">
                  <img
                    src={heroMovie.bannerUrl || heroMovie.posterUrl}
                    alt={heroMovie.title}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/15 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
                </div>

                <div className="absolute inset-0 flex items-end pb-16">
                  <div className="max-w-[1600px] w-full mx-auto px-8">
                    <motion.div
                      initial={{ opacity: 0, y: 32 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="max-w-2xl"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold shadow-lg shadow-primary/30">
                          <Sparkles size={11} />
                          Featured
                        </span>
                        <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold backdrop-blur-sm border border-white/20">
                          {heroMovie.quality}
                        </span>
                        {heroMovie.rating && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                            <Star size={11} className="fill-amber-400" />
                            {heroMovie.rating.toFixed(1)}
                          </span>
                        )}
                        {heroMovie.genre?.slice(0, 2).map(g => (
                          <span key={g} className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium backdrop-blur-sm border border-white/12">
                            {g}
                          </span>
                        ))}
                      </div>

                      <h1 className="text-5xl md:text-[3.5rem] font-black text-white leading-tight mb-4 drop-shadow-2xl tracking-tight">
                        {heroMovie.title}
                      </h1>

                      <p className="text-base text-white/65 mb-8 line-clamp-2 leading-relaxed max-w-lg">
                        {heroMovie.description}
                      </p>

                      <div className="flex items-center gap-3">
                        <Link
                          href={`/movie/${heroMovie.id}`}
                          className="inline-flex items-center gap-2 bg-white text-black font-bold py-3 px-7 rounded-full shadow-xl hover:bg-white/90 transition-all hover:scale-105 active:scale-95"
                        >
                          <PlayCircle size={18} className="fill-black" />
                          View Details
                        </Link>
                        <span className="text-white/70 font-mono text-sm font-semibold bg-white/10 backdrop-blur-md border border-white/15 px-5 py-3 rounded-full">
                          {formatKes(heroMovie.price)}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {total > 1 && (
              <>
                <button onClick={prev} className="absolute left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-all hover:scale-110" aria-label="Previous">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={next} className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-all hover:scale-110" aria-label="Next">
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {total > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                {featuredMovies!.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i, i > heroIndex ? 1 : -1)}
                    className={`rounded-full transition-all duration-300 ${
                      i === heroIndex ? "w-8 h-2 bg-white shadow-md" : "w-2 h-2 bg-white/30 hover:bg-white/60"
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white/4 border-y border-white/6"
        >
          <div className="max-w-[1600px] mx-auto px-8 py-3.5 flex items-center gap-8 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/70 whitespace-nowrap">
              <Film size={14} className="text-primary" />
              <span className="text-primary font-black">{stats.total}</span> films
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white/70 whitespace-nowrap">
              <Download size={14} className="text-primary" />
              Instant download
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white/70 whitespace-nowrap">
              <Clock3 size={14} className="text-primary" />
              Via Telegram
            </div>
            <div className="ml-auto text-xs text-white/25 font-medium whitespace-nowrap">
              {Object.keys(stats.byGenre).length} genres
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Search + genre filter bar ── */}
      <div className="max-w-[1600px] mx-auto w-full px-8 pt-8 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex-1">
            {debouncedSearch
              ? `Results for "${debouncedSearch}"`
              : selectedGenre
              ? selectedGenre
              : "Explore the Vault"}
          </h2>

          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setSelectedGenre(undefined); }}
              placeholder="Search movies…"
              className="w-full pl-10 pr-9 py-2.5 rounded-full border border-white/12 bg-white/6 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Genre pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-2">
          <button
            onClick={() => { setSelectedGenre(undefined); setSearchQuery(""); }}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
              !selectedGenre && !debouncedSearch
                ? "bg-white text-black border-white shadow-lg"
                : "bg-white/6 text-white/50 border-white/10 hover:border-white/25 hover:text-white hover:bg-white/10"
            }`}
          >
            All
          </button>
          {genres?.map(genre => (
            <button
              key={genre}
              onClick={() => { setSelectedGenre(genre); setSearchQuery(""); }}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-all border flex items-center gap-2 ${
                selectedGenre === genre
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/25"
                  : "bg-white/6 text-white/50 border-white/10 hover:border-white/25 hover:text-white hover:bg-white/10"
              }`}
            >
              {genre}
              {stats?.byGenre[genre] && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  selectedGenre === genre ? "bg-white/20 text-white" : "bg-white/8 text-white/40"
                }`}>
                  {stats.byGenre[genre]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="animate-spin text-primary" size={36} />
        </div>
      ) : isFiltering ? (
        /* Filtered grid view */
        <section className="max-w-[1600px] mx-auto w-full px-8 py-6">
          {filteredMovies.length === 0 ? (
            <div className="py-24 text-center">
              <Film size={48} className="mx-auto mb-4 opacity-10 text-white" />
              <p className="font-semibold text-white/40">No films found.</p>
              <button onClick={() => { setSelectedGenre(undefined); setSearchQuery(""); }} className="mt-3 text-sm text-primary hover:underline">
                Clear filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {filteredMovies.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Horizontal rows (default browse) */
        <div className="py-6">
          {comingSoonMovies && comingSoonMovies.length > 0 && (
            <ComingSoonRow movies={comingSoonMovies} />
          )}

          {recentlyAdded.length > 0 && (
            <MovieRow
              title="Recently Added"
              icon={<Flame size={18} />}
              movies={recentlyAdded}
              startIndex={0}
            />
          )}

          {genreRows.map(([genre, movies], rowIdx) => (
            <MovieRow
              key={genre}
              title={genre}
              movies={movies}
              startIndex={40 + rowIdx * 10}
            />
          ))}
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-12" />
    </Layout>
  );
}
