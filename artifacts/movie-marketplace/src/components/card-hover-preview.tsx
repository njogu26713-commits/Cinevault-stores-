import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Star, Play, ShoppingCart, Tv } from "lucide-react";
import { formatKes } from "../lib/utils";

interface HoverPreviewData {
  id: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string;
  youtubeTrailerId?: string | null;
  genre: string[];
  year: number;
  rating?: number | null;
  quality?: string;
  duration?: string;
  price: number;
  priceLabel?: string;
  comingSoon?: boolean;
  telegramFileId?: string | null;
  rect: DOMRect;
}

const PANEL_W = 440;
const PANEL_H = 280;
const GAP = 12;

function calcPosition(rect: DOMRect): { top: number; left: number; side: "right" | "left" } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceRight = vw - rect.right;
  const side: "right" | "left" = spaceRight >= PANEL_W + GAP ? "right" : "left";

  let left = side === "right" ? rect.right + GAP : rect.left - PANEL_W - GAP;
  let top = rect.top + rect.height / 2 - PANEL_H / 2;

  top = Math.max(8, Math.min(top, vh - PANEL_H - 8));
  left = Math.max(8, Math.min(left, vw - PANEL_W - 8));

  return { top, left, side };
}

interface PanelProps {
  data: HoverPreviewData;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function Panel({ data, onMouseEnter, onMouseLeave }: PanelProps) {
  const { top, left } = calcPosition(data.rect);
  const href = data.type === "movie" ? `/movie/${data.id}` : `/series/${data.id}`;

  const trailerSrc = data.youtubeTrailerId
    ? `https://www.youtube.com/embed/${data.youtubeTrailerId}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&loop=1&playlist=${data.youtubeTrailerId}`
    : null;

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        top,
        left,
        width: PANEL_W,
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      className="rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 bg-[#141418] animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Trailer or poster banner */}
      <div className="relative w-full" style={{ height: 160 }}>
        {trailerSrc ? (
          <iframe
            src={trailerSrc}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
            title={data.title}
            style={{ border: "none", pointerEvents: "none" }}
          />
        ) : (
          <img
            src={data.posterUrl}
            alt={data.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141418] via-transparent to-transparent" />

        {/* Floating poster thumbnail */}
        <div className="absolute left-4 bottom-0 translate-y-1/2 w-16 aspect-[2/3] rounded-lg overflow-hidden border-2 border-white/15 shadow-xl flex-shrink-0">
          <img src={data.posterUrl} alt={data.title} className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Info section */}
      <div className="px-4 pt-3 pb-4 pl-24">
        <h3 className="font-black text-white text-sm leading-snug line-clamp-1 mb-1">{data.title}</h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/40 mb-3">
          <span>{data.year}</span>
          {data.quality && (
            <span className="text-blue-400 font-semibold">{data.quality}</span>
          )}
          {data.duration && <span>{data.duration}</span>}
          {data.genre[0] && <span>{data.genre[0]}</span>}
          {data.rating != null && (
            <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
              <Star size={9} className="fill-amber-400" />
              {data.rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {data.comingSoon ? (
            <Link
              href={href}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-white/8 border border-white/12 text-white/70 text-xs font-semibold hover:bg-white/14 transition-colors"
            >
              <Tv size={13} />
              Coming Soon
            </Link>
          ) : (
            <Link
              href={href}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
            >
              <ShoppingCart size={13} />
              {data.type === "series"
                ? `Buy — ${data.priceLabel ?? formatKes(data.price)}`
                : `Buy — ${formatKes(data.price)}`}
            </Link>
          )}

          {(data.telegramFileId || data.type === "series") && !data.comingSoon && (
            <Link
              href={href}
              className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-white/8 border border-white/12 text-white/70 text-xs font-semibold hover:bg-white/14 transition-colors"
            >
              <Play size={12} className="fill-white/70" />
              Watch
            </Link>
          )}

          {data.youtubeTrailerId && (
            <a
              href={`https://www.youtube.com/watch?v=${data.youtubeTrailerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-white/8 border border-white/12 text-white/70 text-xs font-semibold hover:bg-white/14 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Play size={12} className="fill-red-400 text-red-400" />
              Trailer
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function useCardHoverPreview() {
  const [data, setData] = useState<HoverPreviewData | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setData(null), 180);
  }, []);

  const show = useCallback((d: Omit<HoverPreviewData, "rect">, el: HTMLElement) => {
    if (window.innerWidth < 1024) return;
    cancelHide();
    setData({ ...d, rect: el.getBoundingClientRect() });
  }, [cancelHide]);

  const hide = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const panelEl = data ? (
    <Panel data={data} onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />
  ) : null;

  return { show, hide, panelEl };
}
