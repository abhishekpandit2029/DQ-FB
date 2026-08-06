import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import Follow from "../models/Follow";
import User, { Audience, DEFAULT_INTERACTION_SETTINGS } from "../models/User";
import { getRelationship } from "../services/relationship";
import { uploadProfileImage } from "../services/cloudinary";
import { ApiError } from "../utils/ApiError";
import { currentUserId } from "../middleware/auth";
import { publicUser, selfUser } from "../utils/serialize";

/** Escapes regex metacharacters so user input can't act as a pattern. */
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getMe(req: Request, res: Response) {
  const user = await User.findById(currentUserId(req));
  if (!user) throw ApiError.notFound("User not found");

  const pendingRequests = await Follow.countDocuments({
    recipient: user._id,
    status: "pending",
  });

  res.json({ data: { ...selfUser(user), pendingFollowRequests: pendingRequests } });
}

const updateMeSchema = z.object({
  full_name: z.string().trim().max(80).optional(),
  additional_name: z.string().trim().max(80).optional(),
  pronounce: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(500).optional(),
  link: z.string().trim().max(200).optional(),
  link_alias: z.string().trim().max(80).optional(),
  location: z.string().trim().max(80).optional(),
  language: z.string().trim().max(40).optional(),
  isPrivate: z.boolean().optional(),
});

export async function updateMe(req: Request, res: Response) {
  const updates = updateMeSchema.parse(req.body);

  const user = await User.findByIdAndUpdate(currentUserId(req), updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw ApiError.notFound("User not found");

  res.json({ message: "Profile updated successfully", success: true, data: selfUser(user) });
}

const audienceSchema = z.enum(["everyone", "followers"]);

const interactionSchema = z
  .object({
    allowMessages: z.boolean().optional(),
    allowAudioCalls: z.boolean().optional(),
    allowVideoCalls: z.boolean().optional(),
    messageAudience: audienceSchema.optional(),
    audioCallAudience: audienceSchema.optional(),
    videoCallAudience: audienceSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

/**
 * The six reachability controls: three master switches for whether you want to
 * be messaged / audio called / video called at all, and three audience choices
 * for who may do it when you are reachable.
 */
export async function updateInteractionSettings(req: Request, res: Response) {
  const updates = interactionSchema.parse(req.body);

  // Dot-paths so a partial update doesn't clobber the other five settings.
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    patch[`interaction.${key}`] = value;
  }

  const user = await User.findByIdAndUpdate(currentUserId(req), patch, {
    new: true,
    runValidators: true,
  });
  if (!user) throw ApiError.notFound("User not found");

  res.json({
    message: "Settings updated",
    success: true,
    data: selfUser(user),
  });
}

const privacySchema = z.object({ isPrivate: z.boolean() });

/**
 * Switching to private does not retroactively drop existing followers — they
 * were already approved. Switching to public leaves pending requests intact so
 * the owner can still triage them.
 */
export async function updatePrivacy(req: Request, res: Response) {
  const { isPrivate } = privacySchema.parse(req.body);

  const user = await User.findByIdAndUpdate(
    currentUserId(req),
    { isPrivate },
    { new: true }
  );
  if (!user) throw ApiError.notFound("User not found");

  res.json({
    message: isPrivate ? "Your account is now private" : "Your account is now public",
    success: true,
    data: selfUser(user),
  });
}

const avatarSchema = z.object({
  userprofile_image: z.string().min(1, "An image is required"),
});

export async function updateAvatar(req: Request, res: Response) {
  const { userprofile_image } = avatarSchema.parse(req.body);

  const secureUrl = await uploadProfileImage(userprofile_image);
  const user = await User.findByIdAndUpdate(
    currentUserId(req),
    { userprofile_image: secureUrl },
    { new: true }
  );
  if (!user) throw ApiError.notFound("User not found");

  res.json({ message: "Profile photo updated", success: true, data: selfUser(user) });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await User.findById(currentUserId(req)).select("+password");
  if (!user) throw ApiError.notFound("User not found");

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({ message: "Password updated successfully", success: true });
}

/* -------------------------------------------------------------------------- */
/*                              Discovery / profiles                          */
/* -------------------------------------------------------------------------- */

const listUsersSchema = z.object({
  searchQuery: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

export async function listUsers(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { searchQuery, limit, page } = listUsersSchema.parse(req.query);

  const filter: Record<string, unknown> = { _id: { $ne: new Types.ObjectId(viewerId) } };

  if (searchQuery) {
    if (Types.ObjectId.isValid(searchQuery)) {
      filter._id = { $ne: new Types.ObjectId(viewerId), $eq: new Types.ObjectId(searchQuery) };
    } else {
      // Escape regex metacharacters so a search for "a.b" can't be used as a pattern.
      const safe = escapeRegex(searchQuery);
      filter.$or = [
        { username: { $regex: safe, $options: "i" } },
        { full_name: { $regex: safe, $options: "i" } },
      ];
    }
  }

  const users = await User.find(filter)
    .select("username full_name userprofile_image bio isPrivate interaction")
    .sort({ username: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Annotate each row with the viewer's relationship so the UI can render the
  // right button (Follow / Requested / Following) without an N+1 round trip.
  const ids = users.map((user) => user._id);
  const [outgoing, incoming] = await Promise.all([
    Follow.find({ requester: viewerId, recipient: { $in: ids } })
      .select("recipient status")
      .lean(),
    Follow.find({ requester: { $in: ids }, recipient: viewerId })
      .select("requester status")
      .lean(),
  ]);

  const outgoingByUser = new Map(outgoing.map((e) => [String(e.recipient), e.status]));
  const incomingByUser = new Map(incoming.map((e) => [String(e.requester), e.status]));

  res.json({
    message: "Users found",
    success: true,
    users: users.map((user) => {
      const out = outgoingByUser.get(String(user._id));
      const inc = incomingByUser.get(String(user._id));
      const isFollowing = out === "accepted";
      const connected = isFollowing || inc === "accepted";
      const settings = { ...DEFAULT_INTERACTION_SETTINGS, ...(user.interaction ?? {}) };

      const open = (enabled: boolean, audience: Audience) =>
        enabled && (audience === "everyone" || connected);

      const canMessage = open(settings.allowMessages, settings.messageAudience);
      const canAudioCall = open(settings.allowAudioCalls, settings.audioCallAudience);
      const canVideoCall = open(settings.allowVideoCalls, settings.videoCallAudience);

      return {
        ...publicUser(user),
        relationship: {
          outgoing: isFollowing
            ? "following"
            : out === "pending"
              ? "requested"
              : inc === "pending"
                ? "incoming"
                : "none",
          followsYou: inc === "accepted",
          canViewPosts: !user.isPrivate || isFollowing,
          canMessage,
          canAudioCall,
          canVideoCall,
          canInteract: canMessage || canAudioCall || canVideoCall,
        },
      };
    }),
  });
}

export async function getProfile(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { identifier } = req.params;

  /**
   * Accepts either an id or a username.
   *
   * The username match is case-insensitive rather than lowercased: accounts
   * created before usernames were normalised are stored with their original
   * casing, and forcing the needle to lowercase makes those unfindable.
   */
  const query = Types.ObjectId.isValid(identifier)
    ? { _id: identifier }
    : { username: new RegExp(`^${escapeRegex(identifier)}$`, "i") };

  const user = await User.findOne(query).lean();
  if (!user) throw ApiError.notFound("User not found");

  const relationship = await getRelationship(viewerId, String(user._id));
  const isSelf = String(user._id) === viewerId;

  res.json({
    success: true,
    data: {
      ...(isSelf ? selfUser(user) : publicUser(user)),
      followersCount: user.followersCount ?? 0,
      followingCount: user.followingCount ?? 0,
      location: user.location ?? "",
      link: user.link ?? "",
      link_alias: user.link_alias ?? "",
      pronounce: user.pronounce ?? "",
      additional_name: user.additional_name ?? "",
      createdAt: user.createdAt,
      relationship,
    },
  });
}
