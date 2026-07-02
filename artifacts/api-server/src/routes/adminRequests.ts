import { Router } from "express";
import { MovieRequest } from "../models/MovieRequest";
import { Notification } from "../models/Notification";
import { logger } from "../lib/logger";

const router = Router();

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  coming_soon: "Coming Soon",
  added: "Added",
  unavailable: "Unavailable",
};

// GET /api/admin/requests
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const match = status && status !== "all" ? { status } : {};
    const [requests, total] = await Promise.all([
      MovieRequest.aggregate([
        { $match: match },
        { $addFields: { voteCount: { $size: "$votes" } } },
        { $sort: { pinned: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      MovieRequest.countDocuments(match),
    ]);

    return res.json({
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    logger.error({ err }, "Admin list requests error");
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// PUT /api/admin/requests/:id
router.put("/:id", async (req, res) => {
  try {
    const { status, adminNote, pinned } = req.body ?? {};
    const request = await MovieRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const prevStatus = request.status;
    if (status) request.status = status;
    if (adminNote !== undefined) request.adminNote = adminNote || null;
    if (pinned !== undefined) request.pinned = Boolean(pinned);
    await request.save();

    // Notify the requester if status changed
    if (status && status !== prevStatus && STATUS_LABELS[status]) {
      const label = STATUS_LABELS[status];
      const note = request.adminNote ? ` — ${request.adminNote}` : "";
      try {
        await Notification.create({
          userId: request.userId,
          type: "request_status",
          message: `Your request for "${request.title}" is now: ${label}${note}`,
          read: false,
          relatedId: request._id.toString(),
        });
      } catch (e) {
        logger.error({ e }, "Failed to create request notification");
      }
    }

    return res.json({ ...request.toObject(), voteCount: request.votes.length });
  } catch (err: any) {
    logger.error({ err }, "Admin update request error");
    return res.status(500).json({ error: "Failed to update request" });
  }
});

// DELETE /api/admin/requests/:id
router.delete("/:id", async (req, res) => {
  try {
    const request = await MovieRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Admin delete request error");
    return res.status(500).json({ error: "Failed to delete request" });
  }
});

export default router;
