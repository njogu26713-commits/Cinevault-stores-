import { Router } from "express";
import mongoose from "mongoose";
import { Series } from "../models/Series";
import { SeriesNotification } from "../models/SeriesNotification";
import { notifyComingSoonAvailable } from "../services/telegram";
import {
  ListSeriesQueryParams,
  CreateSeriesBody,
  GetSeriesParams,
  UpdateSeriesBody,
  UpdateSeriesParams,
  DeleteSeriesParams,
} from "@workspace/api-zod";
import { ZodError } from "zod";

function isValidId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

function formatSeries(s: any) {
  const id = (s._id ?? s.id).toString();
  const seasons = s.seasons ?? [];
  const totalEpisodes = seasons.reduce(
    (sum: number, season: any) => sum + (season.episodes?.length ?? 0),
    0
  );
  return { ...s, id, _id: undefined, totalSeasons: seasons.length, totalEpisodes };
}

const router = Router();

// GET /series/coming-soon
router.get("/coming-soon", async (req, res) => {
  try {
    const series = await Series.find({ comingSoon: true }).sort({ createdAt: -1 }).lean();
    return res.json(series.map(formatSeries));
  } catch (err) {
    req.log.error({ err }, "Failed to get coming-soon series");
    return res.status(500).json({ error: "Failed to get coming-soon series" });
  }
});

// GET /series
router.get("/", async (req, res) => {
  try {
    const query = ListSeriesQueryParams.parse(req.query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { comingSoon: { $ne: true } };
    if (query.genre) filter["genre"] = { $in: [query.genre] };
    if (query.quality) filter["quality"] = query.quality;
    if ((query as any).status) filter["status"] = (query as any).status;
    if (query.search) filter["$text"] = { $search: query.search };

    const [series, total] = await Promise.all([
      Series.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Series.countDocuments(filter),
    ]);

    return res.json({
      series: series.map(formatSeries),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: "Invalid query parameters", details: err.errors });
    req.log.error({ err }, "Failed to list series");
    return res.status(500).json({ error: "Failed to list series" });
  }
});

// GET /series/featured
router.get("/featured", async (req, res) => {
  try {
    const series = await Series.find({ featured: true }).sort({ createdAt: -1 }).limit(5).lean();
    return res.json(series.map(formatSeries));
  } catch (err) {
    req.log.error({ err }, "Failed to list featured series");
    return res.status(500).json({ error: "Failed to list featured series" });
  }
});

// GET /series/genres
router.get("/genres", async (req, res) => {
  try {
    const genres = await Series.distinct("genre");
    return res.json(genres.sort());
  } catch (err) {
    req.log.error({ err }, "Failed to list series genres");
    return res.status(500).json({ error: "Failed to list series genres" });
  }
});

// GET /series/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = GetSeriesParams.parse(req.params);
    if (!isValidId(id)) return res.status(400).json({ error: "Invalid series ID" });
    const series = await Series.findById(id).lean();
    if (!series) return res.status(404).json({ error: "Series not found" });
    return res.json(formatSeries(series));
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: "Invalid request", details: err.errors });
    req.log.error({ err }, "Failed to get series");
    return res.status(500).json({ error: "Failed to get series" });
  }
});

// POST /series
router.post("/", async (req, res) => {
  try {
    const data = CreateSeriesBody.parse(req.body);
    const series = await Series.create(data);
    return res.status(201).json(formatSeries(series.toObject()));
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    req.log.error({ err }, "Failed to create series");
    return res.status(500).json({ error: "Failed to create series" });
  }
});

// PUT /series/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateSeriesParams.parse(req.params);
    if (!isValidId(id)) return res.status(400).json({ error: "Invalid series ID" });
    const data = UpdateSeriesBody.parse(req.body);

    const before = await Series.findById(id).select("comingSoon title").lean();
    const series = await Series.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!series) return res.status(404).json({ error: "Series not found" });

    // Auto-notify subscribers when comingSoon flips true → false
    const wasComingSoon = (before as any)?.comingSoon === true;
    const isNowAvailable = !(data as any).comingSoon;
    if (wasComingSoon && isNowAvailable) {
      const subs = await SeriesNotification.find({ seriesId: id, notifiedAt: null }).lean();
      if (subs.length > 0) {
        const seriesTitle = series.title;
        const seriesIdStr = series._id.toString();
        Promise.allSettled(
          subs.map((s) =>
            notifyComingSoonAvailable({
              telegramUsername: s.telegramUsername,
              movieTitle: seriesTitle,
              movieId: seriesIdStr,
            }).then(() =>
              SeriesNotification.updateOne({ _id: s._id }, { notifiedAt: new Date() })
            )
          )
        );
      }
    }

    return res.json(formatSeries(series));
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    req.log.error({ err }, "Failed to update series");
    return res.status(500).json({ error: "Failed to update series" });
  }
});

// POST /series/:id/notify
router.post("/:id/notify", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: "Invalid series ID" });
    const { telegramUsername } = req.body as { telegramUsername?: string };
    if (!telegramUsername || typeof telegramUsername !== "string") {
      return res.status(400).json({ error: "telegramUsername is required" });
    }
    const series = await Series.findById(id).select("comingSoon").lean();
    if (!series) return res.status(404).json({ error: "Series not found" });
    const clean = telegramUsername.replace(/^@/, "").toLowerCase().trim();
    if (!clean) return res.status(400).json({ error: "Invalid Telegram username" });
    const result = await SeriesNotification.findOneAndUpdate(
      { seriesId: id, telegramUsername: clean },
      { $setOnInsert: { seriesId: id, telegramUsername: clean } },
      { upsert: true, new: false }
    );
    return res.json({ ok: true, alreadySubscribed: result !== null });
  } catch (err) {
    req.log.error({ err }, "Failed to subscribe series notification");
    return res.status(500).json({ error: "Failed to subscribe" });
  }
});

// GET /series/:id/notify — count
router.get("/:id/notify", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: "Invalid series ID" });
    const count = await SeriesNotification.countDocuments({ seriesId: id });
    return res.json({ count });
  } catch (err) {
    req.log.error({ err }, "Failed to get series notification count");
    return res.status(500).json({ error: "Failed to get count" });
  }
});

// DELETE /series/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteSeriesParams.parse(req.params);
    if (!isValidId(id)) return res.status(400).json({ error: "Invalid series ID" });
    await Series.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete series");
    return res.status(500).json({ error: "Failed to delete series" });
  }
});

export default router;
