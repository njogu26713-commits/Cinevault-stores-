import { Router } from "express";
import { Order } from "../models/Order";
import { Movie } from "../models/Movie";
import { deliverMovieFromChannel } from "../services/telegram";
import { queryStkStatus } from "../services/mpesa";
import { GetMpesaStatusParams } from "@workspace/api-zod";

const router = Router();

// POST /payments/mpesa/callback — M-Pesa Daraja callback
router.post("/mpesa/callback", async (req, res) => {
  try {
    const body = req.body as {
      Body: {
        stkCallback: {
          MerchantRequestID: string;
          CheckoutRequestID: string;
          ResultCode: number;
          ResultDesc: string;
          CallbackMetadata?: {
            Item: Array<{ Name: string; Value: unknown }>;
          };
        };
      };
    };

    const callback = body.Body?.stkCallback;
    if (!callback) {
      req.log.warn("Invalid M-Pesa callback payload");
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      callback;

    req.log.info({ MerchantRequestID, CheckoutRequestID, ResultCode }, "M-Pesa callback received");

    const order = await Order.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!order) {
      req.log.warn({ CheckoutRequestID }, "No order found for callback");
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (ResultCode === 0) {
      // Guard: skip if already past payment_confirmed — prevents duplicate delivery on callback replay
      if (order.status === "delivered" || order.status === "delivering") {
        req.log.info({ orderId: order._id }, "Duplicate callback ignored — already delivered");
        return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      const items = CallbackMetadata?.Item ?? [];
      const getItem = (name: string) =>
        items.find((i) => i.Name === name)?.Value as string | undefined;

      const receiptNumber = getItem("MpesaReceiptNumber") ?? null;

      // Verify the amount matches to prevent tampering
      const paidAmount = Number(getItem("Amount") ?? 0);
      if (paidAmount > 0 && Math.abs(paidAmount - order.amount) > 1) {
        req.log.error(
          { orderId: order._id, expected: order.amount, received: paidAmount },
          "Amount mismatch — rejecting callback"
        );
        order.status = "failed";
        order.failureReason = "Payment amount mismatch";
        await order.save();
        return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      // Atomic transition: only advance if still in initiated state (idempotency)
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: "payment_initiated" },
        {
          paymentStatus: "confirmed",
          status: "payment_confirmed",
          mpesaReceiptNumber: receiptNumber,
        },
        { new: true }
      );

      if (!updated) {
        req.log.info({ orderId: order._id }, "Order already processed — skipping");
        return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      req.log.info({ orderId: order._id, receiptNumber }, "Payment confirmed, delivering movie");

      // Deliver movie via Telegram
      try {
        const movie = await Movie.findById(order.movieId).lean();
        if (!movie?.telegramFileId) {
          throw new Error("Movie has no Telegram file ID configured");
        }

        await Order.findByIdAndUpdate(order._id, { status: "delivering" });

        await deliverMovieFromChannel({
          telegramUsername: order.telegramUsername,
          telegramFileId: movie.telegramFileId,
          movieTitle: order.movieTitle,
          orderId: order._id.toString(),
        });

        await Order.findByIdAndUpdate(order._id, {
          status: "delivered",
          deliveredAt: new Date(),
        });

        req.log.info({ orderId: order._id }, "Movie delivered successfully");
      } catch (deliveryErr) {
        req.log.error({ deliveryErr, orderId: order._id }, "Movie delivery failed");
        await Order.findByIdAndUpdate(order._id, {
          status: "failed",
          failureReason: "Payment received but movie delivery failed. Contact support.",
        });
      }
    } else {
      // Payment failed — only update if not already in a terminal state
      await Order.findOneAndUpdate(
        { _id: order._id, status: { $nin: ["delivered", "failed"] } },
        { paymentStatus: "failed", status: "failed", failureReason: ResultDesc }
      );
      req.log.info({ orderId: order._id, ResultCode, ResultDesc }, "Payment failed");
    }

    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    req.log.error({ err }, "Error processing M-Pesa callback");
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

// GET /payments/mpesa/status/:checkoutRequestId — query STK push status
router.get("/mpesa/status/:checkoutRequestId", async (req, res) => {
  try {
    const { checkoutRequestId } = GetMpesaStatusParams.parse(req.params);

    // Check our DB first
    const order = await Order.findOne({ checkoutRequestId }).lean();
    if (order) {
      return res.json({
        status: order.paymentStatus,
        resultCode: null,
        resultDesc: order.failureReason ?? null,
      });
    }

    // Query Daraja
    const result = await queryStkStatus(checkoutRequestId);
    return res.json({
      status: result.ResultCode === "0" ? "confirmed" : "failed",
      resultCode: result.ResultCode,
      resultDesc: result.ResultDesc,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to query M-Pesa status");
    return res.status(500).json({ error: "Failed to query payment status" });
  }
});

export default router;
