import mongoose, { Document, Schema } from "mongoose";

export type NotificationType = "reply" | "like" | "request_status";

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  relatedId: string | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["reply", "like", "request_status"], required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
