import { Router } from "express";
import { MovieRequest } from "../models/MovieRequest";
import { Notification } from "../models/Notification";
import { requireUserAuth, optionalUserAuth } from "../middleware/userAuth";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/requests
router.get("/", optionalUserAuth, async (req, res) => {
  try {
    const sort = (req.query.sort as string) || "top";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 12;
    const skip = (page - 1) * limit;

    let sortQuery: Record<string, any> = { pinned: -1 };

    if (sort === "newest") {
      sortQuery = { pinned: -1, createdAt: -1 };
    } else if (sort === "trending") {
      // trending = most votes in last 7 days — approximated by sorting by votes among recent docs
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [trending, total] = await Promise.all([
        MovieRequest.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $addFields: { voteCount: { $size: "$votes" } } },
          { $sort: { pinned: -1, voteCount: -1, createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        MovieRequest.countDocuments({ createdAt: { $gte: since } }),
      ]);
      const uid = req.user?.userId;
      return res.json({
        requests: trending.map((r) => ({ ...r, voteCount: r.voteCount, voted: uid ? r.votes.includes(uid) : false })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } else {
      // top (most requested)
      sortQuery = { pinned: -1, $expr: { $size: "$votes" } };
    }

    const [requests, total] = await Promise.all([
      sort === "top"
        ? MovieRequest.aggregate([
            { $addFields: { voteCount: { $size: "$votes" } } },
            { $sort: { pinned: -1, voteCount: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
          ])
        : MovieRequest.find().sort(sortQuery).skip(skip).limit(limit).lean(),
      MovieRequest.countDocuments(),
    ]);

    const uid = req.user?.userId;
    return res.json({
      requests: requests.map((r: any) => ({
        ...r,
        voteCount: r.voteCount ?? r.votes?.length ?? 0,
        voted: uid ? r.votes?.includes(uid) : false,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    logger.error({ err }, "List requests error");
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// POST /api/requests
router.post("/", requireUserAuth, async (req, res) => {
  try {
    const { title, category, posterUrl, reason } = req.body ?? {};
    if (!title || !category || !reason) {
      return res.status(400).json({ error: "Title, category and reason are required" });
    }
    if (!["movie", "series"].includes(category)) {
      return res.status(400).json({ error: "Category must be movie or series" });
    }
    if (String(title).trim().length < 2) return res.status(400).json({ error: "Title too short" });
    if (String(reason).trim().length < 10) return res.status(400).json({ error: "Reason must be at least 10 characters" });

    const request = await MovieRequest.create({
      title: String(title).trim(),
      category,
      posterUrl: posterUrl || null,
      reason: String(reason).trim(),
      userId: req.user!.userId,
      username: req.user!.username,
      votes: [],
      status: "pending",
    });
    return res.status(201).json({ ...request.toObject(), voteCount: 0, voted: false });
  } catch (err: any) {
    logger.error({ err }, "Create request error");
    return res.status(500).json({ error: "Failed to create request" });
  }
});

// POST /api/requests/:id/vote
router.post("/:id/vote", requireUserAuth, async (req, res) => {
  try {
    const request = await MovieRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    const uid = req.user!.userId;
    const voted = request.votes.includes(uid);
    if (voted) {
      request.votes = request.votes.filter((v) => v !== uid);
    } else {
      request.votes.push(uid);
    }
    await request.save();
    return res.json({ voted: !voted, voteCount: request.votes.length });
  } catch (err: any) {
    logger.error({ err }, "Vote request error");
    return res.status(500).json({ error: "Failed to toggle vote" });
  }
});

export default router;
