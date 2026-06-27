import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moviesRouter from "./movies";
import seriesRouter from "./series";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import seedRouter from "./seed";
import adminRouter from "./admin";
import authRouter from "./auth";
import { requireAdminAuth } from "../middleware/adminAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/movies", moviesRouter);
router.use("/series", seriesRouter);
router.use("/orders", ordersRouter);
router.use("/payments", paymentsRouter);

// Auth routes (public — no JWT required)
router.use("/admin/auth", authRouter);

// All other /admin routes require a valid JWT cookie
router.use("/admin", requireAdminAuth, adminRouter);

// Seed endpoint — available in all environments (only seeds if DB is empty)
router.use("/seed", seedRouter);

export default router;
