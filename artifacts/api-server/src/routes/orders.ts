import { Router } from "express";
import mongoose from "mongoose";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";
import { Order } from "../models/Order";
import { initiateSTKPush } from "../services/mpesa";
import { deliverMovieFromChannel } from "../services/telegram";
import {
  CreateOrderBody,
  GetOrderParams,
  GetUserOrdersParams,
} from "@workspace/api-zod";

/** Streaming purchases are discounted relative to a permanent Telegram-delivered buy. */
const STREAM_PRICE_MULTIPLIER = 0.6;

function computeStreamPrice(buyPrice: number): number {
  return Math.max(1, Math.round(buyPrice * STREAM_PRICE_MULTIPLIER));
}

// Payment bypass: active when MPESA credentials are missing OR PAYMENT_BYPASS=true
function isPaymentBypassed(): boolean {
  if (process.env["PAYMENT_BYPASS"] === "true") return true;
  const hasCredentials =
    process.env["MPESA_CONSUMER_KEY"] &&
    process.env["MPESA_CONSUMER_SECRET"] &&
    process.env["MPESA_SHORTCODE"] &&
    process.env["MPESA_PASSKEY"];
  return !hasCredentials;
}

const router = Router();

function formatOrder(order: any) {
  const doc = order.toObject ? order.toObject() : order;
  return {
    ...doc,
    id: doc._id.toString(),
    _id: undefined,
    createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt,
    updatedAt: doc.updatedAt?.toISOString?.() ?? doc.updatedAt,
    deliveredAt: doc.deliveredAt?.toISOString?.() ?? doc.deliveredAt,
  };
}

// POST /orders — create order + initiate M-Pesa STK push
router.post("/", async (req, res) => {
  try {
    const body = CreateOrderBody.parse(req.body);
    const { movieId, telegramUsername, phone } = body;
    const contentType = body.contentType ?? "movie";
    const purchaseType = body.purchaseType ?? "buy";
    const seasonNumber = body.seasonNumber ?? null;
    const episodeNumber = body.episodeNumber ?? null;

    if (!mongoose.isValidObjectId(movieId)) {
      return res.status(400).json({ error: "Invalid movie ID" });
    }

    // ── Resolve content, price, and label depending on movie vs. series ──────
    let title: string;
    let posterUrl: string;
    let amount: number;
    let deliverFileId: string | null = null;

    if (contentType === "series") {
      const series = await Series.findById(movieId).lean();
      if (!series) {
        return res.status(404).json({ error: "Series not found" });
      }
      if (!seasonNumber) {
        return res.status(400).json({ error: "seasonNumber is required for series orders" });
      }
      const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
      if (!season) {
        return res.status(404).json({ error: "Season not found" });
      }

      if (episodeNumber) {
        const episode = season.episodes.find((e) => e.episodeNumber === episodeNumber);
        if (!episode) {
          return res.status(404).json({ error: "Episode not found" });
        }
        amount =
          purchaseType === "stream"
            ? computeStreamPrice(series.pricePerEpisode)
            : series.pricePerEpisode;
        title = `${series.title} — S${seasonNumber}E${episodeNumber}: ${episode.title}`;
        deliverFileId = episode.telegramFileId ?? null;
      } else {
        amount =
          purchaseType === "stream"
            ? computeStreamPrice(series.pricePerSeason)
            : series.pricePerSeason;
        title = `${series.title} — Season ${seasonNumber}`;
        // Whole-season Telegram delivery sends the first episode's file id as a starting point;
        // remaining episodes are delivered by the admin/bot flow per-episode.
        deliverFileId = season.episodes[0]?.telegramFileId ?? null;
      }
      posterUrl = series.posterUrl;
    } else {
      const movie = await Movie.findById(movieId).lean();
      if (!movie) {
        return res.status(404).json({ error: "Movie not found" });
      }
      title = movie.title;
      posterUrl = movie.posterUrl;
      amount = movie.price;
      deliverFileId = movie.telegramFileId ?? null;
    }

    const cleanUsername = telegramUsername.replace(/^@/, "");

    const order = await Order.create({
      movieId,
      movieTitle: title,
      moviePosterUrl: posterUrl,
      telegramUsername: cleanUsername,
      phone,
      amount,
      status: "pending",
      paymentStatus: "pending",
      contentType,
      purchaseType,
      seasonNumber,
      episodeNumber,
    });

    // Streaming purchases don't get a Telegram file delivery — they just unlock in-app streaming.
    const shouldDeliverToTelegram = purchaseType === "buy";

    // ── BYPASS MODE: auto-confirm and deliver without M-Pesa ─────────────────
    if (isPaymentBypassed()) {
      req.log.info({ orderId: order._id }, "Payment bypass active — auto-confirming order");

      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "confirmed",
        status: "payment_confirmed",
        mpesaReceiptNumber: `BYPASS-${Date.now()}`,
      });

      // Attempt delivery — in bypass mode always mark delivered regardless of Telegram errors
      await Order.findByIdAndUpdate(order._id, { status: "delivering" });
      if (shouldDeliverToTelegram) {
        try {
          if (deliverFileId) {
            await deliverMovieFromChannel({
              telegramUsername: cleanUsername,
              telegramFileId: deliverFileId,
              movieTitle: title,
              orderId: order._id.toString(),
            });
            req.log.info({ orderId: order._id }, "Bypass: content delivered via Telegram");
          } else {
            req.log.warn({ orderId: order._id }, "Bypass: no telegramFileId available — skipping Telegram send");
          }
        } catch (deliveryErr: any) {
          // In bypass mode, Telegram delivery errors (e.g. user hasn't /start-ed the bot) are
          // non-fatal — the order still counts as delivered so the status page shows success.
          req.log.warn(
            { orderId: order._id, reason: deliveryErr?.message },
            "Bypass: Telegram delivery failed (non-fatal in bypass mode) — order still marked delivered"
          );
        }
      }
      await Order.findByIdAndUpdate(order._id, {
        status: "delivered",
        deliveredAt: new Date(),
      });

      const updated = await Order.findById(order._id);
      return res.status(201).json(formatOrder(updated!));
    }

    // ── NORMAL MODE: initiate M-Pesa STK push ────────────────────────────────
    try {
      const stkResult = await initiateSTKPush({
        phone,
        amount,
        orderId: order._id.toString(),
        description: `CineVault: ${title.slice(0, 13)}`,
      });

      order.checkoutRequestId = stkResult.CheckoutRequestID;
      order.merchantRequestId = stkResult.MerchantRequestID;
      order.status = "payment_initiated";
      order.paymentStatus = "initiated";
      await order.save();

      req.log.info({ orderId: order._id, movieTitle: title }, "STK push initiated");
    } catch (mpesaErr) {
      req.log.error({ mpesaErr }, "M-Pesa STK push failed");
      order.status = "failed";
      order.paymentStatus = "failed";
      order.failureReason = "Failed to initiate payment. Please try again.";
      await order.save();
    }

    return res.status(201).json(formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    return res.status(400).json({ error: "Failed to create order" });
  }
});

// GET /orders/:id — get order status
router.get("/:id", async (req, res) => {
  try {
    const { id } = GetOrderParams.parse(req.params);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.json(formatOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    return res.status(500).json({ error: "Failed to get order" });
  }
});

// GET /orders/user/:telegramUsername — get all orders for a user
router.get("/user/:telegramUsername", async (req, res) => {
  try {
    const { telegramUsername } = GetUserOrdersParams.parse(req.params);
    const clean = telegramUsername.replace(/^@/, "");
    const orders = await Order.find({ telegramUsername: clean })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      orders.map((o: any) => ({
        ...o,
        id: o._id.toString(),
        _id: undefined,
        createdAt: o.createdAt?.toISOString?.() ?? o.createdAt,
        updatedAt: o.updatedAt?.toISOString?.() ?? o.updatedAt,
        deliveredAt: o.deliveredAt?.toISOString?.() ?? o.deliveredAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get user orders");
    return res.status(500).json({ error: "Failed to get user orders" });
  }
});

export default router;
