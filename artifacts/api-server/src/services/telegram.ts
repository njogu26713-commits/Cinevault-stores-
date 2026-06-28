import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";

let bot: TelegramBot | null = null;

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

  bot.onText(/\/start/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      "👋 Welcome to *CineVault Bot*!\n\nForward me any movie/episode file from your channel and I'll reply with its *File ID* so you can paste it into the admin dashboard.",
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/getfileid/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      "📎 Forward or send me a file (video or document) and I'll reply with its *File ID*.",
      { parse_mode: "Markdown" }
    );
  });

  bot.on("message", (msg) => {
    const fileId =
      msg.document?.file_id ||
      msg.video?.file_id ||
      msg.audio?.file_id ||
      msg.animation?.file_id;

    if (!fileId) return;

    const fileName =
      msg.document?.file_name ||
      msg.video?.file_name ||
      "file";

    const fileSize = msg.document?.file_size || msg.video?.file_size;
    const sizeMB = fileSize ? `${(fileSize / 1024 / 1024).toFixed(1)} MB` : "unknown size";

    bot!.sendMessage(
      msg.chat.id,
      `✅ *File ID retrieved!*\n\n📁 *File:* ${fileName}\n📦 *Size:* ${sizeMB}\n\n\`\`\`\n${fileId}\n\`\`\`\n\nCopy the ID above and paste it into the *Telegram File ID* field in your admin dashboard.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  logger.info("Telegram bot polling started — forward files to get their File IDs");
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

  try {
    const notificationMsg = `🎬 Your purchase is ready!\n\n*${movieTitle}*\n\nOrder ID: \`${orderId}\`\n\nYour movie file is being sent now...`;
    const chat = await telegramBot.getChat(`@${username}`);

    await telegramBot.sendMessage(chat.id, notificationMsg, {
      parse_mode: "Markdown",
    });

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
