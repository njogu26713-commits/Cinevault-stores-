import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useGetMovie, getGetMovieQueryKey, useListMovies, getListMoviesQueryKey } from "@workspace/api-client-react";
import { Layout } from "../components/layout";
import { QualityBadge, MovieCard } from "../components/movie-card";
import { CheckoutModal } from "../components/checkout-modal";
import { formatKes } from "../lib/utils";
import { Loader2, Star, Clock, HardDrive, Calendar, Play } from "lucide-react";
import { motion } from "framer-motion";

export default function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: movie, isLoading } = useGetMovie(id!, {
    query: { enabled: !!id, queryKey: getGetMovieQueryKey(id!) }
  });

  const { data: relatedRes } = useListMovies({ genre: movie?.genre[0], limit: 5 }, {
    query: { enabled: !!movie?.genre[0], queryKey: getListMoviesQueryKey({ genre: movie?.genre[0], limit: 5 }) }
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

  if (!movie) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Movie not found.</div>
      </Layout>
    );
  }

  const relatedMovies = relatedRes?.movies.filter(m => m.id !== movie.id).slice(0, 4) || [];

  return (
    <Layout>
      <div className="w-full relative">
        {/* Banner — dark overlay to keep white text readable on image */}
        <div className="absolute inset-0 h-[60vh] overflow-hidden select-none -z-10">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[80px] z-10" />
          <img
            src={movie.bannerUrl || movie.posterUrl}
            className="w-full h-full object-cover opacity-60"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent z-10" />
        </div>

        <div className="container mx-auto px-4 pt-12 pb-24">
          <div className="flex flex-col md:flex-row gap-8 lg:gap-16">

            {/* Left Column: Poster & Buy Action */}
            <div className="w-full md:w-[300px] lg:w-[400px] shrink-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-24"
              >
                <div className="rounded-2xl overflow-hidden border border-border shadow-2xl aspect-[2/3] mb-6 relative">
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                  <div className="flex items-end justify-between mb-6">
                    <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Purchase</span>
                    <span className="text-3xl font-black text-foreground">{formatKes(movie.price)}</span>
                  </div>

                  {/* Watch button — shown when movie has a Telegram file attached */}
                  {movie.telegramFileId && (
                    <button
                      onClick={() => navigate(`/watch/${id}`)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 mb-3"
                    >
                      <Play size={18} className="fill-current" />
                      Watch Now
                    </button>
                  )}

                  <button
                    onClick={() => setCheckoutOpen(true)}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    Buy Now
                  </button>
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    {movie.telegramFileId ? "Stream online or get it on Telegram" : "Instantly delivered to Telegram"}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Right Column: Info & Trailer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex-1 pt-4 md:pt-12"
            >
              <div className="flex flex-wrap gap-2 mb-4">
                <QualityBadge quality={movie.quality} className="px-3 py-1 text-xs" />
                {movie.genre.map(g => (
                  <span key={g} className="px-3 py-1 rounded bg-muted border border-border text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="text-4xl md:text-6xl font-black text-foreground leading-tight mb-6">
                {movie.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-8 font-medium">
                {movie.rating && (
                  <div className="flex items-center gap-1.5 text-amber-500">
                    <Star size={18} className="fill-current" />
                    <span className="text-base">{movie.rating.toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} className="text-muted-foreground" />
                  {movie.year}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={16} className="text-muted-foreground" />
                  {movie.duration}
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive size={16} className="text-muted-foreground" />
                  {movie.fileSize}
                </div>
              </div>

              <div className="prose prose-slate prose-lg max-w-none text-muted-foreground leading-relaxed mb-12">
                <p>{movie.description}</p>
              </div>

              {/* YouTube Trailer */}
              {movie.youtubeTrailerId && (
                <div className="mb-16">
                  <h3 className="text-xl font-bold text-foreground mb-6">Official Trailer</h3>
                  <div className="relative rounded-2xl overflow-hidden aspect-video border border-border shadow-lg bg-slate-900">
                    <iframe
                      src={`https://www.youtube.com/embed/${movie.youtubeTrailerId}?autoplay=0&rel=0&modestbranding=1`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Related */}
              {relatedMovies.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-6">Similar Movies</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {relatedMovies.map((rm, i) => (
                      <MovieCard key={rm.id} movie={rm} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <CheckoutModal movie={movie} isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </Layout>
  );
}
