import { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import ThoughtCard from "../models/ThoughtCard";
import User from "../models/User";
import Follow from "../models/Follow";
import { ApiError } from "../utils/ApiError";
import { currentUserId } from "../middleware/auth";
import { acceptedFollowingIds, canViewPosts } from "../services/relationship";
import { publicUser } from "../utils/serialize";
import { emitToUser } from "../sockets/registry";

const objectId = (label: string) =>
  z.string().refine((id) => Types.ObjectId.isValid(id), `Invalid ${label}`);

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

/**
 * Structural shape so hydrated documents and `.lean()` results both fit
 * without casting through Mongoose's `FlattenMaps` wrapper.
 */
interface PostLike {
  _id: unknown;
  author?: unknown;
  title: string;
  content: string;
  tags?: string[];
  isSoftDelete?: boolean;
  likes?: unknown[];
  commentCount?: number;
  shareCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

function serializePost(post: PostLike, viewerId: string) {
  const likes = (post.likes ?? []).map(String);
  const author =
    post.author && typeof post.author === "object" && "username" in (post.author as object)
      ? publicUser(post.author as never)
      : { _id: String(post.author) };

  return {
    _id: String(post._id),
    title: post.title,
    content: post.content,
    tags: post.tags ?? [],
    isSoftDelete: post.isSoftDelete,
    author,
    likeCount: likes.length,
    likedByMe: likes.includes(String(viewerId)),
    commentCount: post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   CRUD                                     */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  title: z.string().trim().min(1, "Please provide a title").max(200),
  content: z.string().trim().min(1, "Please write something").max(20000),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
});

export async function createPost(req: Request, res: Response) {
  const userId = currentUserId(req);
  const body = createSchema.parse(req.body);

  const post = await ThoughtCard.create({ ...body, author: userId });
  await post.populate("author", "username full_name userprofile_image bio isPrivate");

  res.status(201).json({
    message: "Thought created successfully",
    success: true,
    post: serializePost(post, userId),
  });
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(20000).optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  isSoftDelete: z.boolean().optional(),
});

export async function updatePost(req: Request, res: Response) {
  const userId = currentUserId(req);
  const updates = updateSchema.parse(req.body);

  const post = await ThoughtCard.findOneAndUpdate(
    { _id: req.params.postId, author: userId },
    updates,
    { new: true, runValidators: true }
  ).populate("author", "username full_name userprofile_image bio isPrivate");

  if (!post) throw ApiError.notFound("Thought not found");

  res.json({
    message: "Content updated successfully",
    success: true,
    post: serializePost(post, userId),
  });
}

export async function deletePost(req: Request, res: Response) {
  const userId = currentUserId(req);

  const post = await ThoughtCard.findOneAndDelete({
    _id: req.params.postId,
    author: userId,
  });
  if (!post) throw ApiError.notFound("Thought not found");

  res.json({ message: "Content deleted successfully", success: true });
}

/* -------------------------------------------------------------------------- */
/*                                  Reading                                   */
/* -------------------------------------------------------------------------- */

/** The signed-in user's own entries, including soft-deleted ones for the bin. */
export async function listMyPosts(req: Request, res: Response) {
  const userId = currentUserId(req);
  const { limit, page } = paginationSchema.parse(req.query);
  const includeDeleted = req.query.bin === "true";

  const posts = await ThoughtCard.find({
    author: userId,
    isSoftDelete: includeDeleted,
  })
    .populate("author", "username full_name userprofile_image bio isPrivate")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    posts: posts.map((post) => serializePost(post, userId)),
  });
}

/** Someone else's entries — blocked unless their account is visible to you. */
export async function listUserPosts(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { userId: targetId } = req.params;
  const { limit, page } = paginationSchema.parse(req.query);

  if (!Types.ObjectId.isValid(targetId)) throw ApiError.badRequest("Invalid user id");

  if (!(await canViewPosts(viewerId, targetId))) {
    throw ApiError.forbidden("This account is private. Follow them to see their entries.");
  }

  const posts = await ThoughtCard.find({ author: targetId, isSoftDelete: false })
    .populate("author", "username full_name userprofile_image bio isPrivate")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    posts: posts.map((post) => serializePost(post, viewerId)),
  });
}

/** Home feed: your own entries plus everyone you have an accepted follow with. */
export async function getFeed(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { limit, page } = paginationSchema.parse(req.query);

  const followingIds = await acceptedFollowingIds(viewerId);
  const authorIds = [...followingIds, new Types.ObjectId(viewerId)];

  const posts = await ThoughtCard.find({
    author: { $in: authorIds },
    isSoftDelete: false,
  })
    .populate("author", "username full_name userprofile_image bio isPrivate")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    posts: posts.map((post) => serializePost(post, viewerId)),
  });
}

/** Discovery: recent entries from public accounts you don't follow yet. */
export async function getExplore(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { limit, page } = paginationSchema.parse(req.query);

  const publicAuthors = await User.find({ isPrivate: false }).select("_id").lean();

  const posts = await ThoughtCard.find({
    author: { $in: publicAuthors.map((user) => user._id) },
    isSoftDelete: false,
  })
    .populate("author", "username full_name userprofile_image bio isPrivate")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    posts: posts.map((post) => serializePost(post, viewerId)),
  });
}

export async function getPost(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { postId } = req.params;

  if (!Types.ObjectId.isValid(postId)) throw ApiError.badRequest("Invalid post id");

  const post = await ThoughtCard.findById(postId)
    .populate("author", "username full_name userprofile_image bio isPrivate")
    .lean();

  if (!post || post.isSoftDelete) throw ApiError.notFound("Thought not found");

  const authorId = String(
    (post.author as { _id?: unknown })?._id ?? post.author
  );
  if (!(await canViewPosts(viewerId, authorId))) {
    throw ApiError.forbidden("This account is private. Follow them to see their entries.");
  }

  res.json({ success: true, post: serializePost(post, viewerId) });
}

/* -------------------------------------------------------------------------- */
/*                             Likes and sharing                              */
/* -------------------------------------------------------------------------- */

async function loadVisiblePost(postId: string, viewerId: string) {
  if (!Types.ObjectId.isValid(postId)) throw ApiError.badRequest("Invalid post id");

  const post = await ThoughtCard.findById(postId);
  if (!post || post.isSoftDelete) throw ApiError.notFound("Thought not found");

  if (!(await canViewPosts(viewerId, String(post.author)))) {
    throw ApiError.forbidden("This account is private. Follow them to see their entries.");
  }

  return post;
}

/** Idempotent per direction — `$addToSet`/`$pull` keep double taps harmless. */
export async function toggleLike(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const post = await loadVisiblePost(req.params.postId, viewerId);

  const alreadyLiked = post.likes.some((id) => String(id) === viewerId);

  const updated = await ThoughtCard.findByIdAndUpdate(
    post._id,
    alreadyLiked
      ? { $pull: { likes: viewerId } }
      : { $addToSet: { likes: viewerId } },
    { new: true }
  ).lean();

  if (!alreadyLiked && String(post.author) !== viewerId) {
    const actor = await User.findById(viewerId)
      .select("username full_name userprofile_image isPrivate")
      .lean();
    emitToUser(String(post.author), "post:liked", {
      postId: String(post._id),
      by: actor ? publicUser(actor) : null,
    });
  }

  res.json({
    success: true,
    liked: !alreadyLiked,
    likeCount: updated?.likes.length ?? 0,
  });
}

export async function listLikes(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const post = await loadVisiblePost(req.params.postId, viewerId);

  const users = await User.find({ _id: { $in: post.likes } })
    .select("username full_name userprofile_image bio isPrivate")
    .lean();

  res.json({ success: true, users: users.map(publicUser) });
}

/**
 * Records a share and returns the canonical link. Private authors' entries are
 * deliberately not shareable — the link would 403 for the recipient anyway.
 */
export async function sharePost(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const post = await loadVisiblePost(req.params.postId, viewerId);

  const author = await User.findById(post.author).select("isPrivate username").lean();
  if (author?.isPrivate) {
    throw ApiError.forbidden("Entries from private accounts cannot be shared");
  }

  const updated = await ThoughtCard.findByIdAndUpdate(
    post._id,
    { $inc: { shareCount: 1 } },
    { new: true }
  ).lean();

  res.json({
    success: true,
    shareCount: updated?.shareCount ?? 0,
    path: `/dashboard/feed/${post._id}`,
  });
}

/** Share directly into a chat with someone you're allowed to message. */
export async function shareToFollowers(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const post = await loadVisiblePost(req.params.postId, viewerId);

  const { userIds } = z
    .object({ userIds: z.array(objectId("user id")).min(1).max(20) })
    .parse(req.body);

  // Only recipients with an accepted follow edge in either direction.
  const allowed = await Follow.find({
    status: "accepted",
    $or: [
      { requester: viewerId, recipient: { $in: userIds } },
      { requester: { $in: userIds }, recipient: viewerId },
    ],
  })
    .select("requester recipient")
    .lean();

  const allowedIds = new Set<string>();
  for (const edge of allowed) {
    const other =
      String(edge.requester) === viewerId ? String(edge.recipient) : String(edge.requester);
    if (userIds.includes(other)) allowedIds.add(other);
  }

  if (allowedIds.size === 0) {
    throw ApiError.forbidden("You can only share with people you follow");
  }

  await ThoughtCard.updateOne({ _id: post._id }, { $inc: { shareCount: allowedIds.size } });

  for (const recipientId of allowedIds) {
    emitToUser(recipientId, "post:shared", {
      postId: String(post._id),
      from: viewerId,
    });
  }

  res.json({
    success: true,
    sharedWith: [...allowedIds],
    skipped: userIds.filter((id) => !allowedIds.has(id)),
  });
}
