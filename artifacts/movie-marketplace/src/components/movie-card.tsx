import { Link } from "wouter";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { type Movie } from "@workspace/api-client-react/src/generated/api.schemas";
import { formatKes, cn } from "../lib/utils";

export const QualityBadge = ({ quality, className }: { quality: string, className?: string }) => {
  const colors: Record<string, string> = {
    '720p': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    '1080p': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    '4K': 'bg-amber-500/10 text-amber-600 border-amber-500/30'
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider", colors[quality] || colors['1080p'], className)}>
      {quality}
    </span>
  );
};

export function MovieCard({ movie, index = 0 }: { movie: Movie, index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
      className="group relative"
    >
      <Link href={`/movie/${movie.id}`} className="block relative aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
        <img
          src={movie.posterUrl}
          alt={movie.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* Overlay gradient — dark so white text stays readable on image */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover Content */}
        <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <QualityBadge quality={movie.quality} />
            {movie.rating && (
              <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                <Star size={12} className="fill-current" />
                {movie.rating.toFixed(1)}
              </div>
            )}
            <span className="text-white/70 text-xs font-mono">{movie.year}</span>
          </div>

          <h3 className="font-bold text-white leading-tight mb-1 line-clamp-1">{movie.title}</h3>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-white/60 truncate pr-2">{movie.genre.slice(0, 2).join(', ')}</span>
            <span className="text-primary font-bold text-sm bg-white/90 px-2 py-1 rounded">
              {formatKes(movie.price)}
            </span>
          </div>
        </div>
      </Link>

      {/* Below-card info (visible without hover) */}
      <div className="mt-2 px-1">
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{movie.title}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">{movie.year}</span>
          <span className="text-xs font-bold text-primary">{formatKes(movie.price)}</span>
        </div>
      </div>
    </motion.div>
  );
}
