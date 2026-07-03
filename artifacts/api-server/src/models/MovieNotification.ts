import mongoose, { Document, Schema } from "mongoose";

export interface IMovieNotification extends Document {
  movieId: mongoose.Types.ObjectId;
  telegramUsername: string;
  notifiedAt?: Date | null;
  createdAt: Date;
}

const MovieNotificationSchema = new Schema<IMovieNotification>(
  {
    movieId: { type: Schema.Types.ObjectId, ref: "Movie", required: true },
    telegramUsername: { type: String, required: true, trim: true, lowercase: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One subscription per user per movie
MovieNotificationSchema.index({ movieId: 1, telegramUsername: 1 }, { unique: true });

export const MovieNotification = mongoose.model<IMovieNotification>(
  "MovieNotification",
  MovieNotificationSchema
);
