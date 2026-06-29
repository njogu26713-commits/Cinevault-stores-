import mongoose, { Document, Schema } from "mongoose";

export interface IMovie extends Document {
  title: string;
  description: string;
  posterUrl: string;
  bannerUrl?: string | null;
  youtubeTrailerId?: string | null;
  genre: string[];
  duration: string;
  quality: "720p" | "1080p" | "4K";
  fileSize: string;
  price: number;
  featured: boolean;
  rating?: number | null;
  year: number;
  telegramFileId?: string | null;
  telegramMessageId?: number | null;
  subtitleUrl?: string | null;
  subtitleVtt?: string | null;
  subtitleStatus?: "generating" | "ready" | "error" | null;
  published?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MovieSchema = new Schema<IMovie>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    posterUrl: { type: String, required: true },
    bannerUrl: { type: String, default: null },
    youtubeTrailerId: { type: String, default: null },
    genre: [{ type: String }],
    duration: { type: String, required: true },
    quality: { type: String, enum: ["720p", "1080p", "4K"], required: true },
    fileSize: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    featured: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 10, default: null },
    year: { type: Number, required: true },
    telegramFileId: { type: String, default: null },
    telegramMessageId: { type: Number, default: null },
    subtitleUrl: { type: String, default: null },
    subtitleVtt: { type: String, default: null },
    subtitleStatus: { type: String, enum: ["generating", "ready", "error"], default: null },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MovieSchema.index({ genre: 1 });
MovieSchema.index({ quality: 1 });
MovieSchema.index({ featured: 1 });
MovieSchema.index({ title: "text", description: "text" });

export const Movie = mongoose.model<IMovie>("Movie", MovieSchema);
