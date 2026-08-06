import { Types } from "mongoose";
import Follow from "../models/Follow";
import User, { DEFAULT_INTERACTION_SETTINGS, InteractionSettings } from "../models/User";
import { ApiError } from "../utils/ApiError";

export type RelationshipState =
  | "self"
  | "none"
  | "requested" // viewer -> target, awaiting target's approval
  | "incoming" // target -> viewer, awaiting viewer's approval
  | "following"; // viewer -> target, accepted

export type InteractionKind = "message" | "audio" | "video";

export interface InteractionPermission {
  allowed: boolean;
  /** Why it was refused, ready to surface to the person who tried. */
  reason?: string;
}

export interface RelationshipSummary {
  /** viewer -> target */
  outgoing: RelationshipState;
  /** whether the target follows the viewer back (accepted) */
  followsYou: boolean;
  /** whether the viewer may read the target's diary entries */
  canViewPosts: boolean;
  canMessage: boolean;
  canAudioCall: boolean;
  canVideoCall: boolean;
  /** true when any of the three channels is open */
  canInteract: boolean;
}

function oid(id: string | Types.ObjectId) {
  return new Types.ObjectId(String(id));
}

/** Whether an accepted follow edge exists in either direction. */
export async function areConnected(userA: string, userB: string): Promise<boolean> {
  if (String(userA) === String(userB)) return false;

  const edge = await Follow.exists({
    status: "accepted",
    $or: [
      { requester: oid(userA), recipient: oid(userB) },
      { requester: oid(userB), recipient: oid(userA) },
    ],
  });

  return Boolean(edge);
}

const CHANNEL = {
  message: {
    enabled: "allowMessages",
    audience: "messageAudience",
    offMessage: "This person has turned off messages",
    followersOnlyMessage:
      "This person only accepts messages from people they're connected with",
  },
  audio: {
    enabled: "allowAudioCalls",
    audience: "audioCallAudience",
    offMessage: "This person has turned off audio calls",
    followersOnlyMessage:
      "This person only accepts audio calls from people they're connected with",
  },
  video: {
    enabled: "allowVideoCalls",
    audience: "videoCallAudience",
    offMessage: "This person has turned off video calls",
    followersOnlyMessage:
      "This person only accepts video calls from people they're connected with",
  },
} as const;

function settingsOf(user: { interaction?: Partial<InteractionSettings> } | null): InteractionSettings {
  return { ...DEFAULT_INTERACTION_SETTINGS, ...(user?.interaction ?? {}) };
}

/**
 * Can `initiator` start a `kind` interaction with `target`?
 *
 * The target's own settings decide: first whether the channel is open at all,
 * then whether it's open to everyone or only to people they're connected with.
 * A connection means an accepted follow edge in either direction, so the person
 * being followed can always answer back.
 */
export async function canInteract(
  initiator: string,
  target: string,
  kind: InteractionKind
): Promise<InteractionPermission> {
  if (String(initiator) === String(target)) {
    return { allowed: false, reason: "You cannot do that with yourself" };
  }

  const targetUser = await User.findById(target).select("interaction").lean();
  if (!targetUser) return { allowed: false, reason: "User not found" };

  const settings = settingsOf(targetUser);
  const channel = CHANNEL[kind];

  if (!settings[channel.enabled]) {
    return { allowed: false, reason: channel.offMessage };
  }

  if (settings[channel.audience] === "everyone") {
    return { allowed: true };
  }

  if (await areConnected(initiator, target)) return { allowed: true };

  return { allowed: false, reason: channel.followersOnlyMessage };
}

/** Same as {@link canInteract} but throws a 403 instead of returning a result. */
export async function assertCanInteract(
  initiator: string,
  target: string,
  kind: InteractionKind
) {
  const permission = await canInteract(initiator, target, kind);
  if (!permission.allowed) {
    throw ApiError.forbidden(permission.reason ?? "This interaction is not allowed");
  }
}

/** Whether `viewer` is allowed to read `target`'s diary entries. */
export async function canViewPosts(
  viewer: string | null,
  target: string
): Promise<boolean> {
  if (viewer && String(viewer) === String(target)) return true;

  const targetUser = await User.findById(target).select("isPrivate").lean();
  if (!targetUser) return false;
  if (!targetUser.isPrivate) return true;
  if (!viewer) return false;

  const edge = await Follow.exists({
    requester: oid(viewer),
    recipient: oid(target),
    status: "accepted",
  });

  return Boolean(edge);
}

export async function getRelationship(
  viewer: string | null,
  target: string
): Promise<RelationshipSummary> {
  if (viewer && String(viewer) === String(target)) {
    return {
      outgoing: "self",
      followsYou: false,
      canViewPosts: true,
      canMessage: false,
      canAudioCall: false,
      canVideoCall: false,
      canInteract: false,
    };
  }

  const targetUser = await User.findById(target).select("isPrivate interaction").lean();
  if (!targetUser) throw ApiError.notFound("User not found");

  if (!viewer) {
    return {
      outgoing: "none",
      followsYou: false,
      canViewPosts: !targetUser.isPrivate,
      canMessage: false,
      canAudioCall: false,
      canVideoCall: false,
      canInteract: false,
    };
  }

  const [outgoingEdge, incomingEdge] = await Promise.all([
    Follow.findOne({ requester: oid(viewer), recipient: oid(target) })
      .select("status")
      .lean(),
    Follow.findOne({ requester: oid(target), recipient: oid(viewer) })
      .select("status")
      .lean(),
  ]);

  let outgoing: RelationshipState = "none";
  if (outgoingEdge) {
    outgoing = outgoingEdge.status === "accepted" ? "following" : "requested";
  } else if (incomingEdge?.status === "pending") {
    outgoing = "incoming";
  }

  const followsYou = incomingEdge?.status === "accepted";
  const isFollowing = outgoingEdge?.status === "accepted";
  const connected = Boolean(isFollowing || followsYou);

  const settings = settingsOf(targetUser);
  const open = (kind: InteractionKind) => {
    const channel = CHANNEL[kind];
    if (!settings[channel.enabled]) return false;
    return settings[channel.audience] === "everyone" || connected;
  };

  const canMessage = open("message");
  const canAudioCall = open("audio");
  const canVideoCall = open("video");

  return {
    outgoing,
    followsYou,
    canViewPosts: !targetUser.isPrivate || isFollowing,
    canMessage,
    canAudioCall,
    canVideoCall,
    canInteract: canMessage || canAudioCall || canVideoCall,
  };
}

/** Ids of everyone `userId` follows with an accepted edge. */
export async function acceptedFollowingIds(
  userId: string
): Promise<Types.ObjectId[]> {
  const edges = await Follow.find({
    requester: oid(userId),
    status: "accepted",
  })
    .select("recipient")
    .lean();

  return edges.map((edge) => edge.recipient as Types.ObjectId);
}
