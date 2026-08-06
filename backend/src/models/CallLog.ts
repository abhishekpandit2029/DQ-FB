import mongoose, { Document, Schema, Types } from "mongoose";

export type CallKind = "audio" | "video";
export type CallOutcome = "answered" | "declined" | "missed" | "cancelled" | "failed";

export interface ICallLog extends Document {
  _id: Types.ObjectId;
  callId: string;
  caller: Types.ObjectId;
  callee: Types.ObjectId;
  kind: CallKind;
  outcome: CallOutcome;
  startedAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
  durationSec: number;
}

const callLogSchema = new Schema<ICallLog>(
  {
    callId: { type: String, required: true, unique: true },
    caller: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    callee: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    kind: { type: String, enum: ["audio", "video"], required: true },
    outcome: {
      type: String,
      enum: ["answered", "declined", "missed", "cancelled", "failed"],
      default: "missed",
    },
    startedAt: { type: Date, required: true },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    durationSec: { type: Number, default: 0 },
  },
  { collection: "calllogs", timestamps: true }
);

callLogSchema.index({ caller: 1, startedAt: -1 });
callLogSchema.index({ callee: 1, startedAt: -1 });

const CallLog =
  (mongoose.models.calllogs as mongoose.Model<ICallLog>) ||
  mongoose.model<ICallLog>("calllogs", callLogSchema);

export default CallLog;
