import { Router } from "express";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";
import { logger } from "../lib/logger";

const router = Router();

const CONSUMET_BASE = (process.env["CONSUMET_API_URL"] || "https://api.consumet.org").replace(/\/$/, "");

interface FlixHQResult {
  id: string;
  title: string;
  releaseDate?: string;
  type?: string;
}

interface FlixHQEpisode {
  id: string;
  title?: string;
  season?: number;
  number?: number;
  episode?: number;
}

interface StreamSource {
  url: string;
  quality?: string;
  isM3U8?: boolean;
}

async function searchFlixHQ(title: string): Promise<FlixHQResult | null> {
  const url = `${CONSUMET_BASE}/movies/flixhq/${encodeURIComponent(title)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`FlixHQ search failed: ${res.status}`);
  const data = (await res.json()) as { results?: FlixHQResult[] };
  return data.results?.[0] ?? null;
}

async function getFlixHQInfo(mediaId: string): Promise<{ episodes?: FlixHQEpisode[] }> {
  const url = `${CONSUMET_BASE}/movies/flixhq/info?id=${encodeURIComponent(mediaId)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`FlixHQ info failed: ${res.status}`);
  return (await res.json()) as { episodes?: FlixHQEpisode[] };
}

async function getFlixHQStream(episodeId: string, mediaId: string): Promise<StreamSource | null> {
  const url = `${CONSUMET_BASE}/movies/flixhq/watch?episodeId=${encodeURIComponent(episodeId)}&mediaId=${encodeURIComponent(mediaId)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`FlixHQ watch failed: ${res.status}`);
  const data = (await res.json()) as { sources?: StreamSource[] };
  const sources = data.sources ?? [];
  return (
    sources.find((s) => s.quality === "1080p") ??
    sources.find((s) => s.quality === "720p") ??
    sources[0] ??
    null
  );
}

// ── GET /api/consumet/movie/:id ─────────────────────────────────────────────
router.get("/movie/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).lean();
    if (!movie) return res.status(404).json({ error: "Movie not found" });

    const match = await searchFlixHQ(movie.title);
    if (!match) return res.status(404).json({ error: `"${movie.title}" not found on streaming service` });

    const info = await getFlixHQInfo(match.id);
    const episode = info.episodes?.[0];
    if (!episode) return res.status(404).json({ error: "No stream episode found" });

    const source = await getFlixHQStream(episode.id, match.id);
    if (!source) return res.status(404).json({ error: "No stream sources available" });

    return res.json({ url: source.url, quality: source.quality, isM3U8: source.isM3U8 ?? true });
  } catch (err: any) {
    logger.error({ err }, "Consumet movie stream failed");
    return res.status(503).json({ error: err.message || "Streaming service unavailable" });
  }
});

// ── GET /api/consumet/tv/:id/:season/:episode ───────────────────────────────
router.get("/tv/:id/:season/:episode", async (req, res) => {
  try {
    const { id, season, episode } = req.params;
    const sNum = Number(season);
    const eNum = Number(episode);

    const series = await Series.findById(id).lean();
    if (!series) return res.status(404).json({ error: "Series not found" });

    const match = await searchFlixHQ(series.title);
    if (!match) return res.status(404).json({ error: `"${series.title}" not found on streaming service` });

    const info = await getFlixHQInfo(match.id);
    const ep = (info.episodes ?? []).find(
      (e) => e.season === sNum && (e.number === eNum || e.episode === eNum)
    );
    if (!ep) return res.status(404).json({ error: `Season ${sNum} Episode ${eNum} not found` });

    const source = await getFlixHQStream(ep.id, match.id);
    if (!source) return res.status(404).json({ error: "No stream sources available" });

    return res.json({ url: source.url, quality: source.quality, isM3U8: source.isM3U8 ?? true });
  } catch (err: any) {
    logger.error({ err }, "Consumet TV stream failed");
    return res.status(503).json({ error: err.message || "Streaming service unavailable" });
  }
});

export default router;
