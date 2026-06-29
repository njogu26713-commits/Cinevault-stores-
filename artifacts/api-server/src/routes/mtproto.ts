import { Router } from "express";
import multer from "multer";
import os from "os";
import fs from "fs";
import mongoose from "mongoose";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";
import { logger } from "../lib/logger";
import { getSetting } from "../lib/settings-store";
import { getChannelFileBuffer } from "../services/telegram";
import {
  getStatus,
  authSendCode,
  authVerifyCode,
  authVerifyPassword,
  authDisconnect,
  createUploadJob,
  getUploadJob,
  emitUploadError,
  uploadFileToChannel,
  waitForChannelPostFileId,
} from "../services/gramjs";

const router = Router();

// Multer: preserve original extension so video detection works correctly
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const ext = file.originalname.includes(".")
        ? "." + file.originalname.split(".").pop()!.toLowerCase()
        : "";
      cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024 },
});

// ── GET /admin/mtproto/status ──────────────────────────────────────────────────
router.get("/status", (_req, res) => {
  try {
    const status = getStatus();
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/mtproto/auth/send-code ────────────────────────────────────────
router.post("/auth/send-code", async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) return res.status(400).json({ error: "phone is required" });

  try {
    await authSendCode(phone);
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "MTProto send-code failed");
    return res.status(400).json({ error: err.message ?? "Failed to send code" });
  }
});

// ── POST /admin/mtproto/auth/verify-code ──────────────────────────────────────
router.post("/auth/verify-code", async (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ error: "code is required" });

  try {
    const result = await authVerifyCode(code);
    return res.json({ ok: true, requires2FA: result.requires2FA });
  } catch (err: any) {
    logger.error({ err }, "MTProto verify-code failed");
    return res.status(400).json({ error: err.message ?? "Invalid code" });
  }
});

// ── POST /admin/mtproto/auth/verify-password ──────────────────────────────────
router.post("/auth/verify-password", async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) return res.status(400).json({ error: "password is required" });

  try {
    await authVerifyPassword(password);
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "MTProto verify-password failed");
    return res.status(400).json({ error: err.message ?? "Invalid password" });
  }
});

// ── POST /admin/mtproto/auth/disconnect ───────────────────────────────────────
router.post("/auth/disconnect", async (_req, res) => {
  try {
    await authDisconnect();
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Shared upload logic ───────────────────────────────────────────────────────

async function getBotFileId(messageId: number): Promise<string> {
  // Race condition guard: check if the channel_post was already buffered
  const buffer = getChannelFileBuffer();
  const buffered = buffer.find((f) => f.messageId === messageId);
  if (buffered) {
    logger.info({ messageId, fileId: buffered.fileId }, "Found fileId in buffer (no wait needed)");
    return buffered.fileId;
  }
  // Not yet — register a waiter
  return waitForChannelPostFileId(messageId, 25000);
}

// ── POST /admin/mtproto/movies/:id/upload ─────────────────────────────────────
router.post(
  "/movies/:id/upload",
  (req, res, next) => {
    req.setTimeout(0);
    res.setTimeout(0);
    next();
  },
  upload.single("file"),
  async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid movie ID" });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const channelId = getSetting("telegramChannelId") || process.env["TELEGRAM_CHANNEL_ID"] || "";
    if (!channelId) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: "Telegram channel ID not configured" });
    }

    try {
      const movie = await Movie.findById(id);
      if (!movie) {
        fs.unlink(file.path, () => {});
        return res.status(404).json({ error: "Movie not found" });
      }

      // Pre-check: GramJS must be connected before we commit to the background job
      const status = getStatus();
      if (status.state !== "connected") {
        fs.unlink(file.path, () => {});
        const msg =
          status.state === "disconnected" || status.state === "error"
            ? "Telegram not connected — go to Settings → Telegram Connect and sign in first"
            : "Telegram session is still authenticating — try again in a moment";
        return res.status(400).json({ error: msg });
      }

      const jobId = createUploadJob();
      const fileName = file.originalname || `${movie.title}.mp4`;
      const caption = `🎬 ${movie.title} (${movie.year}) | ${movie.quality}`;

      // Return jobId immediately — upload runs in background
      res.json({ jobId });

      // Run upload in background
      setImmediate(async () => {
        try {
          const { fileId, messageId, fileSizeMB } = await uploadFileToChannel(
            jobId,
            file.path,
            fileName,
            caption,
            channelId,
            file.mimetype
          );

          // Get Bot API file_id from channel_post event
          let botFileId = fileId;
          if (!botFileId) {
            try { botFileId = await getBotFileId(messageId); } catch {}
          }

          // Persist to DB
          await Movie.findByIdAndUpdate(id, {
            telegramFileId: botFileId || null,
            telegramMessageId: messageId,
            fileSize: `${fileSizeMB} MB`,
            published: true,
          });

          logger.info({ movieId: id, messageId, botFileId }, "Movie MTProto upload complete");
        } catch (err: any) {
          const errMsg = err?.message ?? "Upload failed";
          logger.error({ err, movieId: id, jobId }, "Movie MTProto upload background job failed");
          // Emit to SSE so the frontend receives the error (not a silent hang)
          emitUploadError(jobId, errMsg);
        } finally {
          fs.unlink(file.path, () => {});
        }
      });
    } catch (err: any) {
      fs.unlink(file.path, () => {});
      logger.error({ err, movieId: id }, "MTProto movie upload init failed");
      return res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  }
);

// ── POST /admin/mtproto/series/:id/seasons/:sIdx/episodes/:eIdx/upload ────────
router.post(
  "/series/:id/seasons/:sIdx/episodes/:eIdx/upload",
  (req, res, next) => {
    req.setTimeout(0);
    res.setTimeout(0);
    next();
  },
  upload.single("file"),
  async (req, res) => {
    const { id, sIdx, eIdx } = req.params;
    const seasonIdx = Number(sIdx);
    const episodeIdx = Number(eIdx);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid series ID" });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const channelId = getSetting("telegramChannelId") || process.env["TELEGRAM_CHANNEL_ID"] || "";
    if (!channelId) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: "Telegram channel ID not configured" });
    }

    try {
      const series = await Series.findById(id);
      if (!series) {
        fs.unlink(file.path, () => {});
        return res.status(404).json({ error: "Series not found" });
      }

      const season = series.seasons[seasonIdx];
      if (!season) {
        fs.unlink(file.path, () => {});
        return res.status(404).json({ error: "Season not found" });
      }

      const episode = season.episodes[episodeIdx];
      if (!episode) {
        fs.unlink(file.path, () => {});
        return res.status(404).json({ error: "Episode not found" });
      }

      // Pre-check: GramJS must be connected before we commit to the background job
      const status = getStatus();
      if (status.state !== "connected") {
        fs.unlink(file.path, () => {});
        const msg =
          status.state === "disconnected" || status.state === "error"
            ? "Telegram not connected — go to Settings → Telegram Connect and sign in first"
            : "Telegram session is still authenticating — try again in a moment";
        return res.status(400).json({ error: msg });
      }

      const jobId = createUploadJob();
      const sNum = String(season.seasonNumber).padStart(2, "0");
      const eNum = String(episode.episodeNumber).padStart(2, "0");
      const fileName =
        file.originalname || `${series.title}_S${sNum}E${eNum}.mp4`;
      const caption = `📺 ${series.title} | S${sNum}E${eNum} - ${episode.title}`;

      res.json({ jobId });

      setImmediate(async () => {
        try {
          const { fileId, messageId, fileSizeMB } = await uploadFileToChannel(
            jobId,
            file.path,
            fileName,
            caption,
            channelId,
            file.mimetype
          );

          let botFileId = fileId;
          if (!botFileId) {
            try { botFileId = await getBotFileId(messageId); } catch {}
          }

          // Re-fetch and update to avoid stale data races
          const fresh = await Series.findById(id);
          if (fresh && fresh.seasons[seasonIdx]?.episodes[episodeIdx]) {
            fresh.seasons[seasonIdx].episodes[episodeIdx].telegramFileId = botFileId || null;
            fresh.seasons[seasonIdx].episodes[episodeIdx].telegramMessageId = messageId;
            await fresh.save();
          }

          logger.info({ seriesId: id, seasonIdx, episodeIdx, messageId, botFileId }, "Episode MTProto upload complete");
        } catch (err: any) {
          const errMsg = err?.message ?? "Upload failed";
          logger.error({ err, seriesId: id, jobId }, "Episode MTProto upload background job failed");
          emitUploadError(jobId, errMsg);
        } finally {
          fs.unlink(file.path, () => {});
        }
      });
    } catch (err: any) {
      fs.unlink(file.path, () => {});
      return res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  }
);

// ── GET /admin/mtproto/upload-progress/:jobId (SSE) ───────────────────────────
router.get("/upload-progress/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const { emitter, lastProgress } = getUploadJob(jobId);

  if (!emitter) {
    // Job not found — might have already completed; check lastProgress
    send({ phase: "error", percent: 0, error: "Upload job not found or already completed" });
    res.end();
    return;
  }

  // Send last known progress immediately (catches up late subscribers)
  if (lastProgress) send(lastProgress);

  const onProgress = (progress: object) => {
    send(progress);
    const p = progress as any;
    if (p.phase === "complete" || p.phase === "error") {
      res.end();
    }
  };

  emitter.on("progress", onProgress);

  req.on("close", () => {
    emitter.off("progress", onProgress);
  });
});

export default router;
