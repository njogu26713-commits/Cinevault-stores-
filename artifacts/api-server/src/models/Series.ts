import mongoose, { Document, Schema } from "mongoose";

export interface IEpisode {
  episodeNumber: number;
  title: string;
  duration: string;
  telegramFileId?: string | null;
  telegramMessageId?: number | null;
  subtitleUrl?: string | null;
  subtitleVtt?: string | null;
  subtitleStatus?: "generating" | "ready" | "error" | null;
}

export interface ISeason {
  seasonNumber: number;
  episodes: IEpisode[];
}

export interface ISeries extends Document {
  title: string;
  description: string;
  posterUrl: string;
  bannerUrl?: string | null;
  youtubeTrailerId?: string | null;
  genre: string[];
  quality: "720p" | "1080p" | "4K";
  rating?: number | null;
  year: number;
  status: "Ongoing" | "Completed" | "Cancelled";
  featured: boolean;
  seasons: ISeason[];
  pricePerSeason: number;
  pricePerEpisode: number;
  createdAt: Date;
  updatedAt: Date;
}

const EpisodeSchema = new Schema<IEpisode>(
  {
    episodeNumber: { type: Number, required: true },
    title: { type: String, required: true },
    duration: { type: String, required: true },
    telegramFileId: { type: String, default: null },
    telegramMessageId: { type: Number, default: null },
    subtitleUrl: { type: String, default: null },
    subtitleVtt: { type: String, default: null },
    subtitleStatus: { type: String, enum: ["generating", "ready", "error"], default: null },
  },
  { _id: false }
);

const SeasonSchema = new Schema<ISeason>(
  {
    seasonNumber: { type: Number, required: true },
    episodes: [EpisodeSchema],
  },
  { _id: false }
);

const SeriesSchema = new Schema<ISeries>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    posterUrl: { type: String, required: true },
    bannerUrl: { type: String, default: null },
    youtubeTrailerId: { type: String, default: null },
    genre: [{ type: String }],
    quality: { type: String, enum: ["720p", "1080p", "4K"], required: true },
    rating: { type: Number, min: 0, max: 10, default: null },
    year: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Ongoing", "Completed", "Cancelled"],
      default: "Ongoing",
    },
    featured: { type: Boolean, default: false },
    seasons: [SeasonSchema],
    pricePerSeason: { type: Number, required: true, min: 0 },
    pricePerEpisode: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

SeriesSchema.index({ genre: 1 });
SeriesSchema.index({ quality: 1 });
SeriesSchema.index({ featured: 1 });
SeriesSchema.index({ title: "text", description: "text" });

export const Series = mongoose.model<ISeries>("Series", SeriesSchema);
