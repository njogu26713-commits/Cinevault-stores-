import { Router } from "express";
import axios from "axios";
import mongoose from "mongoose";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";
import { Order } from "../models/Order";
import { logger } from "../lib/logger";
import { getTelegramBot } from "../services/telegram";
import { getClient, getAuthState } from "../services/gramjs";
import { Api } from "telegram";

const router = Router();

// ── Free-preview limits ───────────────────────────────────────────────────────

/** Number of episodes (from episode index 0) that are free per season. */
const FREE_EPISODES_PER_SEASON = 2;

/** Seconds of a movie available for free without purchase. */
const FREE_MOVIE_PREVIEW_SECONDS = 10 * 60; // 10 minutes

/**
 * Parse a human-readable duration string to total seconds.
 * Handles formats like "2h 15m", "135 min", "2:15:00", "135", "90m", etc.
 * Returns 0 if the duration cannot be parsed.
 */
function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const s = duration.trim();

  // "H:MM:SS" or "H:MM"
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    const sec = hms[3] ? parseInt(hms[3], 10) : 0;
    return h * 3600 + m * 60 + sec;
  }

  // "Xh Ym" / "Xh" / "Ym" (e.g. "2h 15m", "1h30m", "90m")
  const hm = s.match(/(?:(\d+)\s*h(?:r|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/i);
  if (hm && (hm[1] || hm[2])) {
    const h = hm[1] ? parseInt(hm[1], 10) : 0;
    const m = hm[2] ? parseInt(hm[2], 10) : 0;
    return h * 3600 + m * 60;
  }

  // Plain number — assume minutes
  const mins = parseFloat(s);
  if (!isNaN(mins) && mins > 0) return mins * 60;

  return 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 512 * 1024; // 512 KB — must be multiple of 4096

function parseRange(
  header: string | undefined,
  totalSize: number
): { start: number; end: number } {
  if (!header || !header.startsWith("bytes=")) {
    return { start: 0, end: totalSize - 1 };
  }
  const [rawStart, rawEnd] = header.replace("bytes=", "").split("-");
  const start = rawStart ? parseInt(rawStart, 10) : 0;
  const end = rawEnd ? parseInt(rawEnd, 10) : totalSize - 1;
  return {
    start: Math.max(0, start),
    end: Math.min(totalSize - 1, end),
  };
}

/** Stream using GramJS MTProto — works for any file size */
async function streamViaGramJS(
  client: import("telegram").TelegramClient,
  channelId: string,
  messageId: number,
  start: number,
  end: number,
  res: import("express").Response
): Promise<void> {
  const messages = await client.getMessages(channelId, { ids: [messageId] });
  if (!messages.length || !messages[0]) throw new Error("Message not found in channel");

  const msg = messages[0];
  const media = msg.media as Api.MessageMediaDocument;
  if (!media?.document) throw new Error("No document found in message");

  const doc = media.document as Api.Document;
  const mimeType = (doc as any).mimeType || "video/mp4";
  const totalSize = Number((doc as any).size);
  const safeEnd = Math.min(end, totalSize - 1);
  const contentLength = safeEnd - start + 1;

  res.status(206);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", contentLength);
  res.setHeader("Content-Range", `bytes ${start}-${safeEnd}/${totalSize}`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store");

  const location = new Api.InputDocumentFileLocation({
    id: (doc as any).id,
    accessHash: (doc as any).accessHash,
    fileReference: (doc as any).fileReference,
    thumbSize: "",
  });

  // Align offset down to nearest CHUNK_SIZE boundary (Telegram requires fixed power-of-2 limit)
  let offset = Math.floor(start / CHUNK_SIZE) * CHUNK_SIZE;
  let skipBytes = start - offset;
  let remaining = contentLength;

  while (remaining > 0 && !res.destroyed) {
    // ALWAYS use CHUNK_SIZE as limit — Telegram rejects non-power-of-2 values (LIMIT_INVALID)
    let result: Api.upload.File;
    try {
      result = (await client.invoke(
        new Api.upload.GetFile({ location, offset: BigInt(offset), limit: CHUNK_SIZE, cdn: false })
      )) as Api.upload.File;
    } catch (err: any) {
      logger.warn({ err, offset }, "GramJS GetFile chunk error");
      break;
    }

    const bytes = Buffer.from(result.bytes);
    if (bytes.length === 0) break;

    // Trim to the window [skipBytes, skipBytes + remaining)
    const chunkStart = skipBytes;
    skipBytes = 0;
    const chunkEnd = Math.min(bytes.length, chunkStart + remaining);
    const slice = bytes.slice(chunkStart, chunkEnd);

    if (slice.length === 0) break;

    if (!res.write(slice)) {
      await new Promise<void>((resolve) => res.once("drain", resolve));
    }

    remaining -= slice.length;
    offset += bytes.length;
  }

  res.end();
}

/** Stream using Bot API proxy — fallback for files ≤ 20 MB */
async function streamViaBotAPI(
  fileId: string,
  start: number,
  end: number,
  res: import("express").Response
): Promise<void> {
  const bot = getTelegramBot();
  const file = await bot.getFile(fileId);
  if (!file.file_path) throw new Error("Telegram did not return a file path (file may be >20 MB)");

  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

  const axRes = await axios.get(url, {
    responseType: "stream",
    headers: { Range: `bytes=${start}-${end}` },
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const totalSize = parseInt(axRes.headers["content-range"]?.split("/")[1] ?? "0", 10) || 0;
  const contentLength = end - start + 1;

  res.status(206);
  res.setHeader("Content-Type", axRes.headers["content-type"] || "video/mp4");
  res.setHeader("Content-Length", contentLength);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store");
  if (totalSize) {
    res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
  }

  axRes.data.pipe(res);
}

// ── Verify purchase ───────────────────────────────────────────────────────────

async function hasDeliveredOrder(telegramUsername: string, movieId: string): Promise<boolean> {
  const clean = telegramUsername.replace(/^@/, "");
  const order = await Order.findOne({
    telegramUsername: clean,
    movieId,
    status: "delivered",
  }).lean();
  return !!order;
}

// ── GET /api/stream/movie/:id ─────────────────────────────────────────────────
router.get("/movie/:id", async (req, res) => {
  const { id } = req.params;
  const { username, check } = req.query as { username?: string; check?: string };
  const isCheck = check === "true" || check === "1";

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid movie ID" });
  }

  const movie = await Movie.findById(id).lean();
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  if (!movie.telegramFileId && !movie.telegramMessageId) {
    return res.status(503).json({ error: "NO_FILE", message: "No video file attached to this movie yet." });
  }

  // Verify purchase (if PAYMENT_BYPASS is true, skip check)
  const bypass = process.env["PAYMENT_BYPASS"] === "true";
  let isFreePreview = false;
  if (!bypass) {
    const purchased = username ? await hasDeliveredOrder(username, id) : false;
    if (!purchased) {
      isFreePreview = true; // Allow streaming, but byte-limited to FREE_MOVIE_PREVIEW_SECONDS
    }
  }

  const client = getClient();
  const mtprotoReady = client && getAuthState() === "connected" && !!movie.telegramMessageId;

  // Check mode — return JSON status without streaming any bytes
  if (isCheck) {
    if (mtprotoReady) {
      return res.json({ ok: true, method: "gramjs", freePreview: isFreePreview });
    }
    if (movie.telegramFileId) {
      return res.json({ ok: true, method: "botapi", freePreview: isFreePreview });
    }
    return res.status(503).json({
      error: "MTPROTO_REQUIRED",
      message: "MTProto not connected. Go to Admin → Telegram Connect and sign in to enable streaming.",
    });
  }

  // Determine file size — try GramJS first, then Bot API
  const rangeHeader = req.headers.range;

  try {
    if (mtprotoReady) {
      const channelId = process.env["TELEGRAM_CHANNEL_ID"] || "-1004396008121";
      const messages = await client!.getMessages(channelId, { ids: [movie.telegramMessageId!] });
      const msg = messages[0];
      const media = msg?.media as Api.MessageMediaDocument | undefined;
      const doc = media?.document as Api.Document | undefined;
      const totalSize = doc ? Number((doc as any).size) : 0;
      let { start, end } = parseRange(rangeHeader, totalSize || 1);

      if (isFreePreview && totalSize > 0) {
        const durationSec = parseDurationToSeconds(movie.duration);
        const freeByteLimit =
          durationSec > 0
            ? Math.floor(totalSize * (FREE_MOVIE_PREVIEW_SECONDS / durationSec))
            : 150 * 1024 * 1024; // fallback: ~150 MB at 2 Mbps
        if (start >= freeByteLimit) {
          return res.status(403).json({
            error: "PURCHASE_REQUIRED",
            message: "Purchase required to watch beyond the free preview.",
          });
        }
        end = Math.min(end, freeByteLimit - 1);
      }

      await streamViaGramJS(client!, channelId, movie.telegramMessageId!, start, end, res);
      return;
    }
  } catch (err: any) {
    logger.warn({ err, movieId: id }, "GramJS stream failed, falling back to Bot API");
  }

  // Bot API fallback
  if (!movie.telegramFileId) {
    return res.status(503).json({
      error: "MTPROTO_REQUIRED",
      message: "MTProto not connected and no Bot API file ID available. Go to Admin → Telegram Connect.",
    });
  }

  try {
    // Fetch actual file metadata so the preview cap is proportional to the real file size
    const bot = getTelegramBot();
    const fileInfo = await bot.getFile(movie.telegramFileId);
    const actualFileSize: number = (fileInfo as any).file_size ?? 20 * 1024 * 1024;

    let { start, end } = parseRange(rangeHeader, actualFileSize);

    if (isFreePreview) {
      const durationSec = parseDurationToSeconds(movie.duration);
      const rawLimit =
        durationSec > 0
          ? Math.floor(actualFileSize * (FREE_MOVIE_PREVIEW_SECONDS / durationSec))
          : Math.floor(actualFileSize * 0.15); // fallback: ~15% of file
      // Clamp to [1, actualFileSize] to avoid 0-byte or out-of-bounds limits
      const freeByteLimit = Math.max(1, Math.min(rawLimit, actualFileSize));
      if (start >= freeByteLimit) {
        return res.status(403).json({
          error: "PURCHASE_REQUIRED",
          message: "Purchase required to watch beyond the free preview.",
        });
      }
      end = Math.min(end, freeByteLimit - 1);
    }

    await streamViaBotAPI(movie.telegramFileId, start, end, res);
  } catch (err: any) {
    logger.error({ err, movieId: id }, "Streaming failed");
    if (!res.headersSent) {
      return res.status(503).json({
        error: "MTPROTO_REQUIRED",
        message: "File is too large for the Bot API (>20 MB). Go to Admin → Telegram Connect and sign in to stream large files.",
      });
    }
  }
});

// ── GET /api/stream/episode/:seriesId/:seasonIdx/:episodeIdx ──────────────────
router.get("/episode/:seriesId/:seasonIdx/:episodeIdx", async (req, res) => {
  const { seriesId, seasonIdx, episodeIdx } = req.params;
  const { username } = req.query as { username?: string };

  if (!mongoose.isValidObjectId(seriesId)) {
    return res.status(400).json({ error: "Invalid series ID" });
  }

  const series = await Series.findById(seriesId).lean();
  if (!series) return res.status(404).json({ error: "Series not found" });

  const season = series.seasons[Number(seasonIdx)];
  const episode = season?.episodes[Number(episodeIdx)];
  if (!episode) return res.status(404).json({ error: "Episode not found" });

  if (!episode.telegramFileId) {
    return res.status(503).json({ error: "No video file attached to this episode yet" });
  }

  // First FREE_EPISODES_PER_SEASON episodes of each season are free; the rest require purchase
  const bypass = process.env["PAYMENT_BYPASS"] === "true";
  const isFreeEpisode = Number(episodeIdx) < FREE_EPISODES_PER_SEASON;
  if (!bypass && !isFreeEpisode) {
    const order = await Order.findOne({
      telegramUsername: (username ?? "").replace(/^@/, ""),
      seriesId,
      status: "delivered",
    }).lean();
    if (!order) {
      return res.status(403).json({ error: "PURCHASE_REQUIRED", message: "Purchase required to stream this episode." });
    }
  }

  const rangeHeader = req.headers.range;

  try {
    const client = getClient();
    if (client && getAuthState() === "connected" && episode.telegramMessageId) {
      const channelId =
        process.env["TELEGRAM_CHANNEL_ID"] || "-1004396008121";

      const messages = await client.getMessages(channelId, {
        ids: [episode.telegramMessageId],
      });
      const msg = messages[0];
      const media = msg?.media as Api.MessageMediaDocument | undefined;
      const doc = media?.document as Api.Document | undefined;
      const totalSize = doc ? Number((doc as any).size) : 0;

      const { start, end } = parseRange(rangeHeader, totalSize || 1);
      await streamViaGramJS(
        client,
        channelId,
        episode.telegramMessageId,
        start,
        end,
        res
      );
      return;
    }
  } catch (err: any) {
    logger.warn({ err, seriesId, seasonIdx, episodeIdx }, "GramJS episode stream failed");
  }

  try {
    const { start, end } = parseRange(rangeHeader, 20 * 1024 * 1024);
    await streamViaBotAPI(episode.telegramFileId, start, end, res);
  } catch (err: any) {
    logger.error({ err }, "Episode streaming failed");
    if (!res.headersSent) {
      return res.status(500).json({ error: "Streaming unavailable" });
    }
  }
});

export default router;
