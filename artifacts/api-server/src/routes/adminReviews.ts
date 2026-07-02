import { Router } from "express";
import { Review } from "../models/Review";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/admin/reviews
router.get("/", async (req, res) => {
  try {
    const filter = req.query.filter as string; // "reported" | "all"
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const match = filter === "reported" ? { "reports.0": { $exists: true } } : {};
    const [reviews, total] = await Promise.all([
      Review.find(match).sort({ pinned: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(match),
    ]);

    return res.json({
      reviews: reviews.map((r) => ({ ...r, reportCount: r.reports.length, likeCount: r.likes.length })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    logger.error({ err }, "Admin get reviews error");
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// DELETE /api/admin/reviews/:id
router.delete("/:id", async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Admin delete review error");
    return res.status(500).json({ error: "Failed to delete review" });
  }
});

// PUT /api/admin/reviews/:id/pin
router.put("/:id/pin", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    review.pinned = !review.pinned;
    await review.save();
    return res.json({ pinned: review.pinned });
  } catch (err: any) {
    logger.error({ err }, "Admin pin review error");
    return res.status(500).json({ error: "Failed to toggle pin" });
  }
});

// DELETE /api/admin/reviews/:id/reports — dismiss all reports on a review
router.delete("/:id/reports", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    review.reports = [];
    await review.save();
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Admin dismiss reports error");
    return res.status(500).json({ error: "Failed to dismiss reports" });
  }
});

export default router;
