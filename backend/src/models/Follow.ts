import mongoose, { Document, Schema, Types } from "mongoose";

export type FollowStatus = "pending" | "accepted";

/**
 * A single directed edge: `requester` wants to / does follow `recipient`.
 *
 * A follow always starts life as `pending` and only becomes `accepted` once the
 * recipient approves it. Messaging and calling both require an accepted edge.
 */
export interface IFollow extends Document {
  _id: Types.ObjectId;
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: FollowStatus;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const followSchema = new Schema<IFollow>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date },
  },
  { collection: "follows", timestamps: true }
);

// One edge per direction per pair.
followSchema.index({ requester: 1, recipient: 1 }, { unique: true });
followSchema.index({ recipient: 1, status: 1, createdAt: -1 });
followSchema.index({ requester: 1, status: 1, createdAt: -1 });

const Follow =
  (mongoose.models.follows as mongoose.Model<IFollow>) ||
  mongoose.model<IFollow>("follows", followSchema);

export default Follow;
