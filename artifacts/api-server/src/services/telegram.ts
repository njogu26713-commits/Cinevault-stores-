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

export async function deliverMovieToUser(params: {
  telegramUsername: string;
  telegramFileId: string;
  movieTitle: string;
  orderId: string;
}): Promise<void> {
  const { telegramUsername, telegramFileId, movieTitle, orderId } = params;

  const telegramBot = getTelegramBot();

  // Resolve the chat ID from the username
  // The user must have started a conversation with the bot first
  const username = telegramUsername.replace(/^@/, "");

  try {
    // Send a notification message first
    const notificationMsg = `🎬 Your purchase is ready!\n\n*${movieTitle}*\n\nOrder ID: \`${orderId}\`\n\nYour movie file is being sent now...`;

    // Get chat ID — user must have sent /start to the bot
    const chat = await telegramBot.getChat(`@${username}`);

    await telegramBot.sendMessage(chat.id, notificationMsg, {
      parse_mode: "Markdown",
    });

    // Send the actual movie file
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
    // First try to get chat — user must have /start-ed the bot
    let chatId: number | string;
    try {
      const chat = await telegramBot.getChat(`@${username}`);
      chatId = chat.id;
    } catch {
      // Fallback: try sending directly to @username (works for public usernames with privacy off)
      chatId = `@${username}`;
    }

    // Send welcome message
    await telegramBot.sendMessage(
      chatId,
      `🎬 *CineVault* — Your movie is ready!\n\n*${movieTitle}*\n\nSending your file now...`,
      { parse_mode: "Markdown" }
    );

    // Forward the video document from the channel
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
