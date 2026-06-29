import mongoose, { Schema, Document } from "mongoose";

export interface ISetting extends Document {
  key: string;
  value: string;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true, default: "" },
  },
  { timestamps: true }
);

export const Setting = mongoose.model<ISetting>("Setting", SettingSchema);
