import mongoose, { Document, Schema } from "mongoose";

export interface IOtp extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: { type: String, required: true, lowercase: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "otps" }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp =
  (mongoose.models.otps as mongoose.Model<IOtp>) ||
  mongoose.model<IOtp>("otps", otpSchema);

export default Otp;
