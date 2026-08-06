import mongoose, { Document, Schema, Types } from "mongoose";

export interface IChat extends Document {
  _id: Types.ObjectId;
  /** Sorted participant ids joined with ":" — the conversation's natural key. */
  pairKey: string;
  participants: Types.ObjectId[];
  lastMessage: string;
  lastMessageAt?: Date;
  lastMessageSender?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    /**
     * A unique index on `participants` would not do what it looks like: on an
     * array field the constraint applies per element, so a user could only ever
     * appear in one conversation. This scalar key gives one row per pair.
     */
    pairKey: { type: String, required: true, unique: true },

    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "users", required: true }],
      validate: {
        validator: (value: Types.ObjectId[]) => value.length === 2,
        message: "A chat must have exactly two participants",
      },
      required: true,
    },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date },
    lastMessageSender: { type: Schema.Types.ObjectId, ref: "users" },
  },
  { collection: "chats", timestamps: true }
);

chatSchema.index({ participants: 1, lastMessageAt: -1 });

const Chat =
  (mongoose.models.chats as mongoose.Model<IChat>) ||
  mongoose.model<IChat>("chats", chatSchema);

/** Canonical participant ordering, so a pair always maps to the same key. */
export function sortedPair(a: string, b: string): string[] {
  return [String(a), String(b)].sort();
}

export function pairKeyOf(a: string, b: string): string {
  return sortedPair(a, b).join(":");
}

export default Chat;
