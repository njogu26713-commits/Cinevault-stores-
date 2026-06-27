import app from "./app";
import { logger } from "./lib/logger";
import { connectMongoDB } from "./lib/mongodb";

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

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start();
