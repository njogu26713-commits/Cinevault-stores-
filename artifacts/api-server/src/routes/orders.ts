import { Router } from "express";
import { Movie } from "../models/Movie";
import { Order } from "../models/Order";
import { initiateSTKPush } from "../services/mpesa";
import {
  CreateOrderBody,
  GetOrderParams,
  GetUserOrdersParams,
} from "@workspace/api-zod";

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

    const movie = await Movie.findById(movieId).lean();
    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }

    const order = await Order.create({
      movieId,
      movieTitle: movie.title,
      moviePosterUrl: movie.posterUrl,
      telegramUsername: telegramUsername.replace(/^@/, ""),
      phone,
      amount: movie.price,
      status: "pending",
      paymentStatus: "pending",
    });

    // Initiate M-Pesa STK push
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
