import { Router } from "express";
import { spawn } from "child_process";
import { createWriteStream, createReadStream, unlinkSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";
import { getClient, getAuthState } from "../services/gramjs";
import { getTelegramBot } from "../services/telegram";
import { Api } from "telegram";
import { logger } from "../lib/logger";
import OpenAI from "openai";

const CHUNK_SIZE = 512 * 1024; // 512 KB — matches stream.ts
const GROQ_LIMIT = 24 * 1024 * 1024; // 24 MB Whisper safety limit

let _groq: OpenAI | null = null;
function getGroq(): OpenAI {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      logger.error("GROQ_API_KEY is not configured — subtitle transcription unavailable");
      throw new Error("Transcription service is not configured on this server");
    }
    _groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  }
  return _groq;
}

// ── SSE helper ────────────────────────────────────────────────────────────
function sse(res: import("express").Response, event: string, data: object) {
  if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Download video from Telegram to a temp file ───────────────────────────
async function downloadToTempFile(
  fileId: string | null | undefined,
  msgId: number | null | undefined,
  onPct: (pct: number) => void
): Promise<string> {
  const tmpPath = join(tmpdir(), `cv_vid_${Date.now()}.mp4`);
  const ws = createWriteStream(tmpPath);

  const write = (buf: Buffer) =>
    new Promise<void>((ok, fail) => ws.write(buf, (e) => (e ? fail(e) : ok())));
  const close = () => new Promise<void>((ok) => { ws.end(); ws.once("finish", ok); });

  const client = getClient();
  const channelId = process.env["TELEGRAM_CHANNEL_ID"] || "";

  if (client && getAuthState() === "connected" && msgId) {
    // GramJS — works for any file size
    const messages = await client.getMessages(channelId, { ids: [msgId] });
    if (!messages[0]) throw new Error("Message not found in Telegram channel");

    const doc = (messages[0].media as Api.MessageMediaDocument)?.document as Api.Document;
    if (!doc) throw new Error("No document in message");

    const totalSize = Number((doc as any).size);
    const location = new Api.InputDocumentFileLocation({
      id: (doc as any).id,
      accessHash: (doc as any).accessHash,
      fileReference: (doc as any).fileReference,
      thumbSize: "",
    });

    let offset = 0;
    let done = 0;
    while (offset < totalSize) {
      const result = (await client.invoke(
        new Api.upload.GetFile({ location, offset: BigInt(offset), limit: CHUNK_SIZE, cdn: false })
      )) as Api.upload.File;
      const bytes = Buffer.from(result.bytes);
      if (!bytes.length) break;
      await write(bytes);
      done += bytes.length;
      offset += bytes.length;
      onPct(Math.round((done / totalSize) * 38) + 2);
    }
  } else if (fileId) {
    // Bot API — files ≤ 20 MB only
    const bot = getTelegramBot();
    const file = await bot.getFile(fileId);
    if (!file.file_path) {
      throw new Error("File too large for Bot API (>20 MB). Connect GramJS in admin settings to transcribe large files.");
    }
    const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const resp = await fetch(url);
    if (!resp.ok || !resp.body) throw new Error(`Telegram download failed (${resp.status})`);
    const reader = resp.body.getReader();
    while (true) {
      const { done: d, value } = await reader.read();
      if (d) break;
      await write(Buffer.from(value!));
    }
    onPct(40);
  } else {
    throw new Error("No Telegram file attached. Upload the video first.");
  }

  await close();
  return tmpPath;
}

// ── Extract mono 16 kHz audio via ffmpeg ─────────────────────────────────
function extractAudio(videoPath: string): Promise<string> {
  const audioPath = videoPath.replace(/\.mp4$/, ".mp3");
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-i", videoPath,
      "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-f", "mp3",
      audioPath, "-y",
    ]);
    let stderr = "";
    ff.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    ff.on("close", (code: number) =>
      code === 0 ? resolve(audioPath) : reject(new Error(`ffmpeg (${code}): ${stderr.slice(-400)}`))
    );
  });
}

// ── Get duration via ffprobe ──────────────────────────────────────────────
function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const fp = spawn("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", audioPath]);
    let out = "";
    fp.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    fp.on("close", () => {
      try { resolve(parseFloat(JSON.parse(out).format.duration)); }
      catch { reject(new Error("ffprobe: could not parse duration")); }
    });
  });
}

// ── Split audio into ≤24 MB chunks if file is too large ──────────────────
async function splitAudio(audioPath: string): Promise<{ path: string; offsetSeconds: number }[]> {
  const size = statSync(audioPath).size;
  if (size <= GROQ_LIMIT) return [{ path: audioPath, offsetSeconds: 0 }];

  const duration = await getAudioDuration(audioPath);
  const numChunks = Math.ceil(size / GROQ_LIMIT);
  const chunkDur = duration / numChunks;
  const chunks: { path: string; offsetSeconds: number }[] = [];

  for (let i = 0; i < numChunks; i++) {
    const chunkPath = audioPath.replace(".mp3", `_part${i}.mp3`);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn("ffmpeg", [
        "-i", audioPath,
        "-ss", (i * chunkDur).toFixed(3),
        "-t", chunkDur.toFixed(3),
        "-c", "copy", chunkPath, "-y",
      ]);
      ff.on("close", (c: number) => c === 0 ? resolve() : reject(new Error("Audio split failed")));
    });
    chunks.push({ path: chunkPath, offsetSeconds: i * chunkDur });
  }
  return chunks;
}

// ── Transcribe one audio chunk with Groq Whisper ──────────────────────────
async function transcribeChunk(
  audioPath: string,
  offsetSeconds: number
): Promise<{ start: number; end: number; text: string }[]> {
  const result: any = await getGroq().audio.transcriptions.create({
    file: createReadStream(audioPath) as any,
    model: "whisper-large-v3-turbo",
    response_format: "verbose_json" as any,
    timestamp_granularities: ["segment"] as any,
  });

  return (result.segments ?? [])
    .filter((s: any) => s.text?.trim())
    .map((s: any) => ({
      start: Number(s.start) + offsetSeconds,
      end: Number(s.end) + offsetSeconds,
      text: s.text.trim(),
    }));
}

// ── Build WebVTT string ───────────────────────────────────────────────────
function toVTT(segments: { start: number; end: number; text: string }[]): string {
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = (t % 60).toFixed(3).padStart(6, "0");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s}`;
  };
  return "WEBVTT\n\n" + segments.map((s, i) =>
    `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`
  ).join("\n");
}

// ── Core generation pipeline ──────────────────────────────────────────────
async function generateSubtitles(
  fileId: string | null | undefined,
  msgId: number | null | undefined,
  onProgress: (step: string, pct: number) => void
): Promise<string> {
  const tempFiles: string[] = [];

  try {
    onProgress("Connecting to Telegram...", 2);
    const videoPath = await downloadToTempFile(fileId, msgId, (pct) =>
      onProgress("Downloading from Telegram...", pct)
    );
    tempFiles.push(videoPath);

    onProgress("Extracting audio...", 42);
    const audioPath = await extractAudio(videoPath);
    tempFiles.push(audioPath);
    try { unlinkSync(videoPath); tempFiles.splice(tempFiles.indexOf(videoPath), 1); } catch {}

    onProgress("Preparing transcription...", 52);
    const chunks = await splitAudio(audioPath);
    if (chunks.length > 1) chunks.forEach(c => tempFiles.push(c.path));

    const allSegments: { start: number; end: number; text: string }[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const label = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
      onProgress(`Transcribing${label}...`, 55 + Math.round((i / chunks.length) * 38));
      const segs = await transcribeChunk(chunks[i].path, chunks[i].offsetSeconds);
      allSegments.push(...segs);
      if (chunks.length > 1) try { unlinkSync(chunks[i].path); } catch {}
    }
    try { unlinkSync(audioPath); } catch {}

    onProgress("Building subtitle file...", 96);
    return toVTT(allSegments);
  } catch (err) {
    tempFiles.forEach(f => { try { unlinkSync(f); } catch {} });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin routers (require auth — mounted under /admin/subtitles)
// ═══════════════════════════════════════════════════════════════════════════
export const adminSubtitleRouter = Router();

// POST /admin/subtitles/movie/:id
adminSubtitleRouter.post("/movie/:id", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return (sse(res, "error", { message: "Movie not found" }), res.end());
    if (!movie.telegramFileId && !(movie as any).telegramMessageId)
      return (sse(res, "error", { message: "No Telegram file attached to this movie" }), res.end());

    await Movie.findByIdAndUpdate(req.params.id, { subtitleStatus: "generating" });

    const vtt = await generateSubtitles(
      movie.telegramFileId,
      (movie as any).telegramMessageId,
      (step, pct) => sse(res, "progress", { step, pct })
    );

    await Movie.findByIdAndUpdate(req.params.id, { subtitleVtt: vtt, subtitleStatus: "ready" });
    sse(res, "done", { message: "Subtitles ready" });
    res.end();
  } catch (err: any) {
    logger.error({ err }, "Movie subtitle generation failed");
    await Movie.findByIdAndUpdate(req.params.id, { subtitleStatus: "error" }).catch(() => {});
    sse(res, "error", { message: err.message ?? "Generation failed" });
    res.end();
  }
});

// POST /admin/subtitles/episode/:seriesId/:seasonNum/:episodeNum
adminSubtitleRouter.post("/episode/:seriesId/:seasonNum/:episodeNum", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const { seriesId, seasonNum, episodeNum } = req.params;
    const series = await Series.findById(seriesId);
    if (!series) return (sse(res, "error", { message: "Series not found" }), res.end());

    const season = series.seasons.find(s => s.seasonNumber === Number(seasonNum));
    const episode = season?.episodes.find(e => e.episodeNumber === Number(episodeNum));
    if (!episode) return (sse(res, "error", { message: "Episode not found" }), res.end());
    if (!episode.telegramFileId && !(episode as any).telegramMessageId)
      return (sse(res, "error", { message: "No Telegram file attached to this episode" }), res.end());

    (episode as any).subtitleStatus = "generating";
    await series.save();

    const vtt = await generateSubtitles(
      episode.telegramFileId,
      (episode as any).telegramMessageId,
      (step, pct) => sse(res, "progress", { step, pct })
    );

    (episode as any).subtitleVtt = vtt;
    (episode as any).subtitleStatus = "ready";
    await series.save();

    sse(res, "done", { message: "Subtitles ready" });
    res.end();
  } catch (err: any) {
    logger.error({ err }, "Episode subtitle generation failed");
    sse(res, "error", { message: err.message ?? "Generation failed" });
    res.end();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Public serve router (mounted under /subtitle)
// ═══════════════════════════════════════════════════════════════════════════
export const subtitleServeRouter = Router();

// GET /subtitle/movie/:id
subtitleServeRouter.get("/movie/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).select("subtitleVtt");
    if (!(movie as any)?.subtitleVtt) return res.status(404).end();
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send((movie as any).subtitleVtt);
  } catch { res.status(500).end(); }
});

// GET /subtitle/episode/:seriesId/:seasonNum/:episodeNum
subtitleServeRouter.get("/episode/:seriesId/:seasonNum/:episodeNum", async (req, res) => {
  try {
    const { seriesId, seasonNum, episodeNum } = req.params;
    const series = await Series.findById(seriesId).select("seasons");
    if (!series) return res.status(404).end();
    const ep = series.seasons
      .find(s => s.seasonNumber === Number(seasonNum))
      ?.episodes.find(e => e.episodeNumber === Number(episodeNum));
    if (!(ep as any)?.subtitleVtt) return res.status(404).end();
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send((ep as any).subtitleVtt);
  } catch { res.status(500).end(); }
});
