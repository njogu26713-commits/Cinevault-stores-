import { Link } from "wouter";
import { motion } from "framer-motion";
import { Star, Play } from "lucide-react";
import { type Movie } from "@workspace/api-client-react";
import { formatKes, cn } from "../lib/utils";
import { useCardHoverPreview } from "./card-hover-preview";
import { useRef } from "react";

export const QualityBadge = ({ quality, className }: { quality: string, className?: string }) => {
  const styles: Record<string, string> = {
    '720p':  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    '1080p': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    '4K':    'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider",
      styles[quality] || styles['1080p'],
      className
    )}>
      {quality}
    </span>
  );
};

export function MovieCard({ movie, index = 0 }: { movie: Movie, index?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { show, hide, panelEl } = useCardHoverPreview();

  return (
    <>
      {panelEl}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.04, zIndex: 10 }}
        className="group relative flex-shrink-0"
        style={{ transformOrigin: "center bottom" }}
        onMouseEnter={() => cardRef.current && show({
          id: movie.id,
          type: "movie",
          title: movie.title,
          posterUrl: movie.posterUrl,
          youtubeTrailerId: movie.youtubeTrailerId,
          genre: movie.genre,
          year: movie.year,
          rating: movie.rating,
          quality: movie.quality,
          duration: movie.duration,
          price: movie.price,
          comingSoon: movie.comingSoon,
          telegramFileId: movie.telegramFileId,
        }, cardRef.current)}
        onMouseLeave={hide}
      >
        <Link href={`/movie/${movie.id}`} className="block">
          {/* Poster */}
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-lg group-hover:shadow-2xl group-hover:shadow-black/60 transition-all duration-400">
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />

            {/* Quality badge — top-left */}
            <div className="absolute top-2 left-2 z-10">
              <QualityBadge quality={movie.quality} />
            </div>

            {/* Rating badge — top-right */}
            {movie.rating && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                <Star size={9} className="fill-amber-400" />
                {movie.rating.toFixed(1)}
              </div>
            )}

            {/* Bottom gradient overlay — always present, strengthens on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-350" />

            {/* Hover content */}
            <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <div className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs py-2 rounded-lg shadow-lg shadow-primary/30">
                <Play size={12} className="fill-white" />
                {formatKes(movie.price)}
              </div>
            </div>
          </div>

          {/* Below-card info */}
          <div className="mt-2.5 px-0.5">
            <h3 className="font-bold text-white/90 text-sm leading-snug line-clamp-1 group-hover:text-white transition-colors">
              {movie.title}
            </h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-white/35">{movie.genre[0]}</span>
              <span className="text-xs font-bold text-primary/90">{formatKes(movie.price)}</span>
            </div>
          </div>
        </Link>
      </motion.div>
    </>
  );
}
