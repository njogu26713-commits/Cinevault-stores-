import { Link } from "wouter";
import { motion } from "framer-motion";
import { Star, ShoppingCart } from "lucide-react";
import { type Movie } from "@workspace/api-client-react";
import { formatKes, cn } from "../lib/utils";

export const QualityBadge = ({ quality, className }: { quality: string, className?: string }) => {
  const styles: Record<string, string> = {
    '720p': 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
    '1080p': 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-100',
    '4K': 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100'
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ring-1",
      styles[quality] || styles['1080p'],
      className
    )}>
      {quality}
    </span>
  );
};

export function MovieCard({ movie, index = 0 }: { movie: Movie, index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <Link href={`/movie/${movie.id}`} className="block">
        {/* Poster */}
        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted border border-border shadow-sm group-hover:shadow-xl group-hover:shadow-primary/10 transition-all duration-500">
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />

          {/* Quality badge — always visible top-left */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <QualityBadge quality={movie.quality} />
          </div>

          {/* Rating badge — top-right */}
          {movie.rating && (
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-amber-500 text-xs font-bold px-2 py-0.5 rounded-md border border-amber-200/60 shadow-sm">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              {movie.rating.toFixed(1)}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

          {/* Hover buy button */}
          <div className="absolute inset-x-0 bottom-0 p-4 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/85 text-xs truncate pr-2">{movie.genre.slice(0, 2).join(' · ')}</span>
              <span className="text-white/80 text-xs font-mono">{movie.year}</span>
            </div>
            <div className="w-full flex items-center justify-center gap-2 bg-white text-primary font-bold text-sm py-2.5 rounded-xl shadow-lg">
              <ShoppingCart size={15} />
              {formatKes(movie.price)}
            </div>
          </div>
        </div>

        {/* Below-card info */}
        <div className="mt-3 px-0.5">
          <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">
            {movie.title}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">{movie.genre[0]}</span>
            <span className="text-xs font-bold text-primary">{formatKes(movie.price)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
