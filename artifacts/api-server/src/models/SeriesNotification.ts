import mongoose, { Document, Schema } from "mongoose";

export interface ISeriesNotification extends Document {
  seriesId: mongoose.Types.ObjectId;
  telegramUsername: string;
  notifiedAt?: Date | null;
  createdAt: Date;
}

const SeriesNotificationSchema = new Schema<ISeriesNotification>(
  {
    seriesId: { type: Schema.Types.ObjectId, ref: "Series", required: true },
    telegramUsername: { type: String, required: true, trim: true, lowercase: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SeriesNotificationSchema.index({ seriesId: 1, telegramUsername: 1 }, { unique: true });

export const SeriesNotification = mongoose.model<ISeriesNotification>(
  "SeriesNotification",
  SeriesNotificationSchema
);
