import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fs = await import("fs");

  const adminDist = path.resolve(__dirname, "../../admin-dashboard/dist/public");
  if (fs.existsSync(adminDist)) {
    app.use("/admin", express.static(adminDist));
    app.get("/admin/{*path}", (_req, res) => {
      res.sendFile(path.join(adminDist, "index.html"));
    });
  } else {
    logger.error({ adminDist }, "Admin dashboard dist not found — /admin will return 404. Ensure the build ran with BASE_PATH=/admin/");
  }

  const marketplaceDist = path.resolve(__dirname, "../../movie-marketplace/dist/public");
  if (fs.existsSync(marketplaceDist)) {
    app.use(express.static(marketplaceDist));
    app.get("/{*path}", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/admin")) return next();
      res.sendFile(path.join(marketplaceDist, "index.html"));
    });
  }
}

export default app;
