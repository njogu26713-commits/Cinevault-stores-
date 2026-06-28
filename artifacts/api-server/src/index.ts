import app from "./app";
import { logger } from "./lib/logger";
import { connectMongoDB } from "./lib/mongodb";
import { startBotPolling } from "./services/telegram";
import { initializeGramJS } from "./services/gramjs";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await connectMongoDB();
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB — starting without DB (some routes will fail)");
  }

  // Start Telegram bot polling for file ID extraction
  try {
    startBotPolling();
  } catch (err) {
    logger.warn({ err }, "Telegram bot polling failed to start — delivery and file ID features may not work");
  }

  // Initialize GramJS MTProto client (if session is saved)
  try {
    await initializeGramJS();
  } catch (err) {
    logger.warn({ err }, "GramJS MTProto init failed — connect via admin panel");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start();
