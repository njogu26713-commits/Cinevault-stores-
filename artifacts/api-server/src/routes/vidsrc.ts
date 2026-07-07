/**
 * Backend proxy for the CineVault VidSrc API.
 * Looks up a movie/series tmdbId from the DB, then fetches a stream URL
 * from the deployed VidSrc proxy (VIDSRC_API_URL).
 *
 * Routes:
 *   GET /api/vidsrc/movie/:id   — CineVault movie _id → stream URL
 *   GET /api/vidsrc/tv/:id/:season/:episode — CineVault series _id → stream URL
 */

import { Router } from "express";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";
import { logger } from "../lib/logger";

const router = Router();

const VIDSRC_BASE = (process.env["VIDSRC_API_URL"] || "https://cinevault-vidsrc.vercel.app").replace(/\/$/, "");

interface StreamSource {
  url: string;
  quality?: string;
  isM3U8?: boolean;
}

function pickBest(data: Record<string, unknown>): StreamSource | null {
  if (typeof data.url === "string" && data.url) {
    return { url: data.url, quality: data.quality as string | undefined, isM3U8: (data.isM3U8 as boolean | undefined) ?? data.url.includes(".m3u8") };
  }
  if (typeof data.stream_url === "string" && data.stream_url) {
    return { url: data.stream_url, isM3U8: data.stream_url.includes(".m3u8") };
  }
  if (Array.isArray(data.sources) && data.sources.length > 0) {
    const sources = data.sources as StreamSource[];
    return sources.find((s) => s.quality === "1080p") ?? sources.find((s) => s.quality === "720p") ?? sources[0] ?? null;
  }
  return null;
}

async function fetchStream(path: string): Promise<StreamSource> {
  const res = await fetch(`${VIDSRC_BASE}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`VidSrc proxy returned ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  const stream = pickBest(data);
  if (!stream) throw new Error("No stream URL in VidSrc response");
  return stream;
}

// GET /api/vidsrc/movie/:id
router.get("/movie/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).lean();
    if (!movie) return res.status(404).json({ error: "Movie not found" });
    const tmdbId = (movie as Record<string, unknown>).tmdbId;
    if (!tmdbId) return res.status(404).json({ error: "Movie has no TMDB ID" });

    const stream = await fetchStream(`/api/movie?id=${tmdbId}`);
    return res.json(stream);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Streaming service unavailable";
    logger.error({ err }, "VidSrc movie stream failed");
    return res.status(503).json({ error: msg });
  }
});

// GET /api/vidsrc/tv/:id/:season/:episode
router.get("/tv/:id/:season/:episode", async (req, res) => {
  try {
    const { id, season, episode } = req.params;
    const series = await Series.findById(id).lean();
    if (!series) return res.status(404).json({ error: "Series not found" });
    const tmdbId = (series as Record<string, unknown>).tmdbId;
    if (!tmdbId) return res.status(404).json({ error: "Series has no TMDB ID" });

    const stream = await fetchStream(`/api/tv?id=${tmdbId}&s=${season}&e=${episode}`);
    return res.json(stream);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Streaming service unavailable";
    logger.error({ err }, "VidSrc TV stream failed");
    return res.status(503).json({ error: msg });
  }
});

export default router;
