import { Router } from "express";
import { Notification } from "../models/Notification";
import { requireUserAuth } from "../middleware/userAuth";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/notifications
router.get("/", requireUserAuth, async (req, res) => {
  try {
    const uid = req.user!.userId;
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: uid }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ userId: uid, read: false }),
    ]);
    return res.json({ notifications, unreadCount });
  } catch (err: any) {
    logger.error({ err }, "Get notifications error");
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PUT /api/notifications/read-all
router.put("/read-all", requireUserAuth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user!.userId, read: false }, { $set: { read: true } });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Mark all read error");
    return res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

// PUT /api/notifications/:id/read
router.put("/:id/read", requireUserAuth, async (req, res) => {
  try {
    const n = await Notification.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!n) return res.status(404).json({ error: "Notification not found" });
    n.read = true;
    await n.save();
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Mark read error");
    return res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

export default router;
