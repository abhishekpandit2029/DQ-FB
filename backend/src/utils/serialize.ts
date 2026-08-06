import { DEFAULT_INTERACTION_SETTINGS, InteractionSettings } from "../models/User";

export interface PublicUser {
  _id: string;
  username: string;
  full_name: string;
  userprofile_image: string;
  bio: string;
  isPrivate: boolean;
}

/**
 * A structural shape rather than `IUser`, so hydrated documents and `.lean()`
 * results (which Mongoose types as `FlattenMaps<IUser>`) both satisfy it.
 */
export interface UserLike {
  _id: unknown;
  username?: string;
  email?: string;
  full_name?: string;
  additional_name?: string;
  pronounce?: string;
  bio?: string;
  link?: string;
  link_alias?: string;
  location?: string;
  language?: string;
  userprofile_image?: string;
  isPrivate?: boolean;
  isVerfied?: boolean;
  isAdmin?: boolean;
  interaction?:
    | Partial<InteractionSettings>
    | (Partial<InteractionSettings> & { toObject(): Partial<InteractionSettings> })
    | null;
  followersCount?: number;
  followingCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Mongoose subdocuments keep their schema values inside `_doc`; spreading the
 * subdocument itself therefore loses those values. Normalise hydrated and lean
 * users before merging defaults so saved interaction preferences survive a
 * `/users/me` refresh. Older users without this field still receive defaults.
 */
function interactionSettings(user: UserLike): InteractionSettings {
  const stored = user.interaction;
  const plain =
    stored && typeof (stored as { toObject?: unknown }).toObject === "function"
      ? (stored as { toObject(): Partial<InteractionSettings> }).toObject()
      : stored;

  return { ...DEFAULT_INTERACTION_SETTINGS, ...(plain ?? {}) };
}

/** The shape safe to hand to any authenticated viewer. */
export function publicUser(user: UserLike): PublicUser {
  return {
    _id: String(user._id),
    username: user.username ?? "",
    full_name: user.full_name ?? "",
    userprofile_image: user.userprofile_image ?? "",
    bio: user.bio ?? "",
    isPrivate: Boolean(user.isPrivate),
  };
}

/** The full profile, only ever returned for the signed-in user themselves. */
export function selfUser(user: UserLike) {
  return {
    ...publicUser(user),
    email: user.email ?? "",
    additional_name: user.additional_name ?? "",
    pronounce: user.pronounce ?? "",
    link: user.link ?? "",
    link_alias: user.link_alias ?? "",
    location: user.location ?? "",
    language: user.language ?? "",
    isVerfied: Boolean(user.isVerfied),
    isAdmin: Boolean(user.isAdmin),
    interaction: interactionSettings(user),
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
