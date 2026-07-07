import { useParams, useLocation, Link } from "wouter";
import { useRef, useState, useEffect, useCallback } from "react";
import { useGetMovie, getGetMovieQueryKey, useListMovies, type Movie } from "@workspace/api-client-react";
import { ReviewSection } from "../components/review-section";
import { CheckoutModal } from "../components/checkout-modal";
import {
  Loader2, ArrowLeft, AlertCircle, Play, Pause,
  Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward,
  Settings, PictureInPicture2, Heart, Plus, Share2, Download,
  Flag, Star, Eye, MessageCircle, Check, ExternalLink, Clock,
  ChevronLeft, ChevronRight, X, RotateCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Hls from "hls.js";
import { fetchMovieStream } from "../lib/vidsrc";

// ── LocalStorage prefs ─────────────────────────────────────────────────────
function loadPref<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") ?? fallback; } catch { return fallback; }
}
function savePref(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

function useSavedUsername() {
  const [username, setUsername] = useState<string>(
    () => localStorage.getItem("cv_username") || ""
  );
  const save = (val: string) => {
    const clean = val.startsWith("@") ? val : `@${val}`;
    localStorage.setItem("cv_username", clean);
    setUsername(clean);
  };
  return { username, save };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

// ── Video Player ───────────────────────────────────────────────────────────
// Must match FREE_MOVIE_PREVIEW_SECONDS in artifacts/api-server/src/routes/stream.ts
const FREE_MOVIE_PREVIEW_SECONDS = 20 * 60;

interface PlayerProps {
  src: string;
  poster?: string;
  subtitleUrl?: string;
  isFreePreview: boolean;
  isExternal?: boolean;
  onError: (msg: string) => void;
  onPreviewLimitReached: () => void;
  onBack: () => void;
}

function VideoPlayer({ src, poster, subtitleUrl, isFreePreview, isExternal, onError, onPreviewLimitReached, onBack }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => loadPref("cv_volume", 80));
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingKey, setActiveSettingKey] = useState<string | null>(null);

  // Persistent settings
  const [videoFit, setVideoFitState] = useState<"contain" | "cover" | "fill">(() => loadPref("cv_fit", "contain"));
  const [speed, setSpeedState] = useState<string>(() => loadPref("cv_speed", "1x"));
  const [subtitlesOn, setSubtitlesState] = useState<boolean>(() => loadPref("cv_subs", true));
  const [autoplayNext, setAutoplayNextState] = useState<boolean>(() => loadPref("cv_autoplay", true));
  const [skipIntro, setSkipIntroState] = useState<boolean>(() => loadPref("cv_skipintro", false));

  const setVideoFit = (v: "contain" | "cover" | "fill") => { setVideoFitState(v); savePref("cv_fit", v); };
  const setSpeed = (v: string) => {
    setSpeedState(v);
    savePref("cv_speed", v);
    if (videoRef.current) videoRef.current.playbackRate = parseFloat(v);
  };
  const setSubtitles = (v: boolean) => { setSubtitlesState(v); savePref("cv_subs", v); };
  const setAutoplayNext = (v: boolean) => { setAutoplayNextState(v); savePref("cv_autoplay", v); };
  const setSkipIntro = (v: boolean) => { setSkipIntroState(v); savePref("cv_skipintro", v); };

  const [isLandscapeLocked, setIsLandscapeLocked] = useState(false);

  const toggleOrientation = async () => {
    try {
      if (isLandscapeLocked) {
        screen.orientation.unlock();
        setIsLandscapeLocked(false);
      } else {
        await (screen.orientation as any).lock("landscape");
        setIsLandscapeLocked(true);
      }
    } catch {
      // Screen Orientation API not supported or permission denied
    }
  };

  const hideTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playingRef = useRef(false);
  const lastSaveRef = useRef(0);

  const resetHide = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimeout.current);
    if (playingRef.current) {
      hideTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, []);

  const isFreePreviewRef = useRef(isFreePreview);
  useEffect(() => { isFreePreviewRef.current = isFreePreview; }, [isFreePreview]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Apply persisted settings on mount
    v.volume = volume / 100;
    v.playbackRate = parseFloat(speed);
    const onTime = () => {
      setProgress(v.currentTime);
      // Enforce free-preview cutoff client-side (mirrors backend byte cap)
      if (isFreePreviewRef.current && v.currentTime >= FREE_MOVIE_PREVIEW_SECONDS) {
        v.pause();
        v.currentTime = FREE_MOVIE_PREVIEW_SECONDS;
        onPreviewLimitReached();
        return;
      }
      // Save progress throttled to every 5 real-time seconds
      const now = Date.now();
      if (now - lastSaveRef.current > 5000) {
        savePref(`cv_movie_progress_${src}`, Math.floor(v.currentTime));
        lastSaveRef.current = now;
      }
    };
    const onDuration = () => {
      setDuration(v.duration);
      // Resume from saved position
      const saved = loadPref<number>(`cv_movie_progress_${src}`, 0);
      if (saved > 10) v.currentTime = saved;
    };
    const onPlay = () => { setPlaying(true); playingRef.current = true; resetHide(); };
    const onPause = () => { setPlaying(false); playingRef.current = false; setShowControls(true); };
    const onFull = () => setFullscreen(
      !!(document.fullscreenElement || (document as any).webkitFullscreenElement)
    );
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDuration);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("webkitfullscreenchange", onFull);
    v.addEventListener("webkitbeginfullscreen", onFull);
    v.addEventListener("webkitendfullscreen", onFull);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDuration);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("webkitfullscreenchange", onFull);
      v.removeEventListener("webkitbeginfullscreen", onFull);
      v.removeEventListener("webkitendfullscreen", onFull);
      clearTimeout(hideTimeout.current);
      // Release orientation lock when player unmounts
      try { screen.orientation.unlock(); } catch {}
    };
  }, []);

  // Sync subtitle track visibility
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    Array.from(v.textTracks).forEach((track) => {
      track.mode = subtitlesOn ? "showing" : "hidden";
    });
  }, [subtitlesOn]);

  // ── HLS.js ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src.includes(".m3u8")) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) onError("Stream unavailable. The external source could not be loaded.");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.load();
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
    resetHide();
  };

  const skip = (secs: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + secs));
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    setVolume(val);
    savePref("cv_volume", val);
    if (v) v.volume = val / 100;
    if (val > 0) setMuted(false);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
  };

  const toggleFullscreen = () => {
    const v = videoRef.current;
    const el = v?.parentElement;
    if (!el || !v) return;
    const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (v as any).webkitDisplayingFullscreen);
    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      else if ((v as any).webkitExitFullscreen) (v as any).webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
      else if ((v as any).webkitEnterFullscreen) (v as any).webkitEnterFullscreen();
    }
  };

  const togglePip = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else {
      v.requestPictureInPicture().catch(() => {});
    }
  };

  const fitLabel = videoFit === "contain" ? "Fit (Contain)" : videoFit === "cover" ? "Fill (Cover)" : "Stretch";
  const settingsMap: Record<string, { value: string; choices: string[]; onSelect: (v: string) => void }> = {
    "Video Fit": {
      value: fitLabel,
      choices: ["Fit (Contain)", "Fill (Cover)", "Stretch"],
      onSelect: (v) => setVideoFit(v === "Fit (Contain)" ? "contain" : v === "Fill (Cover)" ? "cover" : "fill"),
    },
    "Speed": {
      value: speed,
      choices: ["0.5x", "0.75x", "1x", "1.25x", "1.5x", "2x"],
      onSelect: setSpeed,
    },
    "Subtitles": {
      value: subtitlesOn ? "On" : "Off",
      choices: ["On", "Off"],
      onSelect: (v) => setSubtitles(v === "On"),
    },
    "Auto Play Next": {
      value: autoplayNext ? "On" : "Off",
      choices: ["On", "Off"],
      onSelect: (v) => setAutoplayNext(v === "On"),
    },
    "Skip Intro": {
      value: skipIntro ? "On" : "Off",
      choices: ["On", "Off"],
      onSelect: (v) => setSkipIntro(v === "On"),
    },
  };

  const progressPct = duration ? (progress / duration) * 100 : 0;

  return (
    <div
      className="relative w-full bg-black select-none"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={resetHide}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={() => { if (!showSettings) togglePlay(); }}
    >
      <video
        ref={videoRef}
        src={src.includes(".m3u8") && Hls.isSupported() ? undefined : src}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: videoFit === "contain" ? "contain" : videoFit === "cover" ? "cover" : "fill" }}
        crossOrigin="anonymous"
        playsInline
        poster={poster}
        onError={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isExternal) {
            onError("Stream unavailable. Could not load the external video source.");
            return;
          }
          // Probe the stream URL to get the real error message from the server
          // (the browser only gives us a numeric error code, not the body)
          try {
            const probe = await fetch(src, { headers: { Range: "bytes=0-1" } });
            if (probe.status === 403) {
              const body = await probe.json().catch(() => null);
              if (body?.error === "PURCHASE_REQUIRED") {
                onPreviewLimitReached();
                return;
              }
            }
            if (probe.status >= 400) {
              const body = await probe.json().catch(() => null);
              if (body?.message) {
                onError(body.message);
                return;
              }
            }
          } catch {
            // Ignore probe failures, fall through to generic error handling
          }
          const code = e.currentTarget.error?.code;
          onError(
            code === 4
              ? "File is too large for the Bot API (>20 MB). Go to Admin → Telegram Connect and sign in to stream large files."
              : `Playback error (code ${code ?? "unknown"}). Make sure the movie file is attached and try again.`
          );
        }}
      >
        {subtitleUrl && (
          <track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />
        )}
      </video>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Big play button when paused */}
      <AnimatePresence>
        {!playing && (
          <motion.div
            key="bigplay"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
              <Play size={36} className="text-white fill-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div
            className="relative h-1 bg-white/20 rounded-full cursor-pointer group/bar hover:h-1.5 transition-all duration-150"
            onClick={seek}
          >
            <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: `${Math.min(progressPct + 10, 100)}%` }} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPct}% - 6px)` }}
            />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex items-center gap-2 px-4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <button aria-label={playing ? "Pause" : "Play"} className="text-white/90 hover:text-white transition-colors p-1" onClick={togglePlay}>
            {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button aria-label="Rewind 10 seconds" className="text-white/70 hover:text-white transition-colors p-1" onClick={() => skip(-10)}>
            <SkipBack size={20} />
          </button>
          <button aria-label="Skip forward 10 seconds" className="text-white/70 hover:text-white transition-colors p-1" onClick={() => skip(10)}>
            <SkipForward size={20} />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1 group/vol">
            <button aria-label={muted || volume === 0 ? "Unmute" : "Mute"} className="text-white/70 hover:text-white transition-colors p-1" onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
              <input
                type="range" min={0} max={100} value={muted ? 0 : volume}
                onChange={(e) => changeVolume(+e.target.value)}
                className="w-20 cursor-pointer accent-primary"
              />
            </div>
          </div>

          {/* Time */}
          <span className="text-white/50 text-xs font-mono tabular-nums">
            {fmt(progress)} / {duration ? fmt(duration) : "--:--"}
          </span>

          <div className="flex-1" />

          {/* Right controls */}
          <div className="relative">
            <button
              className={`text-white/70 hover:text-white transition-colors p-1 ${showSettings ? "text-white" : ""}`}
              onClick={(e) => { e.stopPropagation(); setShowSettings((s) => !s); setActiveSettingKey(null); }}
              title="Settings"
            >
              <Settings size={20} className={`transition-transform duration-300 ${showSettings ? "rotate-45" : ""}`} />
            </button>

            {/* Settings panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-10 right-0 w-60 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    {activeSettingKey ? (
                      <button
                        className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
                        onClick={() => setActiveSettingKey(null)}
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                    ) : (
                      <span className="text-white text-sm font-semibold">Settings</span>
                    )}
                    <button className="text-white/40 hover:text-white/70" onClick={() => setShowSettings(false)}>
                      <X size={15} />
                    </button>
                  </div>
                  {activeSettingKey ? (
                    <div className="py-1.5">
                      <p className="px-4 py-1 text-white/30 text-xs uppercase tracking-wider">{activeSettingKey}</p>
                      {settingsMap[activeSettingKey].choices.map((c) => (
                        <button
                          key={c}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                          onClick={() => { settingsMap[activeSettingKey].onSelect(c); setActiveSettingKey(null); }}
                        >
                          {c}
                          {settingsMap[activeSettingKey].value === c && <Check size={13} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-1.5">
                      {Object.entries(settingsMap).map(([key, opt]) => (
                        <button
                          key={key}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                          onClick={() => setActiveSettingKey(key)}
                        >
                          <span className="text-white/80">{key}</span>
                          <span className="flex items-center gap-1 text-white/40 text-xs">
                            {opt.value} <ChevronRight size={11} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button aria-label="Picture in picture" className="text-white/70 hover:text-white transition-colors p-1" onClick={togglePip}>
            <PictureInPicture2 size={20} />
          </button>
          {/* Rotate button — only visible on phone screens */}
          <button
            aria-label={isLandscapeLocked ? "Unlock orientation" : "Rotate to landscape"}
            className={`sm:hidden transition-colors p-1 ${isLandscapeLocked ? "text-primary" : "text-white/70 hover:text-white"}`}
            onClick={toggleOrientation}
          >
            <RotateCw size={20} className={isLandscapeLocked ? "rotate-90" : ""} />
          </button>
          <button aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} className="text-white/70 hover:text-white transition-colors p-1" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Checkout (post-preview paywall) ────────────────────────────────────────
function CheckoutButton({ movie }: { movie: Movie }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3 rounded-xl transition-colors"
      >
        Buy Now
      </button>
      <CheckoutModal movie={movie} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ── Username gate ──────────────────────────────────────────────────────────
function UsernameGate({ onConfirm }: { onConfirm: (u: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex items-center justify-center p-6"
    >
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Play size={26} className="text-primary fill-current" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Ready to watch?</h2>
        <p className="text-white/50 text-sm mb-6">
          Enter your Telegram username to verify your purchase and start streaming.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); const v = val.trim(); if (v.length > 1) onConfirm(v); }}
          className="space-y-3"
        >
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="your_username"
            className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Watch Now
          </button>
        </form>
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function WatchMovie() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { username, save } = useSavedUsername();
  const [confirmed, setConfirmed] = useState(!!username);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [consumerUrl, setConsumerUrl] = useState<string | null>(null);
  const [consumerLoading, setConsumerLoading] = useState(false);
  const [consumerError, setConsumerError] = useState<string | null>(null);

  const { data: movie, isLoading } = useGetMovie(id!, {
    query: { enabled: !!id, queryKey: getGetMovieQueryKey(id!) },
  });
  const { data: moviesData } = useListMovies({ limit: 6 });
  const recommendations = (moviesData?.movies ?? []).filter((m) => m.id !== id).slice(0, 6);

  const streamUrl = `/api/stream/movie/${id}${username ? `?username=${encodeURIComponent(username)}` : ""}`;

  useEffect(() => { setVideoError(null); setShowPaywall(false); }, [id]);

  // Ask the backend up front whether this viewer has purchased the movie,
  // so the player knows to enforce the 20-minute free-preview cutoff.
  useEffect(() => {
    if (!id || !confirmed) return;
    let cancelled = false;
    const checkUrl = `/api/stream/movie/${id}?check=true${username ? `&username=${encodeURIComponent(username)}` : ""}`;
    fetch(checkUrl)
      .then((r) => r.json().catch(() => null))
      .then((body) => { if (!cancelled) setIsFreePreview(!!body?.freePreview); })
      .catch(() => { if (!cancelled) setIsFreePreview(false); });
    return () => { cancelled = true; };
  }, [id, confirmed, username]);

  const handleConfirm = (u: string) => { save(u); setConfirmed(true); };

  const hasExternal = !!(movie as any)?.tmdbId && !movie?.telegramFileId && !(movie as any)?.telegramMessageId;

  useEffect(() => {
    if (!id || !hasExternal) return;
    const tmdbId = (movie as any)?.tmdbId;
    if (!tmdbId) return;
    setConsumerLoading(true);
    setConsumerUrl(null);
    setConsumerError(null);
    let cancelled = false;
    fetchMovieStream(tmdbId)
      .then((stream) => { if (!cancelled) setConsumerUrl(stream.url); })
      .catch((err: Error) => { if (!cancelled) setConsumerError(err.message || "Stream not available"); })
      .finally(() => { if (!cancelled) setConsumerLoading(false); });
    return () => { cancelled = true; };
  }, [id, hasExternal]);

  const needsMtproto =
    videoError?.includes("MTProto") || videoError?.includes("large") ||
    videoError?.includes("20 MB") || videoError?.includes("Admin");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white/50">
        Movie not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col font-sans">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center gap-3 px-4 md:px-6 h-14 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => navigate(`/movie/${id}`)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ChevronLeft size={18} />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm md:text-base truncate">{movie.title}</h1>
          {movie.year && <p className="text-white/40 text-xs hidden sm:block">{movie.year} · {movie.quality}</p>}
        </div>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
            inWatchlist
              ? "bg-primary/20 text-primary border-primary/30"
              : "bg-white/5 text-white/60 hover:text-white border-white/10"
          }`}
          onClick={() => setInWatchlist((w) => !w)}
        >
          {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
          <span className="hidden sm:inline">{inWatchlist ? "Saved" : "Watchlist"}</span>
        </button>
      </nav>

      {/* ── Player area ──────────────────────────────────────────────────── */}
      {!hasExternal && !confirmed ? (
        <UsernameGate onConfirm={handleConfirm} />
      ) : videoError && !hasExternal ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-md text-center space-y-4">
            <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={26} className="text-destructive" />
            </div>
            <h2 className="text-white text-xl font-bold">Can't stream this movie</h2>
            <p className="text-white/50 text-sm leading-relaxed">{videoError}</p>
            {needsMtproto && (
              <a
                href="/admin/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <ExternalLink size={15} />
                Open Admin → Telegram Connect
              </a>
            )}
            <div>
              <button
                onClick={() => setVideoError(null)}
                className="text-white/40 hover:text-white/70 text-sm transition-colors underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        </motion.div>
      ) : showPaywall && !hasExternal ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-md text-center space-y-4">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Play size={26} className="text-primary" />
            </div>
            <h2 className="text-white text-xl font-bold">Free preview ended</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              You've watched your free 20-minute preview of {movie.title}. Buy now to keep watching and get it delivered on Telegram.
            </p>
            <CheckoutButton movie={movie} />
          </div>
        </motion.div>
      ) : (
        <>
          {/* Player */}
          <div className="w-full bg-black">
            {hasExternal ? (
              consumerLoading ? (
                <div className="flex items-center justify-center gap-3" style={{ aspectRatio: "16/9" }}>
                  <Loader2 className="animate-spin text-primary" size={36} />
                  <span className="text-white/50 text-sm">Finding stream…</span>
                </div>
              ) : consumerError ? (
                <div className="flex items-center justify-center flex-col gap-4" style={{ aspectRatio: "16/9" }}>
                  <AlertCircle size={28} className="text-destructive" />
                  <p className="text-white/50 text-sm text-center px-4">{consumerError}</p>
                  <button
                    onClick={() => {
                      const tmdbId = (movie as any)?.tmdbId;
                      if (!tmdbId) return;
                      setConsumerError(null); setConsumerLoading(true); setConsumerUrl(null);
                      fetchMovieStream(tmdbId)
                        .then((s) => setConsumerUrl(s.url))
                        .catch((e: Error) => setConsumerError(e.message || "Stream not available"))
                        .finally(() => setConsumerLoading(false));
                    }}
                    className="text-white/40 hover:text-white/70 text-sm underline underline-offset-2 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : consumerUrl ? (
                <VideoPlayer
                  src={consumerUrl}
                  poster={movie.bannerUrl || movie.posterUrl}
                  subtitleUrl={movie.subtitleUrl ?? undefined}
                  isExternal
                  isFreePreview={false}
                  onError={(msg) => setConsumerError(msg)}
                  onPreviewLimitReached={() => {}}
                  onBack={() => navigate(`/movie/${id}`)}
                />
              ) : null
            ) : (
              <VideoPlayer
                src={streamUrl}
                poster={movie.bannerUrl || movie.posterUrl}
                subtitleUrl={movie.subtitleUrl ?? undefined}
                isFreePreview={isFreePreview}
                onError={setVideoError}
                onPreviewLimitReached={() => setShowPaywall(true)}
                onBack={() => navigate(`/movie/${id}`)}
              />
            )}
          </div>

          {/* ── Content ─────────────────────────────────────────────────── */}
          <div className="max-w-7xl mx-auto w-full px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title & meta */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-white font-bold text-xl md:text-2xl">{movie.title}</h2>
                  {movie.rating && (
                    <span className="px-1.5 py-0.5 border border-white/20 rounded text-xs text-white/50">
                      {movie.rating}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/40">
                  {movie.year && <span>{movie.year}</span>}
                  {movie.rating && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="flex items-center gap-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span className="text-white/60 font-medium">{movie.rating}</span>
                      </span>
                    </>
                  )}
                  {movie.duration && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{movie.duration}</span>
                    </>
                  )}
                  {movie.quality && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="text-primary">{movie.quality}</span>
                    </>
                  )}
                </div>
                {movie.genre && movie.genre.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {movie.genre.map((g: string) => (
                      <span key={g} className="px-2.5 py-1 bg-white/[0.06] rounded-full text-xs text-white/60">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {movie.description && (
                  <p className="text-white/60 text-sm leading-relaxed">{movie.description}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setLiked((l) => !l)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    liked
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : "bg-white/[0.05] text-white/60 border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <Heart size={15} className={liked ? "fill-red-400" : ""} />
                  {liked ? "Liked" : "Like"}
                </button>
                <button
                  onClick={() => setInWatchlist((w) => !w)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    inWatchlist
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-white/[0.05] text-white/60 border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {inWatchlist ? <Check size={15} /> : <Plus size={15} />}
                  {inWatchlist ? "In Watchlist" : "Watchlist"}
                </button>
                <button
                  onClick={() => navigator.share?.({ title: movie.title, url: window.location.href }).catch(() => {})}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.05] text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                >
                  <Share2 size={15} />
                  Share
                </button>
                {movie.telegramFileId && (
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.05] text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                    <Download size={15} />
                    Download
                  </button>
                )}
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.05] text-white/50 border border-white/10 hover:border-red-500/20 hover:text-red-400 transition-all ml-auto">
                  <Flag size={14} />
                  Report
                </button>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 py-3 border-y border-white/[0.05] text-sm text-white/40">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} />
                  Streaming as <span className="text-white/60 font-medium">{username}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle size={14} />
                  Reviews & comments below
                </span>
                <button
                  onClick={() => { setConfirmed(false); setVideoError(null); }}
                  className="flex items-center gap-1.5 hover:text-white/60 transition-colors ml-auto"
                >
                  Switch account
                </button>
              </div>

              {/* Reviews */}
              <ReviewSection contentType="movie" contentId={id!} />
            </div>

            {/* Right column */}
            <div className="space-y-5">
              {/* File info */}
              {(movie.fileSize || movie.quality) && (
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] px-4 py-3 space-y-1">
                  <p className="text-white/40 text-xs uppercase tracking-wider">File Info</p>
                  {movie.quality && (
                    <p className="text-white/70 text-sm flex items-center justify-between">
                      <span>Quality</span><span className="text-primary font-medium">{movie.quality}</span>
                    </p>
                  )}
                  {movie.fileSize && (
                    <p className="text-white/70 text-sm flex items-center justify-between">
                      <span>Size</span><span className="text-white/50">{movie.fileSize}</span>
                    </p>
                  )}
                  {movie.duration && (
                    <p className="text-white/70 text-sm flex items-center justify-between">
                      <span>Runtime</span><span className="text-white/50">{movie.duration}</span>
                    </p>
                  )}
                </div>
              )}

              {/* More like this */}
              {recommendations.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3">More Like This</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {recommendations.map((m) => (
                      <Link key={m.id} href={`/movie/${m.id}`} className="group block cursor-pointer">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-800 mb-2">
                          <img
                            src={m.posterUrl}
                            alt={m.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                          {m.rating && (
                            <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5 text-xs text-amber-400 font-medium flex items-center gap-0.5">
                              <Star size={9} className="fill-amber-400" />
                              {m.rating}
                            </div>
                          )}
                        </div>
                        <p className="text-white/80 text-xs font-medium truncate group-hover:text-white transition-colors">
                          {m.title}
                        </p>
                        <p className="text-white/30 text-xs">{m.year}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
