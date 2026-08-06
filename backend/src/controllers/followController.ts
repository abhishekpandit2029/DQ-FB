import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import Follow from "../models/Follow";
import User from "../models/User";
import { ApiError } from "../utils/ApiError";
import { currentUserId } from "../middleware/auth";
import { publicUser } from "../utils/serialize";
import { emitToUser } from "../sockets/registry";
import { getRelationship } from "../services/relationship";

const targetSchema = z.object({
  userId: z.string().refine((id) => Types.ObjectId.isValid(id), "Invalid user id"),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

/**
 * Sending a follow request. Every follow — public or private account — starts
 * as `pending` and only lands in the follower/following lists once the
 * recipient accepts it.
 */
export async function sendFollowRequest(req: Request, res: Response) {
  const requesterId = currentUserId(req);
  const { userId: recipientId } = targetSchema.parse(req.body);

  if (requesterId === recipientId) {
    throw ApiError.badRequest("You cannot follow yourself");
  }

  const recipient = await User.findById(recipientId).select("_id username").lean();
  if (!recipient) throw ApiError.notFound("User not found");

  const existing = await Follow.findOne({
    requester: requesterId,
    recipient: recipientId,
  });

  if (existing) {
    throw ApiError.conflict(
      existing.status === "accepted"
        ? "You already follow this user"
        : "Your follow request is already pending"
    );
  }

  const follow = await Follow.create({
    requester: requesterId,
    recipient: recipientId,
    status: "pending",
  });

  const requester = await User.findById(requesterId)
    .select("username full_name userprofile_image isPrivate")
    .lean();

  emitToUser(recipientId, "follow:request", {
    requestId: String(follow._id),
    from: requester ? publicUser(requester) : null,
    createdAt: follow.createdAt,
  });

  res.status(201).json({
    message: "Follow request sent",
    success: true,
    status: "requested",
  });
}

/** Withdraw a request you sent that has not been accepted yet. */
export async function cancelFollowRequest(req: Request, res: Response) {
  const requesterId = currentUserId(req);
  const { userId: recipientId } = targetSchema.parse(req.body);

  const removed = await Follow.findOneAndDelete({
    requester: requesterId,
    recipient: recipientId,
    status: "pending",
  });
  if (!removed) throw ApiError.notFound("No pending request found");

  emitToUser(recipientId, "follow:request-cancelled", { userId: requesterId });

  res.json({ message: "Follow request withdrawn", success: true, status: "none" });
}

const respondSchema = z.object({
  requestId: z
    .string()
    .refine((id) => Types.ObjectId.isValid(id), "Invalid request id")
    .optional(),
  userId: z
    .string()
    .refine((id) => Types.ObjectId.isValid(id), "Invalid user id")
    .optional(),
});

/**
 * Accept an incoming request. The counters and the edge status move together in
 * a transaction so a failure can't leave a follower counted twice.
 */
export async function acceptFollowRequest(req: Request, res: Response) {
  const recipientId = currentUserId(req);
  const { requestId, userId } = respondSchema.parse(req.body);

  if (!requestId && !userId) {
    throw ApiError.badRequest("A request id or user id is required");
  }

  const follow = await Follow.findOne({
    ...(requestId ? { _id: requestId } : { requester: userId }),
    recipient: recipientId,
    status: "pending",
  });
  if (!follow) throw ApiError.notFound("No pending request found");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      follow.status = "accepted";
      follow.respondedAt = new Date();
      await follow.save({ session });

      await User.updateOne(
        { _id: follow.recipient },
        { $inc: { followersCount: 1 } },
        { session }
      );
      await User.updateOne(
        { _id: follow.requester },
        { $inc: { followingCount: 1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  const recipient = await User.findById(recipientId)
    .select("username full_name userprofile_image isPrivate")
    .lean();

  emitToUser(String(follow.requester), "follow:accepted", {
    user: recipient ? publicUser(recipient) : null,
  });

  res.json({ message: "Follow request accepted", success: true, status: "accepted" });
}

/** Decline an incoming request — the edge is removed entirely. */
export async function rejectFollowRequest(req: Request, res: Response) {
  const recipientId = currentUserId(req);
  const { requestId, userId } = respondSchema.parse(req.body);

  if (!requestId && !userId) {
    throw ApiError.badRequest("A request id or user id is required");
  }

  const removed = await Follow.findOneAndDelete({
    ...(requestId ? { _id: requestId } : { requester: userId }),
    recipient: recipientId,
    status: "pending",
  });
  if (!removed) throw ApiError.notFound("No pending request found");

  emitToUser(String(removed.requester), "follow:rejected", { userId: recipientId });

  res.json({ message: "Follow request declined", success: true, status: "none" });
}

/** Stop following someone you were following. */
export async function unfollow(req: Request, res: Response) {
  const requesterId = currentUserId(req);
  const { userId: recipientId } = targetSchema.parse(req.body);

  const follow = await Follow.findOne({
    requester: requesterId,
    recipient: recipientId,
    status: "accepted",
  });
  if (!follow) throw ApiError.notFound("You are not following this user");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Follow.deleteOne({ _id: follow._id }, { session });
      await User.updateOne(
        { _id: recipientId, followersCount: { $gt: 0 } },
        { $inc: { followersCount: -1 } },
        { session }
      );
      await User.updateOne(
        { _id: requesterId, followingCount: { $gt: 0 } },
        { $inc: { followingCount: -1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  emitToUser(recipientId, "follow:removed", { userId: requesterId });

  res.json({ message: "Unfollowed successfully", success: true, status: "none" });
}

/** Remove one of your own followers. */
export async function removeFollower(req: Request, res: Response) {
  const recipientId = currentUserId(req);
  const { userId: followerId } = targetSchema.parse(req.body);

  const follow = await Follow.findOne({
    requester: followerId,
    recipient: recipientId,
    status: "accepted",
  });
  if (!follow) throw ApiError.notFound("That user is not following you");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Follow.deleteOne({ _id: follow._id }, { session });
      await User.updateOne(
        { _id: recipientId, followersCount: { $gt: 0 } },
        { $inc: { followersCount: -1 } },
        { session }
      );
      await User.updateOne(
        { _id: followerId, followingCount: { $gt: 0 } },
        { $inc: { followingCount: -1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  emitToUser(followerId, "follow:removed", { userId: recipientId });

  res.json({ message: "Follower removed", success: true });
}

/* -------------------------------------------------------------------------- */
/*                                   Listings                                 */
/* -------------------------------------------------------------------------- */

/** Requests waiting on the signed-in user's approval. */
export async function listIncomingRequests(req: Request, res: Response) {
  const userId = currentUserId(req);
  const { limit, page } = paginationSchema.parse(req.query);

  const [requests, total] = await Promise.all([
    Follow.find({ recipient: userId, status: "pending" })
      .populate("requester", "username full_name userprofile_image bio isPrivate")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Follow.countDocuments({ recipient: userId, status: "pending" }),
  ]);

  res.json({
    success: true,
    total,
    requests: requests.map((request) => ({
      requestId: String(request._id),
      createdAt: request.createdAt,
      user: publicUser(request.requester as never),
    })),
  });
}

/** Requests the signed-in user has sent that are still pending. */
export async function listOutgoingRequests(req: Request, res: Response) {
  const userId = currentUserId(req);
  const { limit, page } = paginationSchema.parse(req.query);

  const requests = await Follow.find({ requester: userId, status: "pending" })
    .populate("recipient", "username full_name userprofile_image bio isPrivate")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    requests: requests.map((request) => ({
      requestId: String(request._id),
      createdAt: request.createdAt,
      user: publicUser(request.recipient as never),
    })),
  });
}

async function assertCanSeeConnections(viewerId: string, targetId: string) {
  if (viewerId === targetId) return;
  const relationship = await getRelationship(viewerId, targetId);
  if (!relationship.canViewPosts) {
    throw ApiError.forbidden("This account is private");
  }
}

export async function listFollowers(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const targetId = req.params.userId ?? viewerId;
  const { limit, page } = paginationSchema.parse(req.query);

  await assertCanSeeConnections(viewerId, targetId);

  const edges = await Follow.find({ recipient: targetId, status: "accepted" })
    .populate("requester", "username full_name userprofile_image bio isPrivate")
    .sort({ respondedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    users: edges.map((edge) => publicUser(edge.requester as never)),
  });
}

export async function listFollowing(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const targetId = req.params.userId ?? viewerId;
  const { limit, page } = paginationSchema.parse(req.query);

  await assertCanSeeConnections(viewerId, targetId);

  const edges = await Follow.find({ requester: targetId, status: "accepted" })
    .populate("recipient", "username full_name userprofile_image bio isPrivate")
    .sort({ respondedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    users: edges.map((edge) => publicUser(edge.recipient as never)),
  });
}

export async function relationshipWith(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { userId } = req.params;
  if (!Types.ObjectId.isValid(userId)) throw ApiError.badRequest("Invalid user id");

  res.json({ success: true, relationship: await getRelationship(viewerId, userId) });
}
