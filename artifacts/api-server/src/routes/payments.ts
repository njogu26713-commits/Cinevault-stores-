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
      // Payment successful
      const items = CallbackMetadata?.Item ?? [];
      const getItem = (name: string) =>
        items.find((i) => i.Name === name)?.Value as string | undefined;

      const receiptNumber = getItem("MpesaReceiptNumber") ?? null;

      order.paymentStatus = "confirmed";
      order.status = "payment_confirmed";
      order.mpesaReceiptNumber = receiptNumber;
      await order.save();

      req.log.info({ orderId: order._id, receiptNumber }, "Payment confirmed, delivering movie");

      // Deliver movie via Telegram
      try {
        const movie = await Movie.findById(order.movieId).lean();
        if (!movie?.telegramFileId) {
          throw new Error("Movie has no Telegram file ID configured");
        }

        order.status = "delivering";
        await order.save();

        await deliverMovieFromChannel({
          telegramUsername: order.telegramUsername,
          telegramFileId: movie.telegramFileId,
          movieTitle: order.movieTitle,
          orderId: order._id.toString(),
        });

        order.status = "delivered";
        order.deliveredAt = new Date();
        await order.save();

        req.log.info({ orderId: order._id }, "Movie delivered successfully");
      } catch (deliveryErr) {
        req.log.error({ deliveryErr, orderId: order._id }, "Movie delivery failed");
        order.status = "failed";
        order.failureReason = "Payment received but movie delivery failed. Contact support.";
        await order.save();
      }
    } else {
      // Payment failed
      order.paymentStatus = "failed";
      order.status = "failed";
      order.failureReason = ResultDesc;
      await order.save();
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
