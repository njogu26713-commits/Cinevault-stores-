import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { EventEmitter } from "events";
import fs from "fs";
import { logger } from "../lib/logger";
import { getSetting, saveSettings } from "../lib/settings-store";

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
    try { await _client.invoke(new Api.auth.LogOut({})); } catch {}
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

// ── File Upload ───────────────────────────────────────────────────────────────

export async function uploadFileToChannel(
  jobId: string,
  filePath: string,
  fileName: string,
  caption: string,
  channelIdStr: string
): Promise<{ fileId: string; messageId: number; fileSizeMB: string }> {
  if (!_client || _authState !== "connected") {
    throw new Error("MTProto client not connected. Connect via Telegram → Connect page.");
  }

  const stat = fs.statSync(filePath);
  const fileSizeMB = (stat.size / (1024 * 1024)).toFixed(1);

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

      let lastPercent = -1;
      let lastSpeedTime = Date.now();
      let lastSpeedBytes = 0;

      const result: any = await (_client as any).sendFile(entity, {
        file: filePath,
        caption,
        forceDocument: true,
        workers: 4,
        progressCallback: (progress: number) => {
          const rawPercent = Math.min(99, Math.round(progress * 100));
          const now = Date.now();
          const dtSec = (now - lastSpeedTime) / 1000;
          const loadedBytes = progress * stat.size;
          let speedMBps = 0;

          if (dtSec > 0.5) {
            speedMBps =
              Math.max(0, Math.round(((loadedBytes - lastSpeedBytes) / dtSec / (1024 * 1024)) * 10) / 10);
            lastSpeedTime = now;
            lastSpeedBytes = loadedBytes;
          }

          if (rawPercent !== lastPercent) {
            lastPercent = rawPercent;
            emitProgress(jobId, {
              phase: "uploading_to_telegram",
              percent: rawPercent,
              speedMBps,
              fileSizeMB,
            });
          }
        },
      });

      const messageId: number = result.id;
      logger.info({ jobId, messageId, fileName }, "GramJS: Upload complete");

      emitProgress(jobId, {
        phase: "uploading_to_telegram",
        percent: 99,
        fileSizeMB,
      });

      // Wait for Bot API to receive the channel_post and give us the Bot API file_id
      let botFileId = "";
      try {
        botFileId = await waitForChannelPostFileId(messageId, 25000);
        logger.info({ jobId, messageId, botFileId }, "GramJS: Got Bot API file_id");
      } catch {
        logger.warn({ jobId, messageId }, "GramJS: Bot API file_id not received — storing empty string");
      }

      emitProgress(jobId, {
        phase: "complete",
        percent: 100,
        fileId: botFileId,
        messageId,
        fileSizeMB,
      });

      _uploadJobs.delete(jobId);
      return { fileId: botFileId, messageId, fileSizeMB };
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      logger.error({ err, jobId, attempt }, "GramJS: Upload attempt failed");

      const msg = (err.message ?? err.errorMessage ?? "");

      // Auth key revoked — session is dead. Clear it immediately and don't retry.
      if (
        msg.includes("AUTH_KEY_UNREGISTERED") ||
        msg.includes("AUTH_KEY_INVALID") ||
        msg.includes("AUTH_KEY_DUPLICATED") ||
        (err.code === 401)
      ) {
        logger.warn({ jobId }, "GramJS: Session revoked by Telegram — clearing saved session");
        try {
          if (_client) await _client.disconnect().catch(() => {});
        } catch {}
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
      const isRetryable =
        msgLower.includes("timeout") ||
        msgLower.includes("network") ||
        msgLower.includes("connection") ||
        msgLower.includes("flood") ||
        msgLower.includes("reset");

      if (!isRetryable || attempt >= MAX_RETRIES - 1) break;
    }
  }

  const errMsg = lastErr?.message ?? "Upload failed";
  emitProgress(jobId, { phase: "error", percent: 0, error: errMsg });
  _uploadJobs.delete(jobId);
  throw lastErr ?? new Error("Upload failed");
}
