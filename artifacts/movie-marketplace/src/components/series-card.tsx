import { Link } from "wouter";
import { motion } from "framer-motion";
import { Star, Tv, Play } from "lucide-react";
import { type Series } from "@workspace/api-client-react";
import { formatKes, cn } from "../lib/utils";
import { useCardHoverPreview } from "./card-hover-preview";
import { useRef } from "react";

export const StatusBadge = ({ status, className }: { status: string; className?: string }) => {
  const styles: Record<string, string> = {
    Ongoing:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Cancelled: "bg-white/10 text-white/40 border-white/15",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider", styles[status] ?? styles["Completed"], className)}>
      {status}
    </span>
  );
};

export function SeriesCard({ series, index = 0 }: { series: Series; index?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { show, hide, panelEl } = useCardHoverPreview();

  return (
    <>
      {panelEl}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.4, ease: "easeOut" }}
        whileHover={{ scale: 1.04, zIndex: 10 }}
        className="group relative flex-shrink-0"
        style={{ transformOrigin: "center bottom" }}
        onMouseEnter={() => cardRef.current && show({
          id: series.id,
          type: "series",
          title: series.title,
          posterUrl: series.posterUrl,
          youtubeTrailerId: series.youtubeTrailerId,
          genre: series.genre,
          year: series.year,
          rating: series.rating,
          quality: series.quality,
          price: series.pricePerSeason,
          priceLabel: `${formatKes(series.pricePerSeason)}/season`,
        }, cardRef.current)}
        onMouseLeave={hide}
      >
        <Link href={`/series/${series.id}`} className="block">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-lg group-hover:shadow-2xl group-hover:shadow-black/60 transition-all duration-400">
            <img
              src={series.posterUrl}
              alt={series.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />

            {/* Season count badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/15">
              <Tv size={9} />
              {series.totalSeasons}S · {series.totalEpisodes}EP
            </div>

            {/* Gradient + hover content */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-350" />

            <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={series.status} />
                {series.rating && (
                  <div className="flex items-center gap-1 text-amber-400 text-[10px] font-semibold">
                    <Star size={10} className="fill-current" />
                    {series.rating.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs py-2 rounded-lg shadow-lg shadow-primary/30">
                <Play size={12} className="fill-white" />
                {formatKes(series.pricePerSeason)}/season
              </div>
            </div>
          </div>

          {/* Below-card info */}
          <div className="mt-2.5 px-0.5">
            <h3 className="font-bold text-white/90 text-sm leading-tight line-clamp-1 group-hover:text-white transition-colors">
              {series.title}
            </h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-white/35">{series.year} · {series.totalSeasons}S</span>
              <span className="text-xs font-bold text-primary/90">{formatKes(series.pricePerSeason)}/S</span>
            </div>
          </div>
        </Link>
      </motion.div>
    </>
  );
}
