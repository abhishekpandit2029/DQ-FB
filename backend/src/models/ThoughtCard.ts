import mongoose, { Document, Schema, Types } from "mongoose";

export interface IThoughtCard extends Document {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  title: string;
  content: string;
  tags: string[];
  isSoftDelete: boolean;
  likes: Types.ObjectId[];
  commentCount: number;
  shareCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const thoughtCardSchema = new Schema<IThoughtCard>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    title: { type: String, required: [true, "Please provide a title"], trim: true },
    content: { type: String, required: [true, "Please provide content"] },
    tags: { type: [String], default: [] },
    isSoftDelete: { type: Boolean, default: false, index: true },
    likes: { type: [{ type: Schema.Types.ObjectId, ref: "users" }], default: [] },

    // Denormalised so feed queries never have to count subdocuments.
    commentCount: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 },
  },
  { collection: "thoughtcards", timestamps: true }
);

thoughtCardSchema.index({ author: 1, isSoftDelete: 1, createdAt: -1 });

const ThoughtCard =
  (mongoose.models.thoughtcards as mongoose.Model<IThoughtCard>) ||
  mongoose.model<IThoughtCard>("thoughtcards", thoughtCardSchema);

export default ThoughtCard;
