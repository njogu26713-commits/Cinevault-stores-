import { Router } from "express";
import mongoose from "mongoose";
import { Review } from "../models/Review";
import { Notification } from "../models/Notification";
import { requireUserAuth, optionalUserAuth } from "../middleware/userAuth";
import { logger } from "../lib/logger";

const router = Router();

async function notify(userId: string, type: string, message: string, relatedId?: string) {
  try {
    await Notification.create({ userId, type, message, read: false, relatedId: relatedId ?? null } as any);
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
  }
}

// GET /api/reviews/:contentType/:contentId
router.get("/:contentType/:contentId", optionalUserAuth, async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    if (!(["movie", "series"] as string[]).includes(String(contentType))) {
      return res.status(400).json({ error: "Invalid content type" });
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 10;
    const skip = (page - 1) * limit;

    const [reviews, total, ratingAgg] = await Promise.all([
      Review.find({ contentType, contentId } as any)
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ contentType, contentId } as any),
      Review.aggregate([
        { $match: { contentType, contentId } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]),
    ]);

    const userId = req.user?.userId;
    const enriched = reviews.map((r) => ({
      ...r,
      likeCount: r.likes.length,
      liked: userId ? r.likes.includes(userId) : false,
      reported: userId ? r.reports.some((rp: any) => rp.userId === userId) : false,
      reports: undefined,
    }));

    const ratingInfo = ratingAgg[0] ?? { avg: 0, count: 0 };
    return res.json({
      reviews: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      rating: { avg: Math.round(ratingInfo.avg * 10) / 10, count: ratingInfo.count },
    });
  } catch (err: any) {
    logger.error({ err }, "Get reviews error");
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// POST /api/reviews
router.post("/", requireUserAuth, async (req, res) => {
  try {
    const { contentType, contentId, rating, text } = req.body ?? {};
    if (!contentType || !contentId || !rating || !text) {
      return res.status(400).json({ error: "contentType, contentId, rating and text are required" });
    }
    if (!(["movie", "series"] as string[]).includes(contentType)) {
      return res.status(400).json({ error: "Invalid content type" });
    }
    const r = Number(rating);
    if (r < 1 || r > 5) return res.status(400).json({ error: "Rating must be between 1 and 5" });
    if (String(text).trim().length < 10) {
      return res.status(400).json({ error: "Review must be at least 10 characters" });
    }
    const existing = await Review.findOne({ contentType, contentId, userId: req.user!.userId });
    if (existing) return res.status(409).json({ error: "You have already reviewed this" });

    const review = await Review.create({
      contentType,
      contentId,
      userId: req.user!.userId,
      username: req.user!.username,
      rating: Math.round(r),
      text: String(text).trim(),
      likes: [],
      replies: [],
      reports: [],
      pinned: false,
    });
    return res.status(201).json({ ...review.toObject(), likeCount: 0, liked: false });
  } catch (err: any) {
    logger.error({ err }, "Create review error");
    return res.status(500).json({ error: "Failed to create review" });
  }
});

// PUT /api/reviews/:id
router.put("/:id", requireUserAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.userId !== req.user!.userId) return res.status(403).json({ error: "Not your review" });
    const { rating, text } = req.body ?? {};
    if (rating !== undefined) {
      const r = Number(rating);
      if (r < 1 || r > 5) return res.status(400).json({ error: "Rating must be 1–5" });
      review.rating = Math.round(r);
    }
    if (text !== undefined) {
      if (String(text).trim().length < 10) return res.status(400).json({ error: "Review too short" });
      review.text = String(text).trim();
    }
    await review.save();
    return res.json({ ...review.toObject(), likeCount: review.likes.length, liked: false });
  } catch (err: any) {
    logger.error({ err }, "Edit review error");
    return res.status(500).json({ error: "Failed to edit review" });
  }
});

// DELETE /api/reviews/:id
router.delete("/:id", requireUserAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.userId !== req.user!.userId) return res.status(403).json({ error: "Not your review" });
    await review.deleteOne();
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Delete review error");
    return res.status(500).json({ error: "Failed to delete review" });
  }
});

// POST /api/reviews/:id/like
router.post("/:id/like", requireUserAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    const uid = req.user!.userId;
    const liked = review.likes.includes(uid);
    if (liked) {
      review.likes = review.likes.filter((id) => id !== uid);
    } else {
      review.likes.push(uid);
      if (review.userId !== uid) {
        await notify(review.userId, "like", `${req.user!.username} liked your review`, review._id.toString());
      }
    }
    await review.save();
    return res.json({ liked: !liked, likeCount: review.likes.length });
  } catch (err: any) {
    logger.error({ err }, "Like review error");
    return res.status(500).json({ error: "Failed to toggle like" });
  }
});

// POST /api/reviews/:id/replies
router.post("/:id/replies", requireUserAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    const { text } = req.body ?? {};
    if (!text || String(text).trim().length < 2) {
      return res.status(400).json({ error: "Reply is too short" });
    }
    const reply = {
      _id: new mongoose.Types.ObjectId(),
      userId: req.user!.userId,
      username: req.user!.username,
      text: String(text).trim(),
      createdAt: new Date(),
    };
    review.replies.push(reply as any);
    await review.save();
    if (review.userId !== req.user!.userId) {
      const preview = reply.text.length > 60 ? reply.text.substring(0, 60) + "…" : reply.text;
      await notify(review.userId, "reply", `${req.user!.username} replied: "${preview}"`, review._id.toString());
    }
    return res.status(201).json(reply);
  } catch (err: any) {
    logger.error({ err }, "Add reply error");
    return res.status(500).json({ error: "Failed to add reply" });
  }
});

// DELETE /api/reviews/:id/replies/:replyId
router.delete("/:id/replies/:replyId", requireUserAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    const reply = review.replies.find((r: any) => r._id.toString() === req.params.replyId);
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    if ((reply as any).userId !== req.user!.userId) return res.status(403).json({ error: "Not your reply" });
    review.replies = review.replies.filter((r: any) => r._id.toString() !== req.params.replyId);
    await review.save();
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Delete reply error");
    return res.status(500).json({ error: "Failed to delete reply" });
  }
});

// POST /api/reviews/:id/report
router.post("/:id/report", requireUserAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    const uid = req.user!.userId;
    if (review.reports.some((r: any) => r.userId === uid)) {
      return res.status(409).json({ error: "Already reported" });
    }
    review.reports.push({ userId: uid, reason: req.body?.reason || "Inappropriate content", createdAt: new Date() } as any);
    await review.save();
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Report review error");
    return res.status(500).json({ error: "Failed to report review" });
  }
});

export default router;
