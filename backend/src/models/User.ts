import mongoose, { Document, Schema, Types } from "mongoose";

export const DEFAULT_BIO =
  "Today's Steps, Tomorrow's Memories: Your Daily Journey Companion. Capture life's moments, reflect, and cherish memories. Your personal journaling companion, making every day memorable.";

/** Who is allowed to start an interaction with you. */
export type Audience = "everyone" | "followers";

export const AUDIENCES: Audience[] = ["everyone", "followers"];

export interface InteractionSettings {
  /** Master switches — "do you want to be reachable this way at all?" */
  allowMessages: boolean;
  allowAudioCalls: boolean;
  allowVideoCalls: boolean;
  /** And when you are reachable, by whom. */
  messageAudience: Audience;
  audioCallAudience: Audience;
  videoCallAudience: Audience;
}

export const DEFAULT_INTERACTION_SETTINGS: InteractionSettings = {
  allowMessages: true,
  allowAudioCalls: true,
  allowVideoCalls: true,
  messageAudience: "followers",
  audioCallAudience: "followers",
  videoCallAudience: "followers",
};

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  isVerfied: boolean;
  isAdmin: boolean;
  isPrivate: boolean;
  full_name?: string;
  additional_name?: string;
  pronounce?: string;
  bio?: string;
  link?: string;
  link_alias?: string;
  location?: string;
  language?: string;
  userprofile_image?: string;
  interaction: InteractionSettings;
  followersCount: number;
  followingCount: number;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const interactionSchema = new Schema<InteractionSettings>(
  {
    allowMessages: { type: Boolean, default: true },
    allowAudioCalls: { type: Boolean, default: true },
    allowVideoCalls: { type: Boolean, default: true },
    messageAudience: { type: String, enum: AUDIENCES, default: "followers" },
    audioCallAudience: { type: String, enum: AUDIENCES, default: "followers" },
    videoCallAudience: { type: String, enum: AUDIENCES, default: "followers" },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Please provide a username"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "Please provide a email"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      select: false,
    },
    isVerfied: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },

    // When true, only accepted followers can see this user's diary entries.
    isPrivate: { type: Boolean, default: false },

    full_name: { type: String, default: "" },
    additional_name: { type: String, default: "" },
    pronounce: { type: String, default: "" },
    bio: { type: String, default: DEFAULT_BIO },
    link: { type: String, default: "" },
    link_alias: { type: String, default: "" },
    location: { type: String, default: "" },
    language: { type: String, default: "" },
    userprofile_image: { type: String, default: "" },

    interaction: {
      type: interactionSchema,
      default: () => ({ ...DEFAULT_INTERACTION_SETTINGS }),
    },

    // Denormalised counters kept in sync by the follow service.
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },

    lastSeenAt: { type: Date },
  },
  { collection: "users", timestamps: true }
);

// No text index here on purpose. A text index treats each document's
// `language` field as the language to index that document in, and ours is a
// user's UI preference whose "" default is not a language MongoDB accepts — so
// every insert failed with "language override unsupported" (error 17262) and
// signup returned a 500. Nothing queried it either: `listUsers` matches
// username/full_name with an escaped regex, never `$text`.

const User =
  (mongoose.models.users as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("users", userSchema);

export default User;
