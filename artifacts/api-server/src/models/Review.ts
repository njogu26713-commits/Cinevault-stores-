import mongoose, { Document, Schema } from "mongoose";

export interface IReply {
  _id: mongoose.Types.ObjectId;
  userId: string;
  username: string;
  text: string;
  createdAt: Date;
}

export interface IReport {
  userId: string;
  reason: string;
  createdAt: Date;
}

export interface IReview extends Document {
  contentType: "movie" | "series";
  contentId: string;
  userId: string;
  username: string;
  rating: number;
  text: string;
  likes: string[];
  replies: IReply[];
  reports: IReport[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReplySchema = new Schema<IReply>(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const ReportSchema = new Schema<IReport>(
  {
    userId: { type: String, required: true },
    reason: { type: String, default: "Inappropriate content" },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const ReviewSchema = new Schema<IReview>(
  {
    contentType: { type: String, enum: ["movie", "series"], required: true },
    contentId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, minlength: 10, maxlength: 2000 },
    likes: [{ type: String }],
    replies: [ReplySchema],
    reports: [ReportSchema],
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ReviewSchema.index({ contentType: 1, contentId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1 });
ReviewSchema.index({ "reports.0": 1 }); // for finding reported reviews

export const Review = mongoose.model<IReview>("Review", ReviewSchema);
