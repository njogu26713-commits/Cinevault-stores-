import { useParams, useLocation } from "wouter";
import { useRef, useState, useEffect } from "react";
import { useGetMovie, getGetMovieQueryKey } from "@workspace/api-client-react";
import { Layout } from "../components/layout";
import { Loader2, ArrowLeft, AlertCircle, Play, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";

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

export default function WatchMovie() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { username, save } = useSavedUsername();
  const [inputVal, setInputVal] = useState(username.replace(/^@/, ""));
  const [confirmed, setConfirmed] = useState(!!username);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: movie, isLoading } = useGetMovie(id!, {
    query: { enabled: !!id, queryKey: getGetMovieQueryKey(id!) },
  });

  const streamUrl = `/api/stream/movie/${id}${username ? `?username=${encodeURIComponent(username)}` : ""}`;

  useEffect(() => {
    setVideoError(null);
    setPlaying(false);
  }, [id]);

  const handleConfirmUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputVal.trim();
    if (val.length > 1) {
      save(val);
      setConfirmed(true);
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

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
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Movie not found.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full min-h-screen bg-black flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-4 px-4 py-3 bg-black/80 backdrop-blur border-b border-white/10">
          <button
            onClick={() => navigate(`/movie/${id}`)}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg truncate">{movie.title}</h1>
            <p className="text-white/50 text-xs">{movie.year} · {movie.quality} · {movie.duration}</p>
          </div>
          <button
            onClick={toggleFullscreen}
            className="text-white/60 hover:text-white transition-colors"
            title="Fullscreen"
          >
            <Maximize2 size={18} />
          </button>
        </div>

        {/* Username gate */}
        {!confirmed ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <Play size={26} className="text-primary fill-current" />
              </div>
              <h2 className="text-white text-xl font-bold mb-2">Ready to watch?</h2>
              <p className="text-white/50 text-sm mb-6">
                Enter your Telegram username to verify your purchase and start streaming.
              </p>
              <form onSubmit={handleConfirmUsername} className="space-y-3">
                <input
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
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
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-black p-4">
            {videoError ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-lg text-center"
              >
                <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-5">
                  <AlertCircle size={26} className="text-destructive" />
                </div>
                <h2 className="text-white text-xl font-bold mb-2">Can't stream this movie</h2>
                <p className="text-white/50 text-sm mb-6">{videoError}</p>
                {videoError.includes("MTProto") || videoError.includes("large") ? (
                  <p className="text-white/30 text-xs">
                    The admin needs to connect the Telegram MTProto account in the admin panel
                    to enable streaming for large video files.
                  </p>
                ) : (
                  <button
                    onClick={() => navigate(`/movie/${id}`)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 px-6 rounded-xl transition-colors"
                  >
                    Go back
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="w-full max-w-5xl">
                {!playing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative rounded-2xl overflow-hidden aspect-video bg-zinc-900 mb-4 cursor-pointer group"
                    onClick={() => {
                      setPlaying(true);
                      setTimeout(() => videoRef.current?.play(), 100);
                    }}
                  >
                    <img
                      src={movie.bannerUrl || movie.posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover opacity-40"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 bg-white/10 group-hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors border border-white/20">
                        <Play size={36} className="text-white fill-white ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white font-bold text-xl">{movie.title}</p>
                      <p className="text-white/60 text-sm">{movie.duration} · {movie.quality}</p>
                    </div>
                  </motion.div>
                )}

                {playing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl overflow-hidden aspect-video bg-black"
                  >
                    <video
                      ref={videoRef}
                      src={streamUrl}
                      controls
                      autoPlay
                      className="w-full h-full"
                      onError={(e) => {
                        const vid = e.currentTarget;
                        const code = vid.error?.code;
                        if (code === 4) {
                          setVideoError(
                            "This movie can't be streamed directly. The file may be too large for the Bot API. Connect the Telegram MTProto account in the admin panel to stream large files."
                          );
                        } else {
                          setVideoError(
                            `Playback error (code ${code ?? "unknown"}). Make sure the movie file is attached and try again.`
                          );
                        }
                        setPlaying(false);
                      }}
                      style={{ display: "block" }}
                    />
                  </motion.div>
                )}

                <div className="mt-4 flex items-center justify-between text-white/40 text-xs px-1">
                  <span>Streaming as <span className="text-white/60 font-medium">{username}</span></span>
                  <button
                    onClick={() => { setConfirmed(false); setPlaying(false); }}
                    className="hover:text-white/60 transition-colors"
                  >
                    Switch account
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
