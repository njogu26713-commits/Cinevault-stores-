import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import { resolveChannelPostFileId } from "./gramjs";

let bot: TelegramBot | null = null;

export interface ChannelFile {
  fileId: string;
  fileName: string;
  caption: string;
  mimeType: string;
  fileSize: number;
  messageId: number;
  chatId: number;
  timestamp: number;
}

const channelFileBuffer: ChannelFile[] = [];
const MAX_BUFFER = 200;

export function getChannelFileBuffer(): ChannelFile[] {
  return [...channelFileBuffer];
}

export function removeFromChannelBuffer(fileId: string): void {
  const idx = channelFileBuffer.findIndex((f) => f.fileId === fileId);
  if (idx !== -1) channelFileBuffer.splice(idx, 1);
}

function pushToBuffer(file: ChannelFile): void {
  // Avoid duplicates
  if (channelFileBuffer.some((f) => f.fileId === file.fileId)) return;
  channelFileBuffer.unshift(file);
  if (channelFileBuffer.length > MAX_BUFFER) channelFileBuffer.pop();
}

export function getTelegramBot(): TelegramBot {
  if (bot) return bot;

  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  bot = new TelegramBot(token, { polling: false });
  return bot;
}

export async function startBotPolling(): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot polling skipped");
    return;
  }

  if (bot) {
    try { await bot.stopPolling(); } catch {}
    bot = null;
  }

  // Only force-clear competing sessions in production.
  // In development the deployed production app is likely already polling — calling
  // deleteWebhook here would kill it and flood its logs with 409 errors.
  const isProduction = process.env["NODE_ENV"] === "production";
  if (isProduction) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`
      );
      const json = await res.json() as { ok: boolean };
      if (json.ok) logger.info("Telegram: cleared webhook/session before polling");
    } catch (err) {
      logger.warn({ err }, "Telegram: failed to clear webhook before polling (continuing)");
    }
  } else {
    logger.info("Telegram: dev mode — skipping deleteWebhook to preserve deployed app polling");
  }

  // Retry with exponential backoff to handle 409 Conflict from Telegram
  // (Telegram keeps old long-poll sessions alive for ~30s after process death)
  const MAX_ATTEMPTS = 6;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const waitMs = attempt === 1 ? 2000 : Math.min(5000 * 2 ** (attempt - 2), 30000);
    await new Promise((r) => setTimeout(r, waitMs));

    bot = new TelegramBot(token, { polling: false });

    try {
      await (bot as any).startPolling();
      logger.info(`Telegram bot polling started on attempt ${attempt}`);
      break;
    } catch (err: any) {
      const is409 = err?.message?.includes("409") || err?.code === "ETELEGRAM";
      if (is409 && attempt < MAX_ATTEMPTS) {
        logger.warn(`Telegram 409 conflict on attempt ${attempt}, retrying in ${waitMs}ms…`);
        try { await bot.stopPolling(); } catch {}
        bot = null;
        continue;
      }
      // Non-409 or exhausted retries — rethrow
      throw err;
    }
  }

  // ── /start ─────────────────────────────────────────────────────────────────
  bot!.onText(/\/start/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      "👋 Welcome to *CineVault Bot*!\n\nForward me any movie/episode file from your channel and I'll reply with its *File ID* so you can paste it into the admin dashboard.\n\nOr use *Sync Telegram* in the admin panel to auto-assign files to movies automatically.",
      { parse_mode: "Markdown" }
    );
  });

  // ── /getfileid ─────────────────────────────────────────────────────────────
  bot!.onText(/\/getfileid/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      "📎 Forward or send me a file (video or document) and I'll reply with its *File ID*.",
      { parse_mode: "Markdown" }
    );
  });

  // ── Direct messages (file forwarded to bot) ────────────────────────────────
  bot!.on("message", (msg) => {
    const doc = msg.document;
    const vid = msg.video;
    const fileId = doc?.file_id || vid?.file_id || msg.audio?.file_id || msg.animation?.file_id;
    if (!fileId) return;

    const fileName = doc?.file_name || vid?.file_name || "file";
    const fileSize = doc?.file_size || vid?.file_size || 0;
    const mimeType = doc?.mime_type || vid?.mime_type || "application/octet-stream";

    bot!.sendMessage(
      msg.chat.id,
      `✅ *File ID retrieved!*\n\n📁 *File:* ${fileName}\n📦 *Size:* ${(fileSize / 1024 / 1024).toFixed(1)} MB\n\n\`\`\`\n${fileId}\n\`\`\`\n\nCopy the ID above and paste it into the *Telegram File ID* field in your admin dashboard — or click *Sync Telegram* to auto-assign it.`,
      { parse_mode: "Markdown" }
    );
  });

  // ── Channel posts (bot is admin of the channel) ────────────────────────────
  bot!.on("channel_post", (msg) => {
    const doc = msg.document;
    const vid = msg.video;
    const fileId = doc?.file_id || vid?.file_id || msg.audio?.file_id || msg.animation?.file_id;
    if (!fileId) return;

    const fileName = doc?.file_name || vid?.file_name || "file";
    const fileSize = doc?.file_size || vid?.file_size || 0;
    const mimeType = doc?.mime_type || vid?.mime_type || "application/octet-stream";
    const caption = msg.caption || "";

    pushToBuffer({
      fileId,
      fileName,
      caption,
      mimeType,
      fileSize,
      messageId: msg.message_id,
      chatId: msg.chat.id,
      timestamp: msg.date * 1000,
    });

    // Notify any pending GramJS upload waiting for this file_id
    resolveChannelPostFileId(msg.message_id, fileId);

    logger.info(
      { fileId, fileName, caption, chatId: msg.chat.id },
      "Channel file buffered for Sync Telegram"
    );
  });

  bot!.on("polling_error", (err: any) => {
    const is409 = err?.message?.includes("409") || err?.code === "ETELEGRAM";
    if (is409) {
      // Telegram keeps old sessions alive briefly after restart — ignore until it clears
      logger.warn("Telegram polling 409 conflict (old session still closing, will auto-resolve)");
    } else {
      logger.error({ err }, "Telegram polling error");
    }
  });

  logger.info("Telegram bot polling started — channel_post events will auto-buffer for Sync");
}

// ── Delivery helpers ───────────────────────────────────────────────────────────

/**
 * Resolve a Telegram chat ID from a username.
 * Returns the numeric chat ID when available (more reliable), otherwise `@username`.
 */
async function resolveChatId(telegramBot: TelegramBot, username: string): Promise<number | string> {
  try {
    const chat = await telegramBot.getChat(`@${username}`);
    return chat.id;
  } catch {
    // getChat fails for users who haven't started the bot — fall back to @username
    return `@${username}`;
  }
}

/**
 * Send a file to a chat, trying sendVideo first (native player) and falling back
 * to sendDocument if Telegram rejects the file_id as a video type.
 */
async function sendFileToChat(
  telegramBot: TelegramBot,
  chatId: number | string,
  fileId: string,
  caption: string
): Promise<void> {
  // Try as video first — gives the native Telegram video player with play button
  try {
    await (telegramBot as any).sendVideo(chatId, fileId, {
      caption,
      parse_mode: "Markdown",
      supports_streaming: true,
    });
    return;
  } catch (videoErr: any) {
    const msg: string = videoErr?.message ?? "";
    // If Telegram says the file_id is wrong type (i.e. it was actually uploaded as a document),
    // fall through to sendDocument. Otherwise rethrow.
    const isTypeMismatch =
      msg.includes("wrong file identifier") ||
      msg.includes("DOCUMENT_INVALID") ||
      msg.includes("wrong type") ||
      msg.includes("Bad Request");
    if (!isTypeMismatch) throw videoErr;
    logger.info({ chatId }, "Delivery: sendVideo failed — retrying as document");
  }

  // Fallback: send as document (blue icon — still downloadable)
  await (telegramBot as any).sendDocument(chatId, fileId, {
    caption,
    parse_mode: "Markdown",
  });
}

export async function deliverMovieToUser(params: {
  telegramUsername: string;
  telegramFileId: string;
  movieTitle: string;
  orderId: string;
}): Promise<void> {
  const { telegramUsername, telegramFileId, movieTitle, orderId } = params;
  const telegramBot = getTelegramBot();
  const username = telegramUsername.replace(/^@/, "");
  const chatId = await resolveChatId(telegramBot, username);

  try {
    await telegramBot.sendMessage(
      chatId,
      `🎬 Your purchase is ready!\n\n*${movieTitle}*\n\nOrder ID: \`${orderId}\`\n\nYour movie is being sent now...`,
      { parse_mode: "Markdown" }
    );
    await sendFileToChat(
      telegramBot,
      chatId,
      telegramFileId,
      `🎬 *${movieTitle}*\n\nThank you for your purchase from CineVault! Enjoy the movie 🍿`
    );
    logger.info({ username, movieTitle, orderId }, "Movie delivered via Telegram");
  } catch (err) {
    logger.error({ err, username, movieTitle, orderId }, "Failed to deliver movie via Telegram");
    throw err;
  }
}

export async function deliverMovieFromChannel(params: {
  telegramUsername: string;
  telegramFileId: string;
  movieTitle: string;
  orderId: string;
}): Promise<void> {
  const { telegramUsername, telegramFileId, movieTitle, orderId } = params;
  const telegramBot = getTelegramBot();
  const username = telegramUsername.replace(/^@/, "");
  const chatId = await resolveChatId(telegramBot, username);

  try {
    await telegramBot.sendMessage(
      chatId,
      `🎬 *CineVault* — Your movie is ready!\n\n*${movieTitle}*\n\nSending your file now...`,
      { parse_mode: "Markdown" }
    );
    await sendFileToChat(
      telegramBot,
      chatId,
      telegramFileId,
      `🎬 *${movieTitle}*\n\nThank you for your purchase from CineVault! Enjoy the movie 🍿`
    );
    logger.info({ username, movieTitle, orderId }, "Movie delivered successfully via Telegram");
  } catch (err) {
    logger.error({ err, username, movieTitle, orderId }, "Failed to deliver movie via Telegram");
    throw err;
  }
}
