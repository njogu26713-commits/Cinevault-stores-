import mongoose, { Document, Schema } from "mongoose";

export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "coming_soon"
  | "added"
  | "unavailable";

export interface IMovieRequest extends Document {
  title: string;
  category: "movie" | "series";
  posterUrl: string | null;
  reason: string;
  userId: string;
  username: string;
  votes: string[];
  status: RequestStatus;
  adminNote: string | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MovieRequestSchema = new Schema<IMovieRequest>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: ["movie", "series"], required: true },
    posterUrl: { type: String, default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    votes: [{ type: String }],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "coming_soon", "added", "unavailable"],
      default: "pending",
    },
    adminNote: { type: String, default: null },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MovieRequestSchema.index({ status: 1, createdAt: -1 });
MovieRequestSchema.index({ userId: 1 });

export const MovieRequest = mongoose.model<IMovieRequest>("MovieRequest", MovieRequestSchema);
