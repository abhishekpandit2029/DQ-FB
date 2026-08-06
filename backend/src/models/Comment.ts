import mongoose, { Document, Schema, Types } from "mongoose";

export interface IComment extends Document {
  _id: Types.ObjectId;
  post: Types.ObjectId;
  author: Types.ObjectId;
  /** Set when this comment is a reply to another comment. */
  parent?: Types.ObjectId;
  text: string;
  likes: Types.ObjectId[];
  replyCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: "thoughtcards",
      required: true,
      index: true,
    },
    author: { type: Schema.Types.ObjectId, ref: "users", required: true },
    parent: { type: Schema.Types.ObjectId, ref: "comments", default: null, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    likes: { type: [{ type: Schema.Types.ObjectId, ref: "users" }], default: [] },
    replyCount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { collection: "comments", timestamps: true }
);

commentSchema.index({ post: 1, parent: 1, createdAt: -1 });

const Comment =
  (mongoose.models.comments as mongoose.Model<IComment>) ||
  mongoose.model<IComment>("comments", commentSchema);

export default Comment;
