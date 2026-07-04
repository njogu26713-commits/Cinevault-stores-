import { useParams, useLocation, Link } from "wouter";
import { useRef, useState, useEffect, useCallback } from "react";
import { useGetSeries, getGetSeriesQueryKey, useListSeries } from "@workspace/api-client-react";
import { ReviewSection } from "../components/review-section";
import {
  Loader2, ArrowLeft, AlertCircle, Play, Pause,
  Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward,
  Settings, PictureInPicture2, Heart, Plus, Share2,
  Flag, Star, Eye, MessageCircle, Check, Clock,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, RotateCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

// ── Continue watching ──────────────────────────────────────────────────────
function progressKey(id: string, sIdx: number, eIdx: number) {
  return `cv_progress_${id}_s${sIdx}_e${eIdx}`;
}

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

// ── Video Player ───────────────────────────────────────────────────────────
interface PlayerProps {
  src: string;
  poster?: string;
  subtitleUrl?: string;
  resumeAt?: number;
  progressKey: string;
  onError: (msg: string) => void;
}

function VideoPlayer({ src, poster, subtitleUrl, resumeAt, progressKey: pKey, onError }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => loadPref("cv_volume", 80));
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingKey, setActiveSettingKey] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);

  const [videoFit, setVideoFitState] = useState<"contain" | "cover" | "fill">(() => loadPref("cv_fit", "contain"));
  const [speed, setSpeedState] = useState<string>(() => loadPref("cv_speed", "1x"));
  const [subtitlesOn, setSubtitlesState] = useState<boolean>(() => loadPref("cv_subs", true));
  const [autoplayNext, setAutoplayNextState] = useState<boolean>(() => loadPref("cv_autoplay", true));
  const [skipIntro, setSkipIntroState] = useState<boolean>(() => loadPref("cv_skipintro", false));

  const setVideoFit = (v: "contain" | "cover" | "fill") => { setVideoFitState(v); savePref("cv_fit", v); };
  const setSpeed = (v: string) => {
    setSpeedState(v); savePref("cv_speed", v);
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

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Apply persisted settings on mount
    v.volume = volume / 100;
    v.playbackRate = parseFloat(speed);
    const onTime = () => {
      setProgress(v.currentTime);
      // Throttled progress save — at most once every 5 real seconds
      const now = Date.now();
      if (now - lastSaveRef.current > 5000) {
        savePref(pKey, Math.floor(v.currentTime));
        lastSaveRef.current = now;
      }
      // Buffer indicator
      if (v.buffered.length > 0) setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
    };
    const onDuration = () => {
      setDuration(v.duration);
      if (resumeAt && resumeAt > 10) v.currentTime = resumeAt;
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
  }, [pKey, resumeAt]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    Array.from(v.textTracks).forEach((t) => { t.mode = subtitlesOn ? "showing" : "hidden"; });
  }, [subtitlesOn]);

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
    setVolume(val); savePref("cv_volume", val);
    if (v) v.volume = val / 100;
    if (val > 0) setMuted(false);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted; setMuted(next); v.muted = next;
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
    document.pictureInPictureElement
      ? document.exitPictureInPicture().catch(() => {})
      : v.requestPictureInPicture().catch(() => {});
  };

  const fitLabel = videoFit === "contain" ? "Fit (Contain)" : videoFit === "cover" ? "Fill (Cover)" : "Stretch";
  const settingsMap: Record<string, { value: string; choices: string[]; onSelect: (v: string) => void }> = {
    "Video Fit": {
      value: fitLabel,
      choices: ["Fit (Contain)", "Fill (Cover)", "Stretch"],
      onSelect: (v) => setVideoFit(v === "Fit (Contain)" ? "contain" : v === "Fill (Cover)" ? "cover" : "fill"),
    },
    "Speed": { value: speed, choices: ["0.5x", "0.75x", "1x", "1.25x", "1.5x", "2x"], onSelect: setSpeed },
    "Subtitles": { value: subtitlesOn ? "On" : "Off", choices: ["On", "Off"], onSelect: (v) => setSubtitles(v === "On") },
    "Auto Play Next": { value: autoplayNext ? "On" : "Off", choices: ["On", "Off"], onSelect: (v) => setAutoplayNext(v === "On") },
    "Skip Intro": { value: skipIntro ? "On" : "Off", choices: ["On", "Off"], onSelect: (v) => setSkipIntro(v === "On") },
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
        src={src}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: videoFit === "contain" ? "contain" : videoFit === "cover" ? "cover" : "fill" }}
        crossOrigin="anonymous"
        playsInline
        poster={poster}
        onError={(e) => {
          e.preventDefault(); e.stopPropagation();
          const code = e.currentTarget.error?.code;
          onError(
            code === 4
              ? "This episode can't be streamed. The file may be too large. Connect the Telegram MTProto account in admin to enable large file streaming."
              : `Playback error (code ${code ?? "unknown"}).`
          );
        }}
      >
        {subtitleUrl && <track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />}
      </video>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

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
        <div className="px-4 pb-2">
          <div
            className="relative h-1 bg-white/20 rounded-full cursor-pointer group/bar hover:h-1.5 transition-all duration-150"
            onClick={seek}
          >
            <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: `${buffered}%` }} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPct}% - 6px)` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pb-4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
          <button aria-label={playing ? "Pause" : "Play"} className="text-white/90 hover:text-white transition-colors p-1" onClick={togglePlay}>
            {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button aria-label="Rewind 10 seconds" className="text-white/70 hover:text-white transition-colors p-1" onClick={() => skip(-10)}>
            <SkipBack size={20} />
          </button>
          <button aria-label="Skip forward 10 seconds" className="text-white/70 hover:text-white transition-colors p-1" onClick={() => skip(10)}>
            <SkipForward size={20} />
          </button>
          <div className="flex items-center gap-1 group/vol">
            <button aria-label={muted || volume === 0 ? "Unmute" : "Mute"} className="text-white/70 hover:text-white transition-colors p-1" onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
              <input type="range" min={0} max={100} value={muted ? 0 : volume}
                onChange={(e) => changeVolume(+e.target.value)} className="w-20 cursor-pointer accent-primary" />
            </div>
          </div>
          <span className="text-white/50 text-xs font-mono tabular-nums">
            {fmt(progress)} / {duration ? fmt(duration) : "--:--"}
          </span>

          <div className="flex-1" />

          {/* Settings */}
          <div className="relative">
            <button
              aria-label="Settings"
              className={`text-white/70 hover:text-white transition-colors p-1 ${showSettings ? "text-white" : ""}`}
              onClick={(e) => { e.stopPropagation(); setShowSettings((s) => !s); setActiveSettingKey(null); }}
            >
              <Settings size={20} className={`transition-transform duration-300 ${showSettings ? "rotate-45" : ""}`} />
            </button>
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
                      <button className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors" onClick={() => setActiveSettingKey(null)}>
                        <ArrowLeft size={14} /> Back
                      </button>
                    ) : (
                      <span className="text-white text-sm font-semibold">Settings</span>
                    )}
                    <button className="text-white/40 hover:text-white/70" onClick={() => setShowSettings(false)}><X size={15} /></button>
                  </div>
                  {activeSettingKey ? (
                    <div className="py-1.5">
                      <p className="px-4 py-1 text-white/30 text-xs uppercase tracking-wider">{activeSettingKey}</p>
                      {settingsMap[activeSettingKey].choices.map((c) => (
                        <button key={c} className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                          onClick={() => { settingsMap[activeSettingKey].onSelect(c); setActiveSettingKey(null); }}>
                          {c}
                          {settingsMap[activeSettingKey].value === c && <Check size={13} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-1.5">
                      {Object.entries(settingsMap).map(([key, opt]) => (
                        <button key={key} className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                          onClick={() => setActiveSettingKey(key)}>
                          <span className="text-white/80">{key}</span>
                          <span className="flex items-center gap-1 text-white/40 text-xs">{opt.value} <ChevronRight size={11} /></span>
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

// ── Episode List ────────────────────────────────────────────────────────────
interface EpisodeListProps {
  seasons: any[];
  currentSIdx: number;
  currentEIdx: number;
  seriesId: string;
}

function EpisodeList({ seasons, currentSIdx, currentEIdx, seriesId }: EpisodeListProps) {
  const [openSeason, setOpenSeason] = useState(currentSIdx);

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] overflow-hidden">
      {seasons.map((season, sIdx) => (
        <div key={sIdx} className={sIdx > 0 ? "border-t border-white/[0.06]" : ""}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
            onClick={() => setOpenSeason(openSeason === sIdx ? -1 : sIdx)}
          >
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold text-sm">Season {season.seasonNumber}</span>
              <span className="text-white/30 text-xs">· {season.episodes.length} Episodes</span>
            </div>
            {openSeason === sIdx
              ? <ChevronUp size={16} className="text-white/40" />
              : <ChevronDown size={16} className="text-white/40" />
            }
          </button>

          {openSeason === sIdx && (
            <div className="border-t border-white/[0.06]">
              {season.episodes.map((ep: any, eIdx: number) => {
                const isCurrent = sIdx === currentSIdx && eIdx === currentEIdx;
                const savedTime = loadPref<number>(`cv_progress_${seriesId}_s${sIdx}_e${eIdx}`, 0);
                const savedPct = ep.duration && savedTime > 0
                  ? Math.min((savedTime / (parseInt(ep.duration) * 60)) * 100, 100)
                  : 0;

                return (
                  <Link
                    key={eIdx}
                    href={`/watch/episode/${seriesId}/${sIdx}/${eIdx}`}
                    className={`flex items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.04] ${isCurrent ? "bg-white/[0.05]" : ""}`}
                  >
                    <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-zinc-800">
                      {ep.thumbnailUrl ? (
                        <img src={ep.thumbnailUrl} alt={ep.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play size={16} className="text-white/30" />
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="w-7 h-7 rounded-full bg-primary/90 flex items-center justify-center">
                            <Play size={12} className="fill-white text-white ml-0.5" />
                          </div>
                        </div>
                      )}
                      {savedPct > 0 && !isCurrent && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                          <div className="h-full bg-primary" style={{ width: `${savedPct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${isCurrent ? "text-primary" : "text-white/50"}`}>
                          E{ep.episodeNumber}
                        </span>
                        <span className="text-white/70 text-sm truncate">{ep.title}</span>
                      </div>
                      {ep.duration && <span className="text-white/30 text-xs">{ep.duration}</span>}
                    </div>
                    {savedPct > 90 && <Check size={13} className="text-white/25 shrink-0" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
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
          Enter your Telegram username to start streaming this episode.
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
          <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-colors">
            Watch Now
          </button>
        </form>
      </div>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function WatchEpisode() {
  const { id, seasonIdx, episodeIdx } = useParams<{ id: string; seasonIdx: string; episodeIdx: string }>();
  const [, navigate] = useLocation();
  const { username, save } = useSavedUsername();
  const [confirmed, setConfirmed] = useState(!!username);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);

  const sIdx = Number(seasonIdx);
  const eIdx = Number(episodeIdx);

  const { data: series, isLoading } = useGetSeries(id!, {
    query: { enabled: !!id, queryKey: getGetSeriesQueryKey(id!) },
  });
  const { data: seriesListData } = useListSeries({ limit: 6 });
  const recommendations = (seriesListData?.series ?? []).filter((s) => s.id !== id).slice(0, 6);

  const season = series?.seasons?.[sIdx];
  const episode = season?.episodes?.[eIdx];
  const prevEpisode = season?.episodes?.[eIdx - 1];
  const nextEpisode = season?.episodes?.[eIdx + 1];

  const savedProgress = loadPref<number>(progressKey(id!, sIdx, eIdx), 0);
  const streamUrl = `/api/stream/episode/${id}/${sIdx}/${eIdx}${username ? `?username=${encodeURIComponent(username)}` : ""}`;

  useEffect(() => { setVideoError(null); }, [id, seasonIdx, episodeIdx]);

  const handleConfirm = (u: string) => { save(u); setConfirmed(true); };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!series || !episode) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white/50">
        Episode not found.
      </div>
    );
  }

  const epLabel = `S${String(season!.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col font-sans">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center gap-3 px-4 md:px-6 h-14 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <button
          onClick={() => navigate(`/series/${id}`)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ChevronLeft size={18} />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm md:text-base truncate">{series.title}</h1>
          <p className="text-white/40 text-xs hidden sm:block">{epLabel} — {episode.title}</p>
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

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!confirmed ? (
        <UsernameGate onConfirm={handleConfirm} />
      ) : videoError ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={26} className="text-destructive" />
            </div>
            <h2 className="text-white text-xl font-bold">Can't stream this episode</h2>
            <p className="text-white/50 text-sm leading-relaxed">{videoError}</p>
            <button
              onClick={() => setVideoError(null)}
              className="text-white/40 hover:text-white/70 text-sm transition-colors underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Player */}
          <div className="w-full bg-black">
            <VideoPlayer
              src={streamUrl}
              poster={series.bannerUrl || series.posterUrl}
              subtitleUrl={episode.subtitleUrl ?? undefined}
              resumeAt={savedProgress}
              progressKey={progressKey(id!, sIdx, eIdx)}
              onError={setVideoError}
            />
          </div>

          {/* Episode nav bar */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.05] bg-zinc-900/30">
            <div>
              {prevEpisode ? (
                <button
                  onClick={() => navigate(`/watch/episode/${id}/${sIdx}/${eIdx - 1}`)}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors group"
                >
                  <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                  <span className="hidden sm:inline truncate max-w-[140px]">E{prevEpisode.episodeNumber}: {prevEpisode.title}</span>
                  <span className="sm:hidden">Prev</span>
                </button>
              ) : <div />}
            </div>
            <div className="flex items-center gap-2 text-white/30 text-xs">
              <Clock size={12} />
              <span>{epLabel} · Episode {eIdx + 1} of {season!.episodes.length}</span>
            </div>
            <div>
              {nextEpisode ? (
                <button
                  onClick={() => navigate(`/watch/episode/${id}/${sIdx}/${eIdx + 1}`)}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors group"
                >
                  <span className="hidden sm:inline truncate max-w-[140px]">E{nextEpisode.episodeNumber}: {nextEpisode.title}</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : <div />}
            </div>
          </div>

          {/* Body */}
          <div className="max-w-7xl mx-auto w-full px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Episode info */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-primary text-sm font-semibold">{epLabel}</span>
                  <h2 className="text-white font-bold text-xl md:text-2xl">{episode.title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/40">
                  <span className="font-semibold text-white/70">{series.title}</span>
                  {series.year && <><span className="w-1 h-1 rounded-full bg-white/20" /><span>{series.year}</span></>}
                  {series.rating && (
                    <><span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="flex items-center gap-1">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      <span className="text-white/60 font-medium">{series.rating}</span>
                    </span></>
                  )}
                  {episode.duration && <><span className="w-1 h-1 rounded-full bg-white/20" /><span>{episode.duration}</span></>}
                </div>
                {series.genre && series.genre.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {series.genre.map((g: string) => (
                      <span key={g} className="px-2.5 py-1 bg-white/[0.06] rounded-full text-xs text-white/60">{g}</span>
                    ))}
                  </div>
                )}
                {series.description && (
                  <p className="text-white/50 text-sm leading-relaxed">{series.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setLiked((l) => !l)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    liked ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-white/[0.05] text-white/60 border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <Heart size={15} className={liked ? "fill-red-400" : ""} />
                  {liked ? "Liked" : "Like"}
                </button>
                <button
                  onClick={() => setInWatchlist((w) => !w)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    inWatchlist ? "bg-primary/10 text-primary border-primary/30" : "bg-white/[0.05] text-white/60 border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {inWatchlist ? <Check size={15} /> : <Plus size={15} />}
                  {inWatchlist ? "In Watchlist" : "Watchlist"}
                </button>
                <button
                  onClick={() => navigator.share?.({ title: `${series.title} — ${episode.title}`, url: window.location.href }).catch(() => {})}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.05] text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                >
                  <Share2 size={15} />
                  Share
                </button>
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
                  Reviews below
                </span>
                <button
                  onClick={() => { setConfirmed(false); setVideoError(null); }}
                  className="flex items-center gap-1.5 hover:text-white/60 transition-colors ml-auto"
                >
                  Switch account
                </button>
              </div>

              {/* Reviews (per-series) */}
              <ReviewSection contentType="series" contentId={id!} />
            </div>

            {/* Right column */}
            <div className="space-y-5">
              {/* Continue watching */}
              {savedProgress > 30 && (
                <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 flex items-center gap-3">
                  <Clock size={16} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">Progress saved</p>
                    <p className="text-white/50 text-xs">Resumed from {fmt(savedProgress)}</p>
                  </div>
                </div>
              )}

              {/* Episode list */}
              {series.seasons && series.seasons.length > 0 && (
                <EpisodeList
                  seasons={series.seasons}
                  currentSIdx={sIdx}
                  currentEIdx={eIdx}
                  seriesId={id!}
                />
              )}

              {/* More like this */}
              {recommendations.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3">More Series</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {recommendations.map((s) => (
                      <Link key={s.id} href={`/series/${s.id}`} className="group block">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-800 mb-2">
                          <img
                            src={s.posterUrl}
                            alt={s.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                          {s.rating && (
                            <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5 text-xs text-amber-400 font-medium flex items-center gap-0.5">
                              <Star size={9} className="fill-amber-400" />
                              {s.rating}
                            </div>
                          )}
                        </div>
                        <p className="text-white/80 text-xs font-medium truncate group-hover:text-white transition-colors">{s.title}</p>
                        <p className="text-white/30 text-xs">{s.year}</p>
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
