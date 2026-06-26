import mongoose, { Document, Schema } from "mongoose";

export type OrderStatus =
  | "pending"
  | "payment_initiated"
  | "payment_confirmed"
  | "delivering"
  | "delivered"
  | "failed";

export type PaymentStatus = "pending" | "initiated" | "confirmed" | "failed";

export interface IOrder extends Document {
  movieId: string;
  movieTitle: string;
  moviePosterUrl: string;
  telegramUsername: string;
  phone: string;
  amount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  checkoutRequestId?: string | null;
  merchantRequestId?: string | null;
  mpesaReceiptNumber?: string | null;
  deliveredAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    movieId: { type: String, required: true },
    movieTitle: { type: String, required: true },
    moviePosterUrl: { type: String, required: true },
    telegramUsername: { type: String, required: true },
    phone: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "payment_initiated", "payment_confirmed", "delivering", "delivered", "failed"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "initiated", "confirmed", "failed"],
      default: "pending",
    },
    checkoutRequestId: { type: String, default: null },
    merchantRequestId: { type: String, default: null },
    mpesaReceiptNumber: { type: String, default: null },
    deliveredAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
  },
  { timestamps: true }
);

OrderSchema.index({ telegramUsername: 1 });
OrderSchema.index({ checkoutRequestId: 1 });
OrderSchema.index({ status: 1 });

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
