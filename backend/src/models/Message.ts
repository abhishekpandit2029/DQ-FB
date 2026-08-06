import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  _id: Types.ObjectId;
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  text: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: "chats",
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "users", required: true },
    receiver: { type: Schema.Types.ObjectId, ref: "users", required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    readAt: { type: Date },
  },
  { collection: "messages", timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, readAt: 1 });

const Message =
  (mongoose.models.messages as mongoose.Model<IMessage>) ||
  mongoose.model<IMessage>("messages", messageSchema);

export default Message;
