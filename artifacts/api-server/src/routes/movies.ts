import { Router } from "express";
import { Movie } from "../models/Movie";
import {
  ListMoviesQueryParams,
  CreateMovieBody,
  GetMovieParams,
  UpdateMovieBody,
  UpdateMovieParams,
  DeleteMovieParams,
} from "@workspace/api-zod";

const router = Router();

// GET /movies
router.get("/", async (req, res) => {
  try {
    const query = ListMoviesQueryParams.parse(req.query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.genre) {
      filter["genre"] = { $in: [query.genre] };
    }
    if (query.quality) {
      filter["quality"] = query.quality;
    }
    if (query.search) {
      filter["$text"] = { $search: query.search };
    }

    const [movies, total] = await Promise.all([
      Movie.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Movie.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      movies: movies.map((m) => ({
        ...m,
        id: m._id.toString(),
        _id: undefined,
      })),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list movies");
    return res.status(500).json({ error: "Failed to list movies" });
  }
});

// GET /movies/featured
router.get("/featured", async (req, res) => {
  try {
    const movies = await Movie.find({ featured: true }).sort({ createdAt: -1 }).limit(5).lean();
    return res.json(
      movies.map((m) => ({ ...m, id: m._id.toString(), _id: undefined }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list featured movies");
    return res.status(500).json({ error: "Failed to list featured movies" });
  }
});

// GET /movies/genres
router.get("/genres", async (req, res) => {
  try {
    const genres = await Movie.distinct("genre");
    return res.json(genres.sort());
  } catch (err) {
    req.log.error({ err }, "Failed to list genres");
    return res.status(500).json({ error: "Failed to list genres" });
  }
});

// GET /movies/stats
router.get("/stats", async (req, res) => {
  try {
    const [total, byGenreRaw, byQualityRaw] = await Promise.all([
      Movie.countDocuments(),
      Movie.aggregate([{ $unwind: "$genre" }, { $group: { _id: "$genre", count: { $sum: 1 } } }]),
      Movie.aggregate([{ $group: { _id: "$quality", count: { $sum: 1 } } }]),
    ]);

    const byGenre: Record<string, number> = {};
    for (const item of byGenreRaw) {
      byGenre[item._id as string] = item.count as number;
    }

    const byQuality: Record<string, number> = {};
    for (const item of byQualityRaw) {
      byQuality[item._id as string] = item.count as number;
    }

    return res.json({ total, byGenre, byQuality });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    return res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /movies/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = GetMovieParams.parse(req.params);
    const movie = await Movie.findById(id).lean();
    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }
    return res.json({ ...movie, id: movie._id.toString(), _id: undefined });
  } catch (err) {
    req.log.error({ err }, "Failed to get movie");
    return res.status(500).json({ error: "Failed to get movie" });
  }
});

// POST /movies
router.post("/", async (req, res) => {
  try {
    const data = CreateMovieBody.parse(req.body);
    const movie = await Movie.create(data);
    const doc = movie.toObject();
    return res.status(201).json({ ...doc, id: doc._id.toString(), _id: undefined });
  } catch (err) {
    req.log.error({ err }, "Failed to create movie");
    return res.status(400).json({ error: "Failed to create movie" });
  }
});

// PUT /movies/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateMovieParams.parse(req.params);
    const data = UpdateMovieBody.parse(req.body);
    const movie = await Movie.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }
    return res.json({ ...movie, id: movie._id.toString(), _id: undefined });
  } catch (err) {
    req.log.error({ err }, "Failed to update movie");
    return res.status(400).json({ error: "Failed to update movie" });
  }
});

// DELETE /movies/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteMovieParams.parse(req.params);
    await Movie.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete movie");
    return res.status(500).json({ error: "Failed to delete movie" });
  }
});

export default router;
