import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";

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

export function startBotPolling(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot polling skipped");
    return;
  }

  if (bot) {
    try { bot.stopPolling(); } catch {}
  }

  bot = new TelegramBot(token, { polling: true });

  // ── /start ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      "👋 Welcome to *CineVault Bot*!\n\nForward me any movie/episode file from your channel and I'll reply with its *File ID* so you can paste it into the admin dashboard.\n\nOr use *Sync Telegram* in the admin panel to auto-assign files to movies automatically.",
      { parse_mode: "Markdown" }
    );
  });

  // ── /getfileid ─────────────────────────────────────────────────────────────
  bot.onText(/\/getfileid/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      "📎 Forward or send me a file (video or document) and I'll reply with its *File ID*.",
      { parse_mode: "Markdown" }
    );
  });

  // ── Direct messages (file forwarded to bot) ────────────────────────────────
  bot.on("message", (msg) => {
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
  bot.on("channel_post", (msg) => {
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

    logger.info(
      { fileId, fileName, caption, chatId: msg.chat.id },
      "Channel file buffered for Sync Telegram"
    );
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  logger.info("Telegram bot polling started — channel_post events will auto-buffer for Sync");
}

// ── Delivery helpers ───────────────────────────────────────────────────────────

export async function deliverMovieToUser(params: {
  telegramUsername: string;
  telegramFileId: string;
  movieTitle: string;
  orderId: string;
}): Promise<void> {
  const { telegramUsername, telegramFileId, movieTitle, orderId } = params;
  const telegramBot = getTelegramBot();
  const username = telegramUsername.replace(/^@/, "");

  try {
    const chat = await telegramBot.getChat(`@${username}`);
    await telegramBot.sendMessage(
      chat.id,
      `🎬 Your purchase is ready!\n\n*${movieTitle}*\n\nOrder ID: \`${orderId}\`\n\nYour movie file is being sent now...`,
      { parse_mode: "Markdown" }
    );
    await telegramBot.sendDocument(chat.id, telegramFileId, {
      caption: `*${movieTitle}*\n\nThank you for your purchase! Enjoy the movie.`,
      parse_mode: "Markdown",
    });
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

  try {
    let chatId: number | string;
    try {
      const chat = await telegramBot.getChat(`@${username}`);
      chatId = chat.id;
    } catch {
      chatId = `@${username}`;
    }

    await telegramBot.sendMessage(
      chatId,
      `🎬 *CineVault* — Your movie is ready!\n\n*${movieTitle}*\n\nSending your file now...`,
      { parse_mode: "Markdown" }
    );
    await telegramBot.sendDocument(chatId, telegramFileId, {
      caption: `*${movieTitle}*\n\nThank you for your purchase from CineVault! Enjoy the movie.`,
      parse_mode: "Markdown",
    });
    logger.info({ username, movieTitle, orderId }, "Movie delivered successfully via Telegram");
  } catch (err) {
    logger.error({ err, username, movieTitle, orderId }, "Failed to deliver movie via Telegram");
    throw err;
  }
}
