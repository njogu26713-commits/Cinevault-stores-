import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../lib/logger";

const router = Router();

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/original";
const TMDB_IMG_W500 = "https://image.tmdb.org/t/p/w500";

function tmdbKey(): string {
  const k = process.env["TMDB_API_KEY"];
  if (!k) throw new Error("TMDB_API_KEY not configured");
  return k;
}

async function tmdbGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", tmdbKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDb error ${res.status}: ${path}`);
  return res.json();
}

function ytUrl(key: string) {
  return `https://www.youtube.com/watch?v=${key}`;
}

function stripMd(text: string): string {
  return text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}

async function aiEnrich(data: any, type: "movie" | "series") {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return {};

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a content strategist for CineVault, a Kenyan movie streaming marketplace.

Given this ${type === "movie" ? "movie" : "TV series"} data:
Title: ${data.title}
Overview: ${data.overview}
Genres: ${(data.genres || []).join(", ")}
Year: ${data.year}
Rating: ${data.rating}
Runtime: ${data.runtime || "N/A"}
Cast: ${(data.cast || []).slice(0, 5).join(", ")}

Return ONLY valid JSON (no markdown fences) with these exact keys:
{
  "seoDescription": "2-3 sentence SEO-friendly description highlighting what makes this ${type === "movie" ? "movie" : "series"} compelling for Kenyan audiences",
  "keywords": ["keyword1", "keyword2", "...up to 10 relevant search keywords"],
  "suggestedPriceKes": <number: suggested selling price in KES — movies 100-500, series 200-800 per season based on popularity/quality>,
  "featured": <boolean: true if this is a blockbuster/top-rated title worth featuring>,
  "trending": <boolean: true if this is recent (last 2 years) and popular>,
  "priceRationale": "one sentence explaining the price suggestion"
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = stripMd(result.response.text());
    return JSON.parse(raw);
  } catch (e) {
    logger.warn({ e }, "AI enrichment failed");
    return {};
  }
}

// ── POST /admin/research ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { title, type = "movie" } = req.body ?? {};

  if (!title) return res.status(400).json({ error: "title is required" });
  if (!process.env["TMDB_API_KEY"]) {
    return res.status(503).json({ error: "TMDB_API_KEY not configured. Add it in your Secrets." });
  }

  try {
    if (type === "movie") {
      // 1. Search
      const search = await tmdbGet("/search/movie", { query: title, language: "en-US" });
      if (!search.results?.length) return res.status(404).json({ error: `No results found for "${title}"` });

      const hit = search.results[0];
      const id = hit.id;

      // 2. Details + credits + videos + keywords + release_dates
      const [details, credits, videos, keywords, releases] = await Promise.all([
        tmdbGet(`/movie/${id}`, { language: "en-US", append_to_response: "credits,videos,keywords,release_dates" }),
        tmdbGet(`/movie/${id}/credits`),
        tmdbGet(`/movie/${id}/videos`, { language: "en-US" }),
        tmdbGet(`/movie/${id}/keywords`),
        tmdbGet(`/movie/${id}/release_dates`),
      ]);

      // Trailer
      const trailer = videos.results?.find((v: any) => v.type === "Trailer" && v.site === "YouTube")
        || videos.results?.find((v: any) => v.site === "YouTube");

      // Director
      const director = credits.crew?.find((c: any) => c.job === "Director");

      // Cast (top 8)
      const cast = credits.cast?.slice(0, 8).map((c: any) => c.name) ?? [];

      // Age rating (US)
      const usRating = releases.results?.find((r: any) => r.iso_3166_1 === "US");
      const ageRating = usRating?.release_dates?.[0]?.certification || "";

      // Genres
      const genres = details.genres?.map((g: any) => g.name) ?? [];

      // Production company
      const productionCompany = details.production_companies?.[0]?.name || "";

      // Runtime
      const runtime = details.runtime ? `${details.runtime}m` : "";

      // IMDb ID for reference
      const imdbId = details.imdb_id || "";

      const data: any = {
        title: details.title,
        originalTitle: details.original_title !== details.title ? details.original_title : "",
        overview: details.overview,
        posterUrl: details.poster_path ? `${TMDB_IMG_W500}${details.poster_path}` : "",
        bannerUrl: details.backdrop_path ? `${TMDB_IMG}${details.backdrop_path}` : "",
        genres,
        releaseDate: details.release_date,
        year: details.release_date ? new Date(details.release_date).getFullYear() : null,
        runtime,
        tmdbRating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : null,
        tmdbVoteCount: details.vote_count,
        imdbId,
        cast,
        director: director?.name || "",
        language: details.original_language?.toUpperCase() || "",
        country: details.production_countries?.[0]?.name || "",
        trailerUrl: trailer ? ytUrl(trailer.key) : "",
        youtubeTrailerId: trailer?.key || "",
        productionCompany,
        ageRating,
        status: details.status,
        tagline: details.tagline || "",
        keywords: keywords.keywords?.map((k: any) => k.name) ?? [],
        type: "movie",
      };

      // AI enrichment
      const ai = await aiEnrich(data, "movie");

      return res.json({ ...data, ai });
    } else {
      // TV Series
      const search = await tmdbGet("/search/tv", { query: title, language: "en-US" });
      if (!search.results?.length) return res.status(404).json({ error: `No results found for "${title}"` });

      const hit = search.results[0];
      const id = hit.id;

      const [details, credits, videos, keywords] = await Promise.all([
        tmdbGet(`/tv/${id}`, { language: "en-US" }),
        tmdbGet(`/tv/${id}/credits`),
        tmdbGet(`/tv/${id}/videos`, { language: "en-US" }),
        tmdbGet(`/tv/${id}/keywords`),
      ]);

      // Seasons (fetch details for each season)
      const seasonCount = details.number_of_seasons || 0;
      const seasonNums = Array.from({ length: Math.min(seasonCount, 10) }, (_, i) => i + 1);
      const seasonsData = await Promise.all(
        seasonNums.map(n => tmdbGet(`/tv/${id}/season/${n}`, { language: "en-US" }).catch(() => null))
      );

      const seasons = seasonsData
        .filter(Boolean)
        .map((s: any) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episodes?.length ?? 0,
          episodes: (s.episodes ?? []).map((e: any) => ({
            episodeNumber: e.episode_number,
            title: e.name,
            duration: e.runtime ? `${e.runtime}m` : "",
            overview: e.overview,
            airDate: e.air_date,
            telegramFileId: "",
          })),
        }))
        .filter(s => s.seasonNumber > 0);

      const trailer = videos.results?.find((v: any) => v.type === "Trailer" && v.site === "YouTube")
        || videos.results?.find((v: any) => v.site === "YouTube");

      const cast = credits.cast?.slice(0, 8).map((c: any) => c.name) ?? [];
      const creators = details.created_by?.map((c: any) => c.name) ?? [];
      const genres = details.genres?.map((g: any) => g.name) ?? [];

      const data: any = {
        title: details.name,
        originalTitle: details.original_name !== details.name ? details.original_name : "",
        overview: details.overview,
        posterUrl: details.poster_path ? `${TMDB_IMG_W500}${details.poster_path}` : "",
        bannerUrl: details.backdrop_path ? `${TMDB_IMG}${details.backdrop_path}` : "",
        genres,
        releaseDate: details.first_air_date,
        year: details.first_air_date ? new Date(details.first_air_date).getFullYear() : null,
        runtime: details.episode_run_time?.[0] ? `${details.episode_run_time[0]}m` : "",
        tmdbRating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : null,
        tmdbVoteCount: details.vote_count,
        cast,
        creators,
        language: details.original_language?.toUpperCase() || "",
        country: details.origin_country?.[0] || "",
        trailerUrl: trailer ? ytUrl(trailer.key) : "",
        youtubeTrailerId: trailer?.key || "",
        productionCompany: details.production_companies?.[0]?.name || "",
        status: details.status,
        numberOfSeasons: details.number_of_seasons,
        numberOfEpisodes: details.number_of_episodes,
        keywords: keywords.results?.map((k: any) => k.name) ?? [],
        seasons,
        type: "series",
      };

      const ai = await aiEnrich(data, "series");
      return res.json({ ...data, ai });
    }
  } catch (err: any) {
    logger.error({ err }, "Research failed");
    return res.status(500).json({ error: err.message || "Research failed" });
  }
});

export default router;
