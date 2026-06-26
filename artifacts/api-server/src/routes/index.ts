import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moviesRouter from "./movies";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import seedRouter from "./seed";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/movies", moviesRouter);
router.use("/orders", ordersRouter);
router.use("/payments", paymentsRouter);

// Seed endpoint — available in all environments (only seeds if DB is empty)
router.use("/seed", seedRouter);

export default router;
