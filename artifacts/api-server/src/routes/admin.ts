import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import mongoose from "mongoose";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";
import { Order } from "../models/Order";
import { MovieNotification } from "../models/MovieNotification";
import { SeriesNotification } from "../models/SeriesNotification";
import { getTelegramBot, getChannelFileBuffer, removeFromChannelBuffer, deliverMovieFromChannel } from "../services/telegram";
import { logger } from "../lib/logger";
import { getSetting, saveSettings } from "../lib/settings-store";

const router = Router();
const upload = multer({ dest: os.tmpdir() });

// ── GET /admin/stats ─────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [totalMovies, totalSeries, orderAgg, recentOrders, topMoviesAgg, revenueByDayAgg] =
      await Promise.all([
        Movie.countDocuments(),
        Series.countDocuments(),
        Order.aggregate([
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [{ $eq: ["$paymentStatus", "confirmed"] }, "$amount", 0],
                },
              },
              deliveredOrders: {
                $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
              },
              pendingOrders: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["pending", "payment_initiated", "payment_confirmed", "delivering"]] },
                    1,
                    0,
                  ],
                },
              },
              failedOrders: {
                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
              },
            },
          },
        ]),
        Order.find().sort({ createdAt: -1 }).limit(10).lean(),
        Order.aggregate([
          { $match: { paymentStatus: "confirmed" } },
          {
            $group: {
              _id: { movieId: "$movieId", movieTitle: "$movieTitle", moviePosterUrl: "$moviePosterUrl" },
              totalSales: { $sum: 1 },
              totalRevenue: { $sum: "$amount" },
            },
          },
          { $sort: { totalSales: -1 } },
          { $limit: 5 },
        ]),
        Order.aggregate([
          { $match: { paymentStatus: "confirmed" } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: { $sum: "$amount" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: -1 } },
          { $limit: 30 },
        ]),
      ]);

    const stats = orderAgg[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      deliveredOrders: 0,
      pendingOrders: 0,
      failedOrders: 0,
    };

    const formatOrder = (o: any) => ({
      id: o._id.toString(),
      movieId: o.movieId,
      movieTitle: o.movieTitle,
      moviePosterUrl: o.moviePosterUrl,
      telegramUsername: o.telegramUsername,
      phone: o.phone,
      amount: o.amount,
      status: o.status,
      paymentStatus: o.paymentStatus,
      checkoutRequestId: o.checkoutRequestId ?? null,
      merchantRequestId: o.merchantRequestId ?? null,
      mpesaReceiptNumber: o.mpesaReceiptNumber ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      failureReason: o.failureReason ?? null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    });

    return res.json({
      totalMovies,
      totalSeries,
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      deliveredOrders: stats.deliveredOrders,
      pendingOrders: stats.pendingOrders,
      failedOrders: stats.failedOrders,
      recentOrders: recentOrders.map(formatOrder),
      revenueByDay: revenueByDayAgg.map((d: any) => ({
        date: d._id,
        revenue: d.revenue,
        orders: d.orders,
      })).reverse(),
      topMovies: topMoviesAgg.map((m: any) => ({
        movieId: m._id.movieId,
        movieTitle: m._id.movieTitle,
        moviePosterUrl: m._id.moviePosterUrl,
        totalSales: m.totalSales,
        totalRevenue: m.totalRevenue,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to get admin stats");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/orders ────────────────────────────────────────────────────────
router.get("/orders", async (req, res) => {
  try {
    const { search, status, paymentStatus, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search) {
      filter.$or = [
        { movieTitle: { $regex: search, $options: "i" } },
        { telegramUsername: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { mpesaReceiptNumber: { $regex: search, $options: "i" } },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Order.countDocuments(filter),
    ]);

    const formatOrder = (o: any) => ({
      id: o._id.toString(),
      movieId: o.movieId,
      movieTitle: o.movieTitle,
      moviePosterUrl: o.moviePosterUrl,
      telegramUsername: o.telegramUsername,
      phone: o.phone,
      amount: o.amount,
      status: o.status,
      paymentStatus: o.paymentStatus,
      checkoutRequestId: o.checkoutRequestId ?? null,
      merchantRequestId: o.merchantRequestId ?? null,
      mpesaReceiptNumber: o.mpesaReceiptNumber ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      failureReason: o.failureReason ?? null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    });

    return res.json({
      orders: orders.map(formatOrder),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list admin orders");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/users ─────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    const matchStage: Record<string, any> = {};
    if (search) {
      matchStage.$or = [
        { telegramUsername: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const pipeline: any[] = [
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: "$telegramUsername",
          phone: { $first: "$phone" },
          totalOrders: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "confirmed"] }, "$amount", 0],
            },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          lastOrderAt: { $max: "$createdAt" },
        },
      },
      { $sort: { lastOrderAt: -1 } },
    ];

    const allUsers = await Order.aggregate(pipeline);
    const total = allUsers.length;
    const users = allUsers.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({
      users: users.map((u: any) => ({
        telegramUsername: u._id,
        phone: u.phone,
        totalOrders: u.totalOrders,
        totalSpent: u.totalSpent,
        deliveredOrders: u.deliveredOrders,
        lastOrderAt: u.lastOrderAt.toISOString(),
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list admin users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/movies/:id/upload-file ───────────────────────────────────────
router.post("/movies/:id/upload-file", upload.single("file"), async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid movie ID" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const channelId = process.env["TELEGRAM_CHANNEL_ID"];
  if (!channelId) {
    // Clean up temp file
    fs.unlink(file.path, () => {});
    return res.status(500).json({ error: "TELEGRAM_CHANNEL_ID is not configured" });
  }

  try {
    const movie = await Movie.findById(id);
    if (!movie) {
      fs.unlink(file.path, () => {});
      return res.status(404).json({ error: "Movie not found" });
    }

    const bot = getTelegramBot();

    // Upload document to Telegram channel
    const originalName = file.originalname || `${movie.title}.mp4`;
    const caption = `🎬 ${movie.title} (${movie.year}) | ${movie.quality} | ${movie.fileSize}`;

    const sentMessage = await bot.sendDocument(channelId, file.path, {
      caption,
      // @ts-ignore — node-telegram-bot-api supports this
      parse_mode: "Markdown",
    }, {
      filename: originalName,
      contentType: file.mimetype || "video/mp4",
    });

    const fileId = sentMessage.document?.file_id;
    if (!fileId) {
      throw new Error("Telegram did not return a file_id");
    }

    // Save file_id to the movie
    await Movie.findByIdAndUpdate(id, {
      telegramFileId: fileId,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    });

    logger.info({ movieId: id, fileId, fileName: originalName }, "Movie uploaded to Telegram");

    return res.json({
      telegramFileId: fileId,
      fileSize: file.size,
      fileName: originalName,
    });
  } catch (err) {
    logger.error({ err, movieId: id }, "Failed to upload movie to Telegram");
    return res.status(500).json({ error: "Upload failed", details: String(err) });
  } finally {
    // Clean up temp file
    fs.unlink(file.path, () => {});
  }
});

// ── PUT /admin/movies/:id ─────────────────────────────────────────────────────
router.put("/movies/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid movie ID" });
  }

  const { telegramFileId } = req.body as { telegramFileId?: string };

  if (!telegramFileId || typeof telegramFileId !== "string") {
    return res.status(400).json({ error: "telegramFileId is required" });
  }

  try {
    const movie = await Movie.findByIdAndUpdate(
      id,
      { telegramFileId: telegramFileId.trim() },
      { new: true }
    );

    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }

    logger.info({ movieId: id, telegramFileId }, "Movie file ID saved manually");
    return res.json({ telegramFileId: movie.telegramFileId });
  } catch (err) {
    logger.error({ err, movieId: id }, "Failed to save movie file ID");
    return res.status(500).json({ error: "Failed to save file ID" });
  }
});

// ── POST /admin/series/:id/seasons/:sIdx/episodes/:eIdx/upload-file ──────────
router.post("/series/:id/seasons/:sIdx/episodes/:eIdx/upload-file", upload.single("file"), async (req, res) => {
  const { id, sIdx, eIdx } = req.params;
  const seasonIdx = Number(sIdx);
  const episodeIdx = Number(eIdx);

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid series ID" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const channelId = process.env["TELEGRAM_CHANNEL_ID"];
  if (!channelId) {
    fs.unlink(file.path, () => {});
    return res.status(500).json({ error: "TELEGRAM_CHANNEL_ID is not configured" });
  }

  try {
    const series = await Series.findById(id);
    if (!series) {
      fs.unlink(file.path, () => {});
      return res.status(404).json({ error: "Series not found" });
    }

    const season = series.seasons[seasonIdx];
    if (!season) {
      fs.unlink(file.path, () => {});
      return res.status(404).json({ error: "Season not found" });
    }

    const episode = season.episodes[episodeIdx];
    if (!episode) {
      fs.unlink(file.path, () => {});
      return res.status(404).json({ error: "Episode not found" });
    }

    const bot = getTelegramBot();
    const originalName = file.originalname || `${series.title}_S${season.seasonNumber}E${episode.episodeNumber}.mp4`;
    const caption = `📺 ${series.title} | S${season.seasonNumber}E${String(episode.episodeNumber).padStart(2, "0")} - ${episode.title}`;

    const sentMessage = await bot.sendDocument(channelId, file.path, {
      caption,
    }, {
      filename: originalName,
      contentType: file.mimetype || "video/mp4",
    });

    const fileId = sentMessage.document?.file_id;
    if (!fileId) throw new Error("Telegram did not return a file_id");

    series.seasons[seasonIdx].episodes[episodeIdx].telegramFileId = fileId;
    await series.save();

    logger.info({ seriesId: id, seasonIdx, episodeIdx, fileId }, "Episode uploaded to Telegram");
    return res.json({ telegramFileId: fileId });
  } catch (err: any) {
    logger.error({ err, seriesId: id }, "Failed to upload episode to Telegram");
    return res.status(500).json({ error: "Upload failed", details: String(err) });
  } finally {
    fs.unlink(file.path, () => {});
  }
});

// ── PUT /admin/series/:id/seasons/:sIdx/episodes/:eIdx/file-id ───────────────
router.put("/series/:id/seasons/:sIdx/episodes/:eIdx/file-id", async (req, res) => {
  const { id, sIdx, eIdx } = req.params;
  const seasonIdx = Number(sIdx);
  const episodeIdx = Number(eIdx);

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid series ID" });
  }

  const { telegramFileId } = req.body as { telegramFileId?: string };
  if (!telegramFileId || typeof telegramFileId !== "string") {
    return res.status(400).json({ error: "telegramFileId is required" });
  }

  try {
    const series = await Series.findById(id);
    if (!series) return res.status(404).json({ error: "Series not found" });

    const season = series.seasons[seasonIdx];
    if (!season) return res.status(404).json({ error: "Season not found" });

    const episode = season.episodes[episodeIdx];
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    series.seasons[seasonIdx].episodes[episodeIdx].telegramFileId = telegramFileId.trim();
    await series.save();

    logger.info({ seriesId: id, seasonIdx, episodeIdx, telegramFileId }, "Episode file ID saved manually");
    return res.json({ telegramFileId: telegramFileId.trim() });
  } catch (err) {
    logger.error({ err, seriesId: id }, "Failed to save episode file ID");
    return res.status(500).json({ error: "Failed to save file ID" });
  }
});

// ── GET /admin/settings ──────────────────────────────────────────────────────
router.get("/settings", async (_req, res) => {
  const mask = (v: string | undefined) => (v ? v.slice(0, 4) + "****" : "");

  return res.json({
    mpesaConsumerKey: mask(process.env["MPESA_CONSUMER_KEY"]),
    mpesaConsumerSecret: mask(process.env["MPESA_CONSUMER_SECRET"]),
    mpesaShortcode: getSetting("mpesaShortcode") || process.env["MPESA_SHORTCODE"] || "",
    mpesaPasskey: mask(process.env["MPESA_PASSKEY"]),
    mpesaCallbackUrl: getSetting("mpesaCallbackUrl") || process.env["MPESA_CALLBACK_URL"] || "",
    telegramBotToken: mask(process.env["TELEGRAM_BOT_TOKEN"]),
    telegramChannelId: getSetting("telegramChannelId") || process.env["TELEGRAM_CHANNEL_ID"] || "",
    mongoUri: mask(process.env["MONGODB_URI"]),
    adminUsername: getSetting("adminUsername") || process.env["ADMIN_USERNAME"] || "admin",
  });
});

// ── PUT /admin/settings ──────────────────────────────────────────────────────
router.put("/settings", async (req, res) => {
  const {
    mpesaConsumerKey,
    mpesaConsumerSecret,
    mpesaShortcode,
    mpesaPasskey,
    mpesaCallbackUrl,
    telegramBotToken,
    telegramChannelId,
    adminUsername,
  } = req.body;

  // Persist non-secret values to settings file so they survive restarts
  saveSettings({
    ...(mpesaShortcode && { mpesaShortcode }),
    ...(mpesaCallbackUrl && { mpesaCallbackUrl }),
    ...(telegramChannelId && { telegramChannelId }),
    ...(adminUsername && { adminUsername }),
  });

  logger.info({ adminUsername, mpesaShortcode, mpesaCallbackUrl, telegramChannelId }, "Settings updated");

  return res.json({
    mpesaConsumerKey: mpesaConsumerKey ? mpesaConsumerKey.slice(0, 4) + "****" : "",
    mpesaConsumerSecret: mpesaConsumerSecret ? mpesaConsumerSecret.slice(0, 4) + "****" : "",
    mpesaShortcode: mpesaShortcode || getSetting("mpesaShortcode") || "",
    mpesaPasskey: mpesaPasskey ? mpesaPasskey.slice(0, 4) + "****" : "",
    mpesaCallbackUrl: mpesaCallbackUrl || getSetting("mpesaCallbackUrl") || "",
    telegramBotToken: telegramBotToken ? telegramBotToken.slice(0, 4) + "****" : "",
    telegramChannelId: telegramChannelId || getSetting("telegramChannelId") || "",
    mongoUri: "",
    adminUsername: adminUsername || getSetting("adminUsername") || "admin",
  });
});

// ── GET /admin/telegram/detect-channel ───────────────────────────────────────
router.get("/telegram/detect-channel", async (_req, res) => {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN is not set. Add it in Settings first." });
  }

  try {
    // Fetch recent updates — look for my_chat_member events (bot added as admin)
    // and channel_post events (bot can see the channel)
    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=["my_chat_member","channel_post","message"]`;
    const response = await fetch(url);
    const data = await response.json() as any;

    if (!data.ok) {
      return res.status(400).json({ error: `Telegram API error: ${data.description}` });
    }

    const channelMap = new Map<string, { id: string; title: string; type: string; username?: string }>();

    for (const update of data.result ?? []) {
      // my_chat_member: bot was added/promoted in a chat
      const mcm = update.my_chat_member;
      if (mcm) {
        const chat = mcm.chat;
        const newMember = mcm.new_chat_member;
        if (
          (chat.type === "channel" || chat.type === "supergroup" || chat.type === "group") &&
          (newMember?.status === "administrator" || newMember?.status === "member")
        ) {
          channelMap.set(String(chat.id), {
            id: String(chat.id),
            title: chat.title || chat.username || String(chat.id),
            type: chat.type,
            username: chat.username,
          });
        }
      }

      // channel_post: bot is in a channel and received a message
      const cp = update.channel_post ?? update.message;
      if (cp) {
        const chat = cp.chat;
        if (chat.type === "channel" || chat.type === "supergroup" || chat.type === "group") {
          channelMap.set(String(chat.id), {
            id: String(chat.id),
            title: chat.title || chat.username || String(chat.id),
            type: chat.type,
            username: chat.username,
          });
        }
      }
    }

    // Also fetch bot info so we can display the bot name
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json() as any;
    const botName = meData.ok ? `@${meData.result.username}` : "your bot";

    const channels = Array.from(channelMap.values());

    return res.json({ channels, botName, updatesChecked: data.result?.length ?? 0 });
  } catch (err) {
    logger.error({ err }, "Telegram detect-channel failed");
    return res.status(500).json({ error: "Failed to reach Telegram API", details: String(err) });
  }
});

// ── POST /admin/telegram/save-channel ────────────────────────────────────────
router.post("/telegram/save-channel", async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) {
    return res.status(400).json({ error: "channelId is required" });
  }

  saveSettings({ telegramChannelId: String(channelId) });
  logger.info({ channelId }, "Telegram channel ID saved");

  return res.json({ ok: true, telegramChannelId: String(channelId) });
});

// ── POST /admin/telegram/sync ─────────────────────────────────────────────────
// Reads channel file buffer, fuzzy-matches against movie/series titles, auto-assigns file IDs
router.post("/telegram/sync", async (_req, res) => {
  const buffer = getChannelFileBuffer();

  if (buffer.length === 0) {
    return res.json({ matched: [], unmatched: [], bufferCount: 0 });
  }

  // Load all movies and series from DB
  const [movies, allSeries] = await Promise.all([
    Movie.find({}).lean(),
    Series.find({}).lean(),
  ]);

  function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  function titleScore(title: string, text: string): number {
    const normTitle = normalize(title);
    const normText = normalize(text);
    if (normText.includes(normTitle)) return 100;
    // Check if all significant words in the title appear in the text
    const words = normTitle.split(" ").filter((w) => w.length > 2);
    if (words.length === 0) return 0;
    const matched = words.filter((w) => normText.includes(w));
    return Math.round((matched.length / words.length) * 80);
  }

  // Parse S01E01 / S1E1 patterns
  function parseEpisode(text: string): { season: number; episode: number } | null {
    const m = text.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);
    if (m) return { season: Number(m[1]), episode: Number(m[2]) };
    return null;
  }

  const matched: Array<{ type: string; title: string; fileId: string; episodeInfo?: string }> = [];
  const unmatched: Array<{ fileName: string; caption: string; fileId: string }> = [];

  for (const file of buffer) {
    const searchText = `${file.caption} ${file.fileName}`;
    let bestScore = 0;
    let bestMatch: { kind: "movie" | "series"; id: string; title: string; ep?: { sIdx: number; eIdx: number; label: string } } | null = null;

    // Score movies
    for (const movie of movies) {
      const score = titleScore(movie.title, searchText);
      if (score > bestScore && score >= 60) {
        bestScore = score;
        bestMatch = { kind: "movie", id: String(movie._id), title: movie.title };
      }
    }

    // Score series (and try to match specific episode)
    for (const s of allSeries) {
      const score = titleScore(s.title, searchText);
      if (score >= 60 && score >= bestScore) {
        const ep = parseEpisode(searchText);
        let epMatch: { sIdx: number; eIdx: number; label: string } | undefined;
        if (ep) {
          const sIdx = s.seasons.findIndex((se: any) => se.seasonNumber === ep.season);
          if (sIdx !== -1) {
            const eIdx = s.seasons[sIdx].episodes.findIndex((e: any) => e.episodeNumber === ep.episode);
            if (eIdx !== -1) {
              epMatch = { sIdx, eIdx, label: `S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")}` };
            }
          }
        }
        if (score > bestScore || (score === bestScore && epMatch)) {
          bestScore = score;
          bestMatch = { kind: "series", id: String(s._id), title: s.title, ep: epMatch };
        }
      }
    }

    if (bestMatch) {
      try {
        if (bestMatch.kind === "movie") {
          await Movie.findByIdAndUpdate(bestMatch.id, { telegramFileId: file.fileId });
          matched.push({ type: "movie", title: bestMatch.title, fileId: file.fileId });
        } else {
          const series = await Series.findById(bestMatch.id);
          if (series && bestMatch.ep) {
            series.seasons[bestMatch.ep.sIdx].episodes[bestMatch.ep.eIdx].telegramFileId = file.fileId;
            await series.save();
            matched.push({ type: "episode", title: bestMatch.title, fileId: file.fileId, episodeInfo: bestMatch.ep.label });
          } else if (series && !bestMatch.ep) {
            // Matched series but couldn't parse episode — mark as unmatched
            unmatched.push({ fileName: file.fileName, caption: file.caption || `${bestMatch.title} (no episode info)`, fileId: file.fileId });
            continue;
          }
        }
        removeFromChannelBuffer(file.fileId);
        logger.info({ fileId: file.fileId, title: bestMatch.title }, "Telegram sync: file auto-assigned");
      } catch (err) {
        logger.error({ err, fileId: file.fileId }, "Telegram sync: failed to assign file");
        unmatched.push({ fileName: file.fileName, caption: file.caption, fileId: file.fileId });
      }
    } else {
      unmatched.push({ fileName: file.fileName, caption: file.caption, fileId: file.fileId });
    }
  }

  return res.json({ matched, unmatched, bufferCount: buffer.length });
});

// ── POST /admin/ai/generate-description ──────────────────────────────────────
router.post("/ai/generate-description", async (req, res) => {
  const { title, genre, year, existingDescription } = req.body;

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    return res.status(503).json({ error: "AI features require a GROQ_API_KEY secret. Add it in the Secrets tab." });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

    const prompt = `You are an expert movie critic and copywriter. Write a compelling, engaging movie description for:

Title: ${title}
Genre: ${Array.isArray(genre) ? genre.join(", ") : genre}
Year: ${year}
${existingDescription ? `Existing description (improve this): ${existingDescription}` : ""}

Write 2-3 paragraphs that would make someone want to watch this movie. Be vivid, specific, and exciting. Do not reveal spoilers. Do not start with "In" or "This movie".`;

    const result = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });
    const text = result.choices[0].message.content ?? "";

    return res.json({ text });
  } catch (err) {
    logger.error({ err }, "AI description generation failed");
    return res.status(500).json({ error: "AI generation failed", details: String(err) });
  }
});

// ── POST /admin/ai/generate-tags ─────────────────────────────────────────────
router.post("/ai/generate-tags", async (req, res) => {
  const { title, description, genre, year } = req.body;

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    return res.status(503).json({ error: "AI features require a GROQ_API_KEY secret. Add it in the Secrets tab." });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

    const prompt = `Generate tags and keywords for this movie for a streaming platform:

Title: ${title}
Description: ${description}
Genre: ${Array.isArray(genre) ? genre.join(", ") : genre}
Year: ${year}

Return ONLY a valid JSON object with no markdown formatting:
{"tags": ["tag1","tag2",...8-12 short descriptive tags], "keywords": ["kw1","kw2",...10-15 search keywords]}`;

    const result = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });
    let content = (result.choices[0].message.content ?? "").trim();
    // Strip markdown code fences if present
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(content);
    return res.json({ tags: parsed.tags || [], keywords: parsed.keywords || [] });
  } catch (err) {
    logger.error({ err }, "AI tag generation failed");
    return res.status(500).json({ error: "AI generation failed", details: String(err) });
  }
});

// ── GET /admin/ai/analytics ──────────────────────────────────────────────────
router.get("/ai/analytics", async (_req, res) => {
  try {
    const [genreStats, topMovies] = await Promise.all([
      Order.aggregate([
        { $match: { paymentStatus: "confirmed" } },
        { $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" } },
        { $unwind: { path: "$movie", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$movie.genre", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$movie.genre",
            count: { $sum: 1 },
            revenue: { $sum: "$amount" },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "confirmed" } },
        {
          $group: {
            _id: { movieId: "$movieId", movieTitle: "$movieTitle", moviePosterUrl: "$moviePosterUrl" },
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: "$amount" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const topGenre = genreStats[0]?._id || "Action";
    const totalRevenue = topMovies.reduce((s: number, m: any) => s + m.totalRevenue, 0);

    const apiKey = process.env["GROQ_API_KEY"];
    let insight = `${topGenre} is your most popular genre by sales. Focus on acquiring more ${topGenre} titles.`;
    let revenueInsight = `Total confirmed revenue: KES ${totalRevenue.toLocaleString()}. Your top title drives the most conversions.`;

    if (apiKey) {
      try {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

        const prompt = `You are a streaming platform analytics AI. Given this data:
Genre breakdown: ${JSON.stringify(genreStats.slice(0, 5))}
Top movies by revenue: ${JSON.stringify(topMovies.slice(0, 3))}

Provide TWO very short (1 sentence each) business insights:
1. "insight": about popular genres and content strategy
2. "revenueInsight": about revenue performance

Return ONLY valid JSON with no markdown: {"insight": "...", "revenueInsight": "..."}`;

        const result = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
        });
        let content = (result.choices[0].message.content ?? "").trim();
        content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(content);
        if (parsed.insight) insight = parsed.insight;
        if (parsed.revenueInsight) revenueInsight = parsed.revenueInsight;
      } catch {
        // Fall back to static insights
      }
    }

    return res.json({
      popularGenres: genreStats.map((g: any) => ({
        genre: g._id,
        count: g.count,
        revenue: g.revenue,
      })),
      bestSellers: topMovies.map((m: any) => ({
        movieId: m._id.movieId,
        movieTitle: m._id.movieTitle,
        moviePosterUrl: m._id.moviePosterUrl,
        totalSales: m.totalSales,
        totalRevenue: m.totalRevenue,
      })),
      insight,
      revenueInsight,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get AI analytics");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /admin/ai/recommendations ────────────────────────────────────────────
router.get("/ai/recommendations", async (_req, res) => {
  try {
    const [movies, salesData] = await Promise.all([
      Movie.find().sort({ createdAt: -1 }).limit(20).lean(),
      Order.aggregate([
        { $match: { paymentStatus: "confirmed" } },
        { $group: { _id: "$movieId", count: { $sum: 1 }, revenue: { $sum: "$amount" } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const salesMap = new Map(salesData.map((s: any) => [s._id, { count: s.count, revenue: s.revenue }]));

    // Score movies: mix of sales performance and recency, penalize already featured
    const scored = movies.map((m) => {
      const sales = salesMap.get(m._id.toString()) || { count: 0, revenue: 0 };
      const recencyBonus = (Date.now() - new Date(m.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 ? 10 : 0;
      const score = sales.revenue * 0.5 + sales.count * 20 + recencyBonus - (m.featured ? 5 : 0);
      return {
        movieId: m._id.toString(),
        title: m.title,
        posterUrl: m.posterUrl,
        featured: m.featured,
        score,
        sales: sales.count,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top5 = scored.slice(0, 5);

    let reasoning = "Recommendations are based on sales performance, revenue, and content recency. Featuring these titles should maximize engagement.";

    const apiKey = process.env["GROQ_API_KEY"];
    if (apiKey && top5.length > 0) {
      try {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

        const result = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{
            role: "user",
            content: `You are a streaming platform curator. These are top-scoring movies for featuring on the homepage based on sales and recency: ${top5.map(m => `"${m.title}" (${m.sales} sales)`).join(", ")}. Write ONE sentence explaining why these movies are great homepage candidates. Be specific and confident.`,
          }],
        });
        reasoning = result.choices[0].message.content?.trim() || reasoning;
      } catch {
        // Fall back to static reasoning
      }
    }

    return res.json({
      recommendations: top5.map((m) => ({
        movieId: m.movieId,
        title: m.title,
        posterUrl: m.posterUrl,
        reason: m.featured ? "Currently featured — consider rotating" : "High sales & engagement",
        score: Math.round(m.score * 100) / 100,
      })),
      reasoning,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get AI recommendations");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/orders/:id/redeliver ─────────────────────────────────────────
router.post("/orders/:id/redeliver", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.paymentStatus !== "confirmed") {
      return res.status(400).json({ error: "Cannot redeliver — payment not confirmed" });
    }

    const movie = await Movie.findById(order.movieId).lean();
    if (!movie) return res.status(404).json({ error: "Movie not found" });
    if (!movie.telegramFileId) {
      return res.status(400).json({ error: "Movie has no Telegram file ID — upload the file first" });
    }

    await Order.findByIdAndUpdate(order._id, { status: "delivering", failureReason: null });

    try {
      await deliverMovieFromChannel({
        telegramUsername: order.telegramUsername,
        telegramFileId: movie.telegramFileId,
        movieTitle: order.movieTitle,
        orderId: order._id.toString(),
      });

      await Order.findByIdAndUpdate(order._id, {
        status: "delivered",
        deliveredAt: new Date(),
        failureReason: null,
      });

      logger.info({ orderId: order._id, telegramUsername: order.telegramUsername }, "Redelivery successful");
      return res.json({ success: true, message: "Movie delivered successfully" });
    } catch (deliveryErr: any) {
      await Order.findByIdAndUpdate(order._id, {
        status: "failed",
        failureReason: deliveryErr?.message ?? "Delivery failed",
      });
      logger.error({ deliveryErr, orderId: order._id }, "Redelivery failed");
      return res.status(502).json({ error: deliveryErr?.message ?? "Delivery failed" });
    }
  } catch (err) {
    logger.error({ err }, "Failed to redeliver order");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/movie-notifications — all coming-soon subscribers grouped by movie + series
router.get("/movie-notifications", async (req, res) => {
  try {
    // Movies
    const movieNotifs = await MovieNotification.find({}).sort({ createdAt: -1 }).lean();
    const movieIds = [...new Set(movieNotifs.map((n) => n.movieId.toString()))];
    const movies = await Movie.find({ _id: { $in: movieIds } }).select("title posterUrl comingSoon").lean();
    const movieMap = new Map(movies.map((m) => [m._id.toString(), m]));

    const movieGroups = movieIds.map((movieId) => {
      const movie = movieMap.get(movieId);
      if (!movie) return null;
      const subs = movieNotifs.filter((n) => n.movieId.toString() === movieId);
      return {
        id: movieId,
        type: "movie" as const,
        title: movie.title,
        posterUrl: (movie as any).posterUrl ?? "",
        pendingCount: subs.filter((s) => !s.notifiedAt).length,
        notifiedCount: subs.filter((s) => !!s.notifiedAt).length,
        subscribers: subs.map((s) => ({
          telegramUsername: s.telegramUsername,
          notifiedAt: s.notifiedAt ? s.notifiedAt.toISOString() : null,
          createdAt: (s as any).createdAt?.toISOString?.() ?? "",
        })),
      };
    }).filter(Boolean);

    // Series
    const seriesNotifs = await SeriesNotification.find({}).sort({ createdAt: -1 }).lean();
    const seriesIds = [...new Set(seriesNotifs.map((n) => n.seriesId.toString()))];
    const seriesList = await Series.find({ _id: { $in: seriesIds } }).select("title posterUrl comingSoon").lean();
    const seriesMap = new Map(seriesList.map((s) => [s._id.toString(), s]));

    const seriesGroups = seriesIds.map((seriesId) => {
      const series = seriesMap.get(seriesId);
      if (!series) return null;
      const subs = seriesNotifs.filter((n) => n.seriesId.toString() === seriesId);
      return {
        id: seriesId,
        type: "series" as const,
        title: series.title,
        posterUrl: (series as any).posterUrl ?? "",
        pendingCount: subs.filter((s) => !s.notifiedAt).length,
        notifiedCount: subs.filter((s) => !!s.notifiedAt).length,
        subscribers: subs.map((s) => ({
          telegramUsername: s.telegramUsername,
          notifiedAt: s.notifiedAt ? s.notifiedAt.toISOString() : null,
          createdAt: (s as any).createdAt?.toISOString?.() ?? "",
        })),
      };
    }).filter(Boolean);

    return res.json([...movieGroups, ...seriesGroups]);
  } catch (err) {
    logger.error({ err }, "Failed to fetch movie notifications");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

