import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, PictureInPicture2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Heart, Plus, Share2, Download, Flag, Star,
  ThumbsUp, MessageCircle, Eye, Clock, Check,
  X, Subtitles
} from "lucide-react";

// ─── Mock Data ─────────────────────────────────────────────────────────────
const MOVIE = {
  title: "Interstellar",
  year: 2014,
  rating: "PG-13",
  imdb: "8.7",
  runtime: "2h 49min",
  genres: ["Sci-Fi", "Drama", "Adventure"],
  description:
    "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival. When Earth becomes uninhabitable, former NASA pilot Cooper joins a daring mission to find a new home among the stars.",
  director: "Christopher Nolan",
  cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
  quality: "4K HDR",
  size: "14.2 GB",
  posterUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80",
  bannerUrl: "https://images.unsplash.com/photo-1464802686167-b939a6910659?w=1600&q=80",
  viewers: 1243,
};

const SEASONS = [
  {
    number: 1,
    episodes: [
      { number: 1, title: "Departure", duration: "2h 49min", thumb: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=70" },
      { number: 2, title: "The Wormhole", duration: "1h 22min", thumb: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=70" },
      { number: 3, title: "Endurance", duration: "1h 18min", thumb: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=70" },
      { number: 4, title: "Miller's Planet", duration: "1h 05min", thumb: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400&q=70" },
    ],
  },
];

const RECOMMENDATIONS = [
  { id: 1, title: "Inception", year: 2010, rating: "8.8", img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=70", genre: "Sci-Fi" },
  { id: 2, title: "The Martian", year: 2015, rating: "8.0", img: "https://images.unsplash.com/photo-1454789548928-9efd52dc4031?w=400&q=70", genre: "Sci-Fi" },
  { id: 3, title: "Gravity", year: 2013, rating: "7.7", img: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=70", genre: "Thriller" },
  { id: 4, title: "Arrival", year: 2016, rating: "7.9", img: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=70", genre: "Drama" },
  { id: 5, title: "Dune", year: 2021, rating: "8.0", img: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=400&q=70", genre: "Sci-Fi" },
  { id: 6, title: "2001: A Space Odyssey", year: 1968, rating: "8.3", img: "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=400&q=70", genre: "Sci-Fi" },
];

const REVIEWS = [
  { user: "Alex M.", avatar: "AM", rating: 5, text: "Visually stunning. Nolan at his absolute best. The docking scene still gives me chills.", likes: 234, time: "2d ago" },
  { user: "Sarah K.", avatar: "SK", rating: 4, text: "Breathtaking cinematography. The score by Hans Zimmer is otherworldly.", likes: 187, time: "5d ago" },
  { user: "James R.", avatar: "JR", rating: 5, text: "One of the most ambitious films ever made. The physics are surprisingly accurate.", likes: 142, time: "1w ago" },
];

// ─── Video Player ──────────────────────────────────────────────────────────
function VideoPlayer() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState(23);
  const [duration] = useState(169 * 60);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoFit, setVideoFit] = useState<"contain" | "cover" | "fill">("contain");
  const [speed, setSpeed] = useState("1x");
  const [quality, setQuality] = useState("Auto");
  const [subtitles, setSubtitles] = useState("Off");
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [skipIntro, setSkipIntro] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTime = Math.floor((progress / 100) * duration);
  const fmt = (s: number) =>
    `${Math.floor(s / 3600) > 0 ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const resetHide = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    resetHide();
    return () => clearTimeout(hideTimeout.current);
  }, [resetHide]);

  // Simulate playback progress
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setProgress((p) => Math.min(p + 0.05, 100)), 300);
    return () => clearInterval(t);
  }, [playing]);

  const skip = (secs: number) => {
    const delta = (secs / duration) * 100;
    setProgress((p) => Math.max(0, Math.min(100, p + delta)));
  };

  const settingsOptions = {
    "Video Fit": {
      value: videoFit === "contain" ? "Fit (Contain)" : videoFit === "cover" ? "Fill (Cover)" : "Stretch",
      choices: ["Fit (Contain)", "Fill (Cover)", "Stretch", "Original Size"],
      onChange: (v: string) => setVideoFit(v === "Fit (Contain)" ? "contain" : v === "Fill (Cover)" ? "cover" : "fill"),
    },
    "Speed": { value: speed, choices: ["0.5x", "0.75x", "1x", "1.25x", "1.5x", "2x"], onChange: setSpeed },
    "Quality": { value: quality, choices: ["Auto", "1080p", "720p", "480p", "360p"], onChange: setQuality },
    "Subtitles": { value: subtitles, choices: ["Off", "English", "Spanish", "French"], onChange: setSubtitles },
    "Auto Play Next": {
      value: autoplayNext ? "On" : "Off", choices: ["On", "Off"],
      onChange: (v: string) => setAutoplayNext(v === "On"),
    },
    "Skip Intro": {
      value: skipIntro ? "On" : "Off", choices: ["On", "Off"],
      onChange: (v: string) => setSkipIntro(v === "On"),
    },
  };

  const [activeSettingKey, setActiveSettingKey] = useState<string | null>(null);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black select-none group"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={resetHide}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={() => { if (!showSettings) { setPlaying((p) => !p); resetHide(); } }}
    >
      {/* Video / Poster */}
      <img
        src={MOVIE.bannerUrl}
        alt={MOVIE.title}
        className="absolute inset-0 w-full h-full transition-all duration-300"
        style={{
          objectFit: videoFit === "contain" ? "contain" : videoFit === "cover" ? "cover" : "fill",
        }}
      />
      {/* Dark overlay when paused */}
      {!playing && (
        <div className="absolute inset-0 bg-black/40" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

      {/* Big play button when paused */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
            <Play size={36} className="text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div
            className="relative h-1 bg-white/20 rounded-full cursor-pointer group/bar hover:h-2 transition-all duration-150"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setProgress(((e.clientX - rect.left) / rect.width) * 100);
            }}
          >
            {/* Buffered */}
            <div className="absolute left-0 top-0 h-full bg-white/30 rounded-full" style={{ width: `${Math.min(progress + 15, 100)}%` }} />
            {/* Played */}
            <div className="absolute left-0 top-0 h-full bg-[#4f8ef7] rounded-full" style={{ width: `${progress}%` }} />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        {/* Bottom controls */}
        <div
          className="flex items-center gap-3 px-4 pb-4 backdrop-blur-sm bg-gradient-to-t from-black/60 to-transparent"
        >
          {/* Left controls */}
          <button
            className="text-white/80 hover:text-white transition-colors"
            onClick={() => { setPlaying((p) => !p); }}
          >
            {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button className="text-white/70 hover:text-white transition-colors" onClick={() => skip(-10)}>
            <SkipBack size={20} />
          </button>
          <button className="text-white/70 hover:text-white transition-colors" onClick={() => skip(10)}>
            <SkipForward size={20} />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button className="text-white/70 hover:text-white transition-colors" onClick={() => setMuted((m) => !m)}>
              {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
              <input
                type="range" min={0} max={100} value={muted ? 0 : volume}
                onChange={(e) => { setVolume(+e.target.value); setMuted(false); }}
                className="w-20 accent-[#4f8ef7] cursor-pointer"
              />
            </div>
          </div>

          {/* Time */}
          <span className="text-white/60 text-xs font-mono tabular-nums">
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right controls */}
          <button className="text-white/70 hover:text-white transition-colors" title="Subtitles">
            <Subtitles size={20} />
          </button>
          <button
            className="text-white/70 hover:text-white transition-colors"
            title="Picture in Picture"
            onClick={() => {}}
          >
            <PictureInPicture2 size={20} />
          </button>
          <button
            className="text-white/70 hover:text-white transition-colors relative"
            title="Settings"
            onClick={(e) => { e.stopPropagation(); setShowSettings((s) => !s); setActiveSettingKey(null); }}
          >
            <Settings size={20} className={`transition-transform ${showSettings ? "rotate-45" : ""}`} />
          </button>
          <button className="text-white/70 hover:text-white transition-colors" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          className="absolute bottom-16 right-4 w-64 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            {activeSettingKey ? (
              <button className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors" onClick={() => setActiveSettingKey(null)}>
                <ChevronLeft size={14} />
                Back
              </button>
            ) : (
              <span className="text-white text-sm font-semibold">Settings</span>
            )}
            <button className="text-white/40 hover:text-white/70" onClick={() => setShowSettings(false)}>
              <X size={16} />
            </button>
          </div>

          {activeSettingKey ? (
            <div className="py-2">
              <p className="px-4 py-1 text-white/40 text-xs uppercase tracking-wider">{activeSettingKey}</p>
              {settingsOptions[activeSettingKey as keyof typeof settingsOptions].choices.map((c) => (
                <button
                  key={c}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                  onClick={() => {
                    settingsOptions[activeSettingKey as keyof typeof settingsOptions].onChange(c);
                    setActiveSettingKey(null);
                  }}
                >
                  {c}
                  {settingsOptions[activeSettingKey as keyof typeof settingsOptions].value === c && (
                    <Check size={14} className="text-[#4f8ef7]" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(settingsOptions).map(([key, opt]) => (
                <button
                  key={key}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                  onClick={() => setActiveSettingKey(key)}
                >
                  <span className="text-white/80">{key}</span>
                  <div className="flex items-center gap-1 text-white/40 text-xs">
                    <span>{opt.value}</span>
                    <ChevronRight size={12} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skip intro toast */}
      {skipIntro && playing && progress < 10 && (
        <div className="absolute bottom-20 right-4">
          <button className="px-4 py-2 border border-white/40 text-white text-sm font-medium rounded-lg backdrop-blur-sm bg-black/40 hover:bg-white/10 transition-colors">
            Skip Intro
          </button>
        </div>
      )}

      {/* Live viewers badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 text-xs text-white/60">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        {MOVIE.viewers.toLocaleString()} watching
      </div>
    </div>
  );
}

// ─── Episode List ──────────────────────────────────────────────────────────
function EpisodeSection() {
  const [open, setOpen] = useState(true);
  const [currentEp, setCurrentEp] = useState(0);
  const [saved, setSaved] = useState<Record<number, number>>({ 0: 23 });

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">Season 1</span>
          <span className="text-white/30 text-sm">· {SEASONS[0].episodes.length} Episodes</span>
        </div>
        {open ? <ChevronUp size={18} className="text-white/40" /> : <ChevronDown size={18} className="text-white/40" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          {SEASONS[0].episodes.map((ep, i) => (
            <button
              key={ep.number}
              className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-white/[0.04] ${i === currentEp ? "bg-white/[0.05]" : ""}`}
              onClick={() => setCurrentEp(i)}
            >
              <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-zinc-800">
                <img src={ep.thumb} alt={ep.title} className="w-full h-full object-cover" />
                {i === currentEp && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="w-8 h-8 rounded-full bg-[#4f8ef7]/90 flex items-center justify-center">
                      <Play size={14} className="fill-white text-white ml-0.5" />
                    </div>
                  </div>
                )}
                {saved[i] !== undefined && i !== currentEp && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                    <div className="h-full bg-[#4f8ef7]" style={{ width: `${saved[i]}%` }} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${i === currentEp ? "text-[#4f8ef7]" : "text-white/80"}`}>
                    E{ep.number}
                  </span>
                  <span className="text-white/60 text-sm truncate">{ep.title}</span>
                </div>
                <span className="text-white/30 text-xs mt-0.5 block">{ep.duration}</span>
              </div>
              {i < currentEp && <Check size={14} className="text-white/30 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reviews ───────────────────────────────────────────────────────────────
function ReviewSection() {
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [comment, setComment] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="space-y-5">
      <h3 className="text-white font-semibold text-base flex items-center gap-2">
        <MessageCircle size={16} className="text-[#4f8ef7]" />
        Comments & Reviews
        <span className="text-white/30 text-sm font-normal">({REVIEWS.length})</span>
      </h3>

      {/* Write review */}
      <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm">Your rating:</span>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map((s) => (
              <button
                key={s}
                className="transition-transform hover:scale-110"
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setUserRating(s)}
              >
                <Star
                  size={16}
                  className={`${(hoverRating || userRating) >= s ? "fill-amber-400 text-amber-400" : "text-white/20"} transition-colors`}
                />
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts..."
          rows={2}
          className="w-full bg-zinc-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#4f8ef7]/40 transition-colors"
        />
        <div className="flex justify-end">
          <button className="px-4 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7de0] text-white text-sm font-medium rounded-lg transition-colors">
            Post
          </button>
        </div>
      </div>

      {/* Review list */}
      <div className="space-y-3">
        {REVIEWS.map((r, i) => (
          <div key={i} className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#4f8ef7]/20 border border-[#4f8ef7]/30 flex items-center justify-center text-[#4f8ef7] text-xs font-bold">
                  {r.avatar}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{r.user}</p>
                  <p className="text-white/30 text-xs">{r.time}</p>
                </div>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: r.rating }).map((_, j) => (
                  <Star key={j} size={12} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">{r.text}</p>
            <button
              className={`flex items-center gap-1.5 text-xs transition-colors ${liked.has(i) ? "text-[#4f8ef7]" : "text-white/30 hover:text-white/60"}`}
              onClick={() => setLiked((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
            >
              <ThumbsUp size={13} />
              {r.likes + (liked.has(i) ? 1 : 0)} helpful
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Watch Page ───────────────────────────────────────────────────────
export function WatchPage() {
  const [liked, setLiked] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [prevEp] = useState("E1: Introduction");
  const [nextEp] = useState("E3: Endurance");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-['Outfit',sans-serif]">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center gap-3 px-4 md:px-6 h-14 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <button className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ChevronLeft size={18} />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm md:text-base truncate">{MOVIE.title}</h1>
          <p className="text-white/40 text-xs hidden sm:block">S01E02 — The Wormhole</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${inWatchlist ? "bg-[#4f8ef7]/20 text-[#4f8ef7] border border-[#4f8ef7]/30" : "bg-white/5 text-white/60 hover:text-white border border-white/10"}`}
            onClick={() => setInWatchlist((w) => !w)}>
            {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
            <span className="hidden sm:inline">{inWatchlist ? "Saved" : "Watchlist"}</span>
          </button>
        </div>
      </nav>

      {/* ── Player ───────────────────────────────────────────────────────── */}
      <div className="w-full">
        <VideoPlayer />
      </div>

      {/* ── Episode Nav ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.05] bg-zinc-900/30">
        <button className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors group">
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline truncate max-w-[140px]">{prevEp}</span>
          <span className="sm:hidden">Prev</span>
        </button>
        <div className="flex items-center gap-2 text-white/30 text-xs">
          <Clock size={12} />
          <span>Episode 2 of 4</span>
        </div>
        <button className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors group">
          <span className="hidden sm:inline truncate max-w-[140px]">{nextEp}</span>
          <span className="sm:hidden">Next</span>
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── Content below player ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Movie info */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-white font-bold text-xl md:text-2xl">{MOVIE.title}</h2>
              <span className="px-1.5 py-0.5 border border-white/20 rounded text-xs text-white/50">{MOVIE.rating}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/40">
              <span>{MOVIE.year}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <div className="flex items-center gap-1">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span className="text-white/60 font-medium">{MOVIE.imdb}</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>{MOVIE.runtime}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[#4f8ef7]">{MOVIE.quality}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {MOVIE.genres.map((g) => (
                <span key={g} className="px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.09] rounded-full text-xs text-white/60 transition-colors cursor-pointer">
                  {g}
                </span>
              ))}
            </div>
            <p className="text-white/60 text-sm leading-relaxed">{MOVIE.description}</p>
            <div className="text-xs text-white/30 space-y-0.5">
              <p>Director: <span className="text-white/50">{MOVIE.director}</span></p>
              <p>Cast: <span className="text-white/50">{MOVIE.cast.join(", ")}</span></p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${liked ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-white/[0.05] text-white/60 border-white/10 hover:border-white/20 hover:text-white"}`}
              onClick={() => setLiked((l) => !l)}
            >
              <Heart size={15} className={liked ? "fill-red-400" : ""} />
              {liked ? "Liked" : "Like"}
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${inWatchlist ? "bg-[#4f8ef7]/10 text-[#4f8ef7] border-[#4f8ef7]/30" : "bg-white/[0.05] text-white/60 border-white/10 hover:border-white/20 hover:text-white"}`}
              onClick={() => setInWatchlist((w) => !w)}
            >
              {inWatchlist ? <Check size={15} /> : <Plus size={15} />}
              {inWatchlist ? "In Watchlist" : "Watchlist"}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.05] text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-all">
              <Share2 size={15} />
              Share
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.05] text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-all">
              <Download size={15} />
              Download
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.05] text-white/50 border border-white/10 hover:border-red-500/20 hover:text-red-400 transition-all ml-auto">
              <Flag size={14} />
              Report
            </button>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 py-3 border-y border-white/[0.05]">
            <div className="flex items-center gap-1.5 text-sm text-white/40">
              <Eye size={14} />
              <span>{MOVIE.viewers.toLocaleString()} watching now</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-white/40">
              <Heart size={14} />
              <span>24.8k likes</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-white/40">
              <MessageCircle size={14} />
              <span>312 reviews</span>
            </div>
          </div>

          {/* Reviews */}
          <ReviewSection />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Continue watching */}
          <div className="rounded-2xl bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 px-4 py-3 flex items-center gap-3">
            <Clock size={16} className="text-[#4f8ef7] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">Continue Watching</p>
              <p className="text-white/50 text-xs">23% · 2h 10min left</p>
            </div>
            <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#4f8ef7] rounded-full" style={{ width: "23%" }} />
            </div>
          </div>

          {/* Episodes */}
          <EpisodeSection />

          {/* Recommended */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-3">More Like This</h3>
            <div className="grid grid-cols-2 gap-3">
              {RECOMMENDATIONS.map((m) => (
                <div key={m.id} className="group cursor-pointer">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-800 mb-2">
                    <img src={m.img} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5 text-xs text-amber-400 font-medium flex items-center gap-0.5">
                      <Star size={9} className="fill-amber-400" />
                      {m.rating}
                    </div>
                  </div>
                  <p className="text-white/80 text-xs font-medium truncate group-hover:text-white transition-colors">{m.title}</p>
                  <p className="text-white/30 text-xs">{m.year} · {m.genre}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer spacing */}
      <div className="h-12" />
    </div>
  );
}
