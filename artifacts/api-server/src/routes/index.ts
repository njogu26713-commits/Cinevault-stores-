import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moviesRouter from "./movies";
import seriesRouter from "./series";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import seedRouter from "./seed";
import adminRouter from "./admin";
import authRouter from "./auth";
import researchRouter from "./research";
import mtprotoRouter from "./mtproto";
import streamRouter from "./stream";
import consumerRouter from "./consumet";
import { adminSubtitleRouter, subtitleServeRouter } from "./subtitles";
import { requireAdminAuth } from "../middleware/adminAuth";

// New community feature routes
import userAuthRouter from "./userAuth";
import reviewsRouter from "./reviews";
import movieRequestsRouter from "./movieRequests";
import notificationsRouter from "./notifications";
import adminReviewsRouter from "./adminReviews";
import adminRequestsRouter from "./adminRequests";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

router.use(healthRouter);
router.use("/movies", moviesRouter);
router.use("/series", seriesRouter);
router.use("/orders", ordersRouter);
router.use("/payments", paymentsRouter);
router.use("/stream", streamRouter);
router.use("/consumet", consumerRouter);

// Subtitle serve (public — no auth)
router.use("/subtitle", subtitleServeRouter);

// Auth routes (public — no JWT required)
router.use("/admin/auth", authRouter);

// ── Community: user auth (public) ────────────────────────────────────────────
router.use("/user/auth", userAuthRouter);

// ── Community: reviews & requests (mixed auth — routes handle individually) ──
router.use("/reviews", reviewsRouter);
router.use("/requests", movieRequestsRouter);

// ── Community: notifications (requires user JWT — handled inside route) ─────
router.use("/notifications", notificationsRouter);

// ── Admin: community moderation ───────────────────────────────────────────────
router.use("/admin/reviews", requireAdminAuth, adminReviewsRouter);
router.use("/admin/requests", requireAdminAuth, adminRequestsRouter);

// All other /admin routes require a valid JWT cookie
router.use("/admin/research", requireAdminAuth, researchRouter);
router.use("/admin/mtproto", requireAdminAuth, mtprotoRouter);
router.use("/admin/subtitles", requireAdminAuth, adminSubtitleRouter);
router.use("/admin", requireAdminAuth, adminRouter);

// Seed endpoint — available in all environments (only seeds if DB is empty)
router.use("/seed", seedRouter);

export default router;
