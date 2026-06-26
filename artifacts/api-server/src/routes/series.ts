import { Router } from "express";
import mongoose from "mongoose";
import { Series } from "../models/Series";
import {
  ListSeriesQueryParams,
  CreateSeriesBody,
  GetSeriesParams,
  UpdateSeriesBody,
  UpdateSeriesParams,
  DeleteSeriesParams,
} from "@workspace/api-zod";
import { ZodError } from "@workspace/api-zod/node_modules/zod";

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

// GET /series
router.get("/", async (req, res) => {
  try {
    const query = ListSeriesQueryParams.parse(req.query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
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
    const series = await Series.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!series) return res.status(404).json({ error: "Series not found" });
    return res.json(formatSeries(series));
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    req.log.error({ err }, "Failed to update series");
    return res.status(500).json({ error: "Failed to update series" });
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
