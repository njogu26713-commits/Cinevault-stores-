import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger";
import { getSetting, saveSettings } from "../lib/settings-store";

const execFileAsync = promisify(execFile);

// ── Auth State ────────────────────────────────────────────────────────────────

export type AuthState =
  | "disconnected"
  | "code_sent"
  | "awaiting_2fa"
  | "connected"
  | "error";

interface PendingAuth {
  phoneNumber: string;
  phoneCodeHash: string;
}

let _client: TelegramClient | null = null;
let _authState: AuthState = "disconnected";
let _pendingAuth: PendingAuth | null = null;
let _lastError: string | null = null;

// channel_post waiters: messageId → resolver function
const _channelPostWaiters = new Map<number, (fileId: string) => void>();

// Upload job emitters
const _uploadJobs = new Map<string, EventEmitter>();
// Last known progress per job (for late SSE subscribers)
const _lastProgress = new Map<string, UploadProgress>();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadProgress {
  phase: "uploading_to_telegram" | "complete" | "error";
  percent: number;
  speedMBps?: number;
  fileId?: string;
  messageId?: number;
  fileSizeMB?: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiCredentials(): { apiId: number; apiHash: string } {
  const apiIdStr = process.env["TELEGRAM_API_ID"];
  const apiHash = process.env["TELEGRAM_API_HASH"];
  if (!apiIdStr) throw new Error("TELEGRAM_API_ID is not set");
  if (!apiHash) throw new Error("TELEGRAM_API_HASH is not set");
  const apiId = parseInt(apiIdStr, 10);
  if (isNaN(apiId)) throw new Error("TELEGRAM_API_ID must be a number");
  return { apiId, apiHash };
}

function getSavedSession(): string {
  return process.env["TELEGRAM_SESSION"] || getSetting("telegramSession") || "";
}

function persistSession(): void {
  if (!_client) return;
  try {
    const str = (_client.session as StringSession).save();
    saveSettings({ telegramSession: str });
  } catch {}
}

function buildClient(sessionStr: string): TelegramClient {
  const { apiId, apiHash } = getApiCredentials();
  return new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 5,
    retryDelay: 1000,
    autoReconnect: true,
    useWSS: false,
    deviceModel: "CineVault Admin",
    systemVersion: "Node.js",
    appVersion: "1.0.0",
    langCode: "en",
  });
}

// ── Client accessors (for stream route) ──────────────────────────────────────

export function getClient(): TelegramClient | null {
  return _client;
}

export function getAuthState(): AuthState {
  return _authState;
}

// ── Status ────────────────────────────────────────────────────────────────────

export function getStatus(): {
  state: AuthState;
  error: string | null;
  sessionString: string;
  hasApiCredentials: boolean;
} {
  const hasApiCredentials =
    !!process.env["TELEGRAM_API_ID"] && !!process.env["TELEGRAM_API_HASH"];

  let sessionString = "";
  if (_authState === "connected" && _client) {
    try {
      sessionString = (_client.session as StringSession).save();
    } catch {}
  }

  return { state: _authState, error: _lastError, sessionString, hasApiCredentials };
}

// ── Initialize on server startup ──────────────────────────────────────────────

export async function initializeGramJS(): Promise<void> {
  const sessionStr = getSavedSession();
  if (!sessionStr) {
    logger.info("GramJS: No saved session — skipping auto-connect");
    return;
  }

  try {
    getApiCredentials(); // Validate env vars exist
  } catch (err: any) {
    logger.warn({ err }, "GramJS: API credentials missing — skipping auto-connect");
    return;
  }

  try {
    _client = buildClient(sessionStr);
    await _client.connect();

    if (await _client.isUserAuthorized()) {
      _authState = "connected";
      _lastError = null;
      // Populate entity cache so channel resolution works
      try {
        await _client.getDialogs({ limit: 20 });
      } catch {}
      logger.info("GramJS: Auto-connected with saved session");
    } else {
      logger.warn("GramJS: Saved session invalid — clearing");
      await _client.disconnect().catch(() => {});
      _client = null;
      _authState = "disconnected";
      saveSettings({ telegramSession: "" });
    }
  } catch (err: any) {
    const msg: string = err.message ?? err.errorMessage ?? "";

    // Session duplicated or unregistered — clear it so admin can re-auth cleanly
    if (
      msg.includes("AUTH_KEY_DUPLICATED") ||
      msg.includes("AUTH_KEY_UNREGISTERED") ||
      msg.includes("AUTH_KEY_INVALID") ||
      err.code === 406 ||
      err.code === 401
    ) {
      logger.warn({ code: err.code, msg }, "GramJS: Session key rejected by Telegram — clearing saved session");
      try { await _client?.disconnect().catch(() => {}); } catch {}
      _client = null;
      _authState = "disconnected";
      _lastError = null;
      saveSettings({ telegramSession: "" });
      return; // Not an error state — just needs fresh login
    }

    logger.error({ err }, "GramJS: Auto-connect failed");
    _authState = "error";
    _lastError = msg || "Connection failed";
    _client = null;
  }
}

// ── Auth Flow ─────────────────────────────────────────────────────────────────

export async function authSendCode(phoneNumber: string): Promise<void> {
  if (_client) {
    await _client.disconnect().catch(() => {});
    _client = null;
  }

  const { apiId, apiHash } = getApiCredentials();
  _client = buildClient("");
  await _client.connect();

  const result = await _client.sendCode({ apiId, apiHash }, phoneNumber);
  _pendingAuth = { phoneNumber, phoneCodeHash: result.phoneCodeHash };
  _authState = "code_sent";
  _lastError = null;
}

export async function authVerifyCode(code: string): Promise<{ requires2FA: boolean }> {
  if (!_client || !_pendingAuth) {
    throw new Error("No active auth session. Send code first.");
  }

  try {
    await _client.invoke(
      new Api.auth.SignIn({
        phoneNumber: _pendingAuth.phoneNumber,
        phoneCodeHash: _pendingAuth.phoneCodeHash,
        phoneCode: code.trim(),
      })
    );

    persistSession();
    try { await _client.getDialogs({ limit: 20 }); } catch {}
    _authState = "connected";
    _pendingAuth = null;
    _lastError = null;
    return { requires2FA: false };
  } catch (err: any) {
    const msg = err.errorMessage ?? err.message ?? "";
    if (msg.includes("SESSION_PASSWORD_NEEDED")) {
      _authState = "awaiting_2fa";
      return { requires2FA: true };
    }
    _authState = "error";
    _lastError = msg || "Sign-in failed";
    throw new Error(_lastError!);
  }
}

export async function authVerifyPassword(password: string): Promise<void> {
  if (!_client) throw new Error("Client not initialized");

  try {
    const passwordData = await _client.invoke(new Api.account.GetPassword());
    const check = await computeCheck(passwordData as any, password);
    await _client.invoke(new Api.auth.CheckPassword({ password: check as any }));

    persistSession();
    try { await _client.getDialogs({ limit: 20 }); } catch {}
    _authState = "connected";
    _pendingAuth = null;
    _lastError = null;
  } catch (err: any) {
    _authState = "error";
    _lastError = err.message ?? "2FA verification failed";
    throw new Error(_lastError!);
  }
}

export async function authDisconnect(): Promise<void> {
  if (_client) {
    try { await _client.invoke(new Api.auth.LogOut() as any); } catch {}
    await _client.disconnect().catch(() => {});
    _client = null;
  }
  _authState = "disconnected";
  _pendingAuth = null;
  _lastError = null;
  saveSettings({ telegramSession: "" });
}

// ── Channel Post Watcher (bridges GramJS→Bot API file_id) ────────────────────

export function resolveChannelPostFileId(messageId: number, fileId: string): boolean {
  const resolver = _channelPostWaiters.get(messageId);
  if (resolver) {
    _channelPostWaiters.delete(messageId);
    resolver(fileId);
    return true;
  }
  return false;
}

export function waitForChannelPostFileId(
  messageId: number,
  timeoutMs = 25000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _channelPostWaiters.delete(messageId);
      reject(new Error(`Timed out waiting for Bot API file_id (msgId=${messageId})`));
    }, timeoutMs);

    _channelPostWaiters.set(messageId, (fileId) => {
      clearTimeout(timer);
      resolve(fileId);
    });
  });
}

// ── Upload Jobs ───────────────────────────────────────────────────────────────

export function createUploadJob(): string {
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emitter = new EventEmitter();
  emitter.setMaxListeners(10);
  _uploadJobs.set(jobId, emitter);
  // Auto-cleanup after 1 hour
  setTimeout(() => {
    _uploadJobs.delete(jobId);
    _lastProgress.delete(jobId);
  }, 60 * 60 * 1000);
  return jobId;
}

export function getUploadJob(jobId: string): {
  emitter: EventEmitter | undefined;
  lastProgress: UploadProgress | undefined;
} {
  return {
    emitter: _uploadJobs.get(jobId),
    lastProgress: _lastProgress.get(jobId),
  };
}

function emitProgress(jobId: string, progress: UploadProgress): void {
  _lastProgress.set(jobId, progress);
  _uploadJobs.get(jobId)?.emit("progress", progress);
}

export function emitUploadError(jobId: string, error: string): void {
  emitProgress(jobId, { phase: "error", percent: 0, error });
  _uploadJobs.delete(jobId);
  _lastProgress.delete(jobId);
}

// ── Video Detection & Metadata ─────────────────────────────────────────────────

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".ts", ".flv"]);
const VIDEO_MIME_PREFIXES = ["video/"];

function isVideoFile(filePath: string, mimeType?: string): boolean {
  if (VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return true;
  if (mimeType && VIDEO_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true;
  return false;
}

interface VideoMeta {
  duration: number; // seconds (integer)
  width: number;
  height: number;
}

async function getVideoMeta(filePath: string): Promise<VideoMeta> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-select_streams", "v:0",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  const duration = Math.round(parseFloat(stream.duration ?? "0")) || 0;
  const width = parseInt(stream.width ?? "0", 10) || 0;
  const height = parseInt(stream.height ?? "0", 10) || 0;
  return { duration, width, height };
}

async function generateThumbnail(filePath: string, durationSec: number): Promise<string | null> {
  try {
    const thumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);
    const seekSec = Math.max(0, Math.round(durationSec * 0.1));
    await execFileAsync("ffmpeg", [
      "-ss", String(seekSec),
      "-i", filePath,
      "-vframes", "1",
      "-vf", "scale=320:-1",
      "-q:v", "5",
      "-y",
      thumbPath,
    ]);
    if (fs.existsSync(thumbPath)) return thumbPath;
  } catch (err) {
    logger.warn({ err }, "GramJS: Thumbnail generation failed — uploading without thumbnail");
  }
  return null;
}

// ── File Upload ───────────────────────────────────────────────────────────────

async function doSendFile(
  entity: any,
  filePath: string,
  caption: string,
  stat: fs.Stats,
  fileSizeMB: string,
  jobId: string,
  asVideo: boolean,
  videoMeta: VideoMeta | null,
  thumbPath: string | null
): Promise<any> {
  let lastPercent = -1;
  let lastSpeedTime = Date.now();
  let lastSpeedBytes = 0;

  const progressCallback = (progress: number) => {
    const rawPercent = Math.min(99, Math.round(progress * 100));
    const now = Date.now();
    const dtSec = (now - lastSpeedTime) / 1000;
    const loadedBytes = progress * stat.size;
    let speedMBps = 0;
    if (dtSec > 0.5) {
      speedMBps = Math.max(0, Math.round(((loadedBytes - lastSpeedBytes) / dtSec / (1024 * 1024)) * 10) / 10);
      lastSpeedTime = now;
      lastSpeedBytes = loadedBytes;
    }
    if (rawPercent !== lastPercent) {
      lastPercent = rawPercent;
      emitProgress(jobId, { phase: "uploading_to_telegram", percent: rawPercent, speedMBps, fileSizeMB });
    }
  };

  if (asVideo && videoMeta) {
    const attributes: Api.TypeDocumentAttribute[] = [
      new Api.DocumentAttributeVideo({
        duration: videoMeta.duration,
        w: videoMeta.width,
        h: videoMeta.height,
        supportsStreaming: true,
      }),
      new Api.DocumentAttributeFilename({ fileName: path.basename(filePath) }),
    ];

    // workers: 1 — do NOT increase; parallel workers cause FILE_PARTS_INVALID
    // (upload.SaveBigFilePart) errors from Telegram MTProto on large files.
    return await (_client as any).sendFile(entity, {
      file: filePath,
      caption,
      forceDocument: false,
      thumb: thumbPath ?? undefined,
      attributes,
      workers: 1,
      progressCallback,
    });
  }

  // Document fallback
  // workers: 1 — do NOT increase; parallel workers cause FILE_PARTS_INVALID errors.
  return await (_client as any).sendFile(entity, {
    file: filePath,
    caption,
    forceDocument: true,
    workers: 1,
    progressCallback,
  });
}

export async function uploadFileToChannel(
  jobId: string,
  filePath: string,
  fileName: string,
  caption: string,
  channelIdStr: string,
  mimeType?: string
): Promise<{ fileId: string; messageId: number; fileSizeMB: string }> {
  if (!_client || _authState !== "connected") {
    throw new Error("MTProto client not connected. Connect via Telegram → Connect page.");
  }

  const stat = fs.statSync(filePath);
  const fileSizeMB = (stat.size / (1024 * 1024)).toFixed(1);
  const isVideo = isVideoFile(filePath, mimeType);

  // Probe video metadata and generate thumbnail before starting transfer
  let videoMeta: VideoMeta | null = null;
  let thumbPath: string | null = null;
  if (isVideo) {
    try {
      videoMeta = await getVideoMeta(filePath);
      logger.info({ jobId, videoMeta }, "GramJS: Video metadata probed");
    } catch (err) {
      logger.warn({ err, jobId }, "GramJS: ffprobe failed — will upload as document");
    }
    if (videoMeta && videoMeta.duration > 0) {
      thumbPath = await generateThumbnail(filePath, videoMeta.duration);
      if (thumbPath) logger.info({ jobId, thumbPath }, "GramJS: Thumbnail generated");
    }
  }

  emitProgress(jobId, { phase: "uploading_to_telegram", percent: 0, fileSizeMB });

  const MAX_RETRIES = 3;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        logger.info({ jobId, attempt }, "GramJS: Retrying upload");
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        emitProgress(jobId, { phase: "uploading_to_telegram", percent: 0, fileSizeMB });
      }

      // Resolve entity — try direct, then refresh dialogs
      let entity: any;
      try {
        entity = await _client.getEntity(channelIdStr);
      } catch {
        await _client.getDialogs({ limit: 50 }).catch(() => {});
        entity = await _client.getEntity(channelIdStr);
      }

      // Always try as video for video files — even if ffprobe failed (zero dimensions still
      // give native Telegram video player, whereas forceDocument gives a blue file icon).
      const tryAsVideo = isVideo;
      // Use probed metadata if available; fall back to safe zeros so the video attribute is
      // still attached and Telegram stores it as a video type.
      const effectiveMeta: VideoMeta = videoMeta ?? { duration: 0, width: 0, height: 0 };
      let result: any;
      try {
        result = await doSendFile(entity, filePath, caption, stat, fileSizeMB, jobId, tryAsVideo, effectiveMeta, thumbPath);
      } catch (mediaErr: any) {
        const mediaMsg: string = mediaErr?.message ?? mediaErr?.errorMessage ?? "";
        if (
          tryAsVideo &&
          (mediaMsg.includes("MEDIA_INVALID") || mediaMsg.includes("VIDEO_CONTENT_TYPE_INVALID"))
        ) {
          logger.warn({ jobId, mediaMsg }, "GramJS: Video upload rejected — falling back to document");
          emitProgress(jobId, { phase: "uploading_to_telegram", percent: 0, fileSizeMB });
          result = await doSendFile(entity, filePath, caption, stat, fileSizeMB, jobId, false, null, null);
        } else {
          throw mediaErr;
        }
      }

      const messageId: number = result.id;
      logger.info({ jobId, messageId, fileName, asVideo: tryAsVideo }, "GramJS: Upload complete");

      emitProgress(jobId, { phase: "uploading_to_telegram", percent: 99, fileSizeMB });

      // Wait for Bot API to receive the channel_post and give us the Bot API file_id
      let botFileId = "";
      try {
        botFileId = await waitForChannelPostFileId(messageId, 25000);
        logger.info({ jobId, messageId, botFileId }, "GramJS: Got Bot API file_id");
      } catch {
        logger.warn({ jobId, messageId }, "GramJS: Bot API file_id not received — storing empty string");
      }

      emitProgress(jobId, { phase: "complete", percent: 100, fileId: botFileId, messageId, fileSizeMB });
      _uploadJobs.delete(jobId);

      if (thumbPath) fs.unlink(thumbPath, () => {});

      return { fileId: botFileId, messageId, fileSizeMB };
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      logger.error({ err, jobId, attempt }, "GramJS: Upload attempt failed");

      const msg: string = err.message ?? err.errorMessage ?? "";

      // Auth key revoked — session is dead. Clear it immediately and don't retry.
      if (
        msg.includes("AUTH_KEY_UNREGISTERED") ||
        msg.includes("AUTH_KEY_INVALID") ||
        msg.includes("AUTH_KEY_DUPLICATED") ||
        err.code === 401
      ) {
        logger.warn({ jobId }, "GramJS: Session revoked by Telegram — clearing saved session");
        try { if (_client) await _client.disconnect().catch(() => {}); } catch {}
        _client = null;
        _authState = "disconnected";
        _lastError = "SESSION_EXPIRED";
        saveSettings({ telegramSession: "" });
        lastErr = new Error(
          "SESSION_EXPIRED: Your Telegram session was revoked. Go to Admin → Telegram Connect and sign in again."
        );
        break; // non-retryable
      }

      const msgLower = msg.toLowerCase();

      // FILE_PARTS_INVALID means the MTProto upload session got corrupted —
      // reconnecting resets it and a fresh attempt succeeds with a new file ID.
      const needsReconnect = msgLower.includes("file_parts_invalid") || msgLower.includes("file_parts_missing");

      const isRetryable =
        needsReconnect ||
        msgLower.includes("timeout") ||
        msgLower.includes("network") ||
        msgLower.includes("connection") ||
        msgLower.includes("flood") ||
        msgLower.includes("reset");

      if (!isRetryable || attempt >= MAX_RETRIES - 1) break;

      // Reconnect before retry to clear stale upload state
      if (needsReconnect && _client) {
        try {
          logger.info({ jobId, attempt }, "GramJS: Reconnecting to clear stale upload state");
          await _client.disconnect().catch(() => {});
          await _client.connect();
        } catch (reconnErr) {
          logger.warn({ reconnErr }, "GramJS: Reconnect failed — continuing anyway");
        }
      }
    }
  }

  if (thumbPath) fs.unlink(thumbPath, () => {});

  const errMsg = lastErr?.message ?? "Upload failed";
  emitProgress(jobId, { phase: "error", percent: 0, error: errMsg });
  _uploadJobs.delete(jobId);
  throw lastErr ?? new Error("Upload failed");
}
