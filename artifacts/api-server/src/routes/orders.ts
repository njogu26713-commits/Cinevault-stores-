import { Router } from "express";
import mongoose from "mongoose";
import { Movie } from "../models/Movie";
import { Order } from "../models/Order";
import { initiateSTKPush } from "../services/mpesa";
import { deliverMovieFromChannel } from "../services/telegram";
import {
  CreateOrderBody,
  GetOrderParams,
  GetUserOrdersParams,
} from "@workspace/api-zod";

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
    const { movieId, telegramUsername, phone } = CreateOrderBody.parse(req.body);

    if (!mongoose.isValidObjectId(movieId)) {
      return res.status(400).json({ error: "Invalid movie ID" });
    }

    const movie = await Movie.findById(movieId).lean();
    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }

    const cleanUsername = telegramUsername.replace(/^@/, "");

    const order = await Order.create({
      movieId,
      movieTitle: movie.title,
      moviePosterUrl: movie.posterUrl,
      telegramUsername: cleanUsername,
      phone,
      amount: movie.price,
      status: "pending",
      paymentStatus: "pending",
    });

    // ── BYPASS MODE: auto-confirm and deliver without M-Pesa ─────────────────
    if (isPaymentBypassed()) {
      req.log.info({ orderId: order._id }, "Payment bypass active — auto-confirming order");

      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: "confirmed",
        status: "payment_confirmed",
        mpesaReceiptNumber: `BYPASS-${Date.now()}`,
      });

      // Attempt delivery
      try {
        if (movie.telegramFileId) {
          await Order.findByIdAndUpdate(order._id, { status: "delivering" });
          await deliverMovieFromChannel({
            telegramUsername: cleanUsername,
            telegramFileId: movie.telegramFileId,
            movieTitle: movie.title,
            orderId: order._id.toString(),
          });
          await Order.findByIdAndUpdate(order._id, {
            status: "delivered",
            deliveredAt: new Date(),
          });
          req.log.info({ orderId: order._id }, "Bypass: movie delivered");
        } else {
          req.log.warn({ orderId: order._id }, "Bypass: no telegramFileId on movie — skipping delivery");
        }
      } catch (deliveryErr) {
        req.log.error({ deliveryErr, orderId: order._id }, "Bypass: delivery failed");
        await Order.findByIdAndUpdate(order._id, {
          status: "failed",
          failureReason: "Order confirmed but delivery failed. Contact support.",
        });
      }

      const updated = await Order.findById(order._id);
      return res.status(201).json(formatOrder(updated!));
    }

    // ── NORMAL MODE: initiate M-Pesa STK push ────────────────────────────────
    try {
      const stkResult = await initiateSTKPush({
        phone,
        amount: movie.price,
        orderId: order._id.toString(),
        description: `CineVault: ${movie.title.slice(0, 13)}`,
      });

      order.checkoutRequestId = stkResult.CheckoutRequestID;
      order.merchantRequestId = stkResult.MerchantRequestID;
      order.status = "payment_initiated";
      order.paymentStatus = "initiated";
      await order.save();

      req.log.info({ orderId: order._id, movieTitle: movie.title }, "STK push initiated");
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
