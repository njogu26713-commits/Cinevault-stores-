import { Link } from "wouter";
import { motion } from "framer-motion";
import { Star, Tv } from "lucide-react";
import { type Series } from "@workspace/api-client-react/src/generated/api.schemas";
import { formatKes, cn } from "../lib/utils";

export const StatusBadge = ({ status, className }: { status: string; className?: string }) => {
  const styles: Record<string, string> = {
    Ongoing: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    Completed: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    Cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/30",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider", styles[status] ?? styles["Completed"], className)}>
      {status}
    </span>
  );
};

export function SeriesCard({ series, index = 0 }: { series: Series; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
      className="group relative"
    >
      <Link href={`/series/${series.id}`} className="block relative aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
        <img
          src={series.posterUrl}
          alt={series.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* Season count badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          <Tv size={10} />
          {series.totalSeasons}S · {series.totalEpisodes}EP
        </div>

        {/* Dark hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover content */}
        <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={series.status} />
            {series.rating && (
              <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                <Star size={12} className="fill-current" />
                {series.rating.toFixed(1)}
              </div>
            )}
          </div>
          <h3 className="font-bold text-white leading-tight mb-1 line-clamp-1">{series.title}</h3>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-white/60 truncate pr-2">{series.genre.slice(0, 2).join(", ")}</span>
            <span className="text-primary font-bold text-sm bg-white/90 px-2 py-1 rounded">
              {formatKes(series.pricePerSeason)}/season
            </span>
          </div>
        </div>
      </Link>

      {/* Below-card info */}
      <div className="mt-2 px-1">
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{series.title}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">{series.year} · {series.totalSeasons} seasons</span>
          <span className="text-xs font-bold text-primary">{formatKes(series.pricePerSeason)}/S</span>
        </div>
      </div>
    </motion.div>
  );
}
