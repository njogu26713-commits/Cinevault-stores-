/**
 * CineVault VidSrc API client
 * Calls the deployed proxy at VITE_VIDSRC_API_URL directly from the browser.
 *
 * Expected endpoints (adjust if your proxy uses different paths):
 *   GET /api/movie?id={TMDB_ID}
 *   GET /api/tv?id={TMDB_ID}&s={season}&e={episode}
 *
 * Expected response shape (any of the following is handled):
 *   { url: "...", quality?: "1080p", isM3U8?: true }
 *   { stream_url: "..." }
 *   { sources: [{ url: "...", quality?: "1080p" }] }
 */

const BASE = ((import.meta.env.VITE_VIDSRC_API_URL as string) || "https://cinevault-vidsrc.vercel.app").replace(/\/$/, "");

export interface VidsrcStream {
  url: string;
  quality?: string;
  isM3U8?: boolean;
}

/** Pick the best source from whatever shape the proxy returns. */
function pickBest(data: Record<string, unknown>): VidsrcStream | null {
  // { url: "..." }
  if (typeof data.url === "string" && data.url) {
    return { url: data.url, quality: data.quality as string | undefined, isM3U8: (data.isM3U8 as boolean | undefined) ?? data.url.includes(".m3u8") };
  }
  // { stream_url: "..." }
  if (typeof data.stream_url === "string" && data.stream_url) {
    return { url: data.stream_url, isM3U8: data.stream_url.includes(".m3u8") };
  }
  // { sources: [...] }
  if (Array.isArray(data.sources) && data.sources.length > 0) {
    const sources = data.sources as VidsrcStream[];
    const best = sources.find((s) => s.quality === "1080p") ?? sources.find((s) => s.quality === "720p") ?? sources[0];
    if (best?.url) return { ...best, isM3U8: best.isM3U8 ?? best.url.includes(".m3u8") };
  }
  return null;
}

async function apiFetch(path: string): Promise<VidsrcStream> {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    let msg = `Stream fetch failed (${res.status})`;
    try { const body = await res.json() as Record<string, unknown>; msg = (body.error as string) || (body.message as string) || msg; } catch { /* keep generic msg */ }
    throw new Error(msg);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const stream = pickBest(data);
  if (!stream) throw new Error("No stream URL returned by streaming service");
  return stream;
}

/** Fetch a movie stream by TMDB ID. */
export function fetchMovieStream(tmdbId: string | number): Promise<VidsrcStream> {
  return apiFetch(`/api/movie?id=${tmdbId}`);
}

/** Fetch a TV episode stream by TMDB ID + season/episode numbers. */
export function fetchTvStream(tmdbId: string | number, season: number, episode: number): Promise<VidsrcStream> {
  return apiFetch(`/api/tv?id=${tmdbId}&s=${season}&e=${episode}`);
}
