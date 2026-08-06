import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import Comment, { IComment } from "../models/Comment";
import ThoughtCard from "../models/ThoughtCard";
import User from "../models/User";
import { ApiError } from "../utils/ApiError";
import { currentUserId } from "../middleware/auth";
import { canViewPosts } from "../services/relationship";
import { publicUser } from "../utils/serialize";
import { emitToUser } from "../sockets/registry";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
  parentId: z
    .string()
    .refine((id) => Types.ObjectId.isValid(id), "Invalid comment id")
    .optional(),
});

/**
 * Structural shape so hydrated documents and `.lean()` results both fit
 * without casting through Mongoose's `FlattenMaps` wrapper.
 */
interface CommentLike {
  _id: unknown;
  post: unknown;
  parent?: unknown;
  author?: unknown;
  text: string;
  isDeleted?: boolean;
  likes?: unknown[];
  replyCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

function serializeComment(comment: CommentLike, viewerId: string) {
  const likes = (comment.likes ?? []).map(String);
  const author =
    comment.author && typeof comment.author === "object" && "username" in (comment.author as object)
      ? publicUser(comment.author as never)
      : { _id: String(comment.author) };

  return {
    _id: String(comment._id),
    post: String(comment.post),
    parent: comment.parent ? String(comment.parent) : null,
    text: comment.isDeleted ? "[deleted]" : comment.text,
    isDeleted: comment.isDeleted,
    author,
    likeCount: likes.length,
    likedByMe: likes.includes(String(viewerId)),
    replyCount: comment.replyCount ?? 0,
    isMine: String((comment.author as { _id?: unknown })?._id ?? comment.author) === String(viewerId),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

/** Loads a post only if the viewer is allowed to see the author's entries. */
async function loadVisiblePost(postId: string, viewerId: string) {
  if (!Types.ObjectId.isValid(postId)) throw ApiError.badRequest("Invalid post id");

  const post = await ThoughtCard.findById(postId);
  if (!post || post.isSoftDelete) throw ApiError.notFound("Thought not found");

  if (!(await canViewPosts(viewerId, String(post.author)))) {
    throw ApiError.forbidden("This account is private. Follow them to join the conversation.");
  }

  return post;
}

const createSchema = z.object({
  text: z.string().trim().min(1, "Write something first").max(1000),
  parentId: z
    .string()
    .refine((id) => Types.ObjectId.isValid(id), "Invalid comment id")
    .optional(),
});

export async function createComment(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const post = await loadVisiblePost(req.params.postId, viewerId);
  const { text, parentId } = createSchema.parse(req.body);

  // Replies are one level deep — replying to a reply attaches to its parent.
  let parent: IComment | null = null;
  if (parentId) {
    parent = await Comment.findOne({ _id: parentId, post: post._id, isDeleted: false });
    if (!parent) throw ApiError.notFound("The comment you replied to no longer exists");
    if (parent.parent) parent = await Comment.findById(parent.parent);
  }

  const session = await mongoose.startSession();
  let created: IComment | null = null;
  try {
    await session.withTransaction(async () => {
      const [comment] = await Comment.create(
        [{ post: post._id, author: viewerId, parent: parent?._id ?? null, text }],
        { session }
      );
      created = comment;

      await ThoughtCard.updateOne(
        { _id: post._id },
        { $inc: { commentCount: 1 } },
        { session }
      );
      if (parent) {
        await Comment.updateOne(
          { _id: parent._id },
          { $inc: { replyCount: 1 } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const comment = created as unknown as IComment;
  await comment.populate("author", "username full_name userprofile_image bio isPrivate");

  // Notify the post author, and the parent comment author when it's a reply.
  const notifyTargets = new Set<string>();
  if (String(post.author) !== viewerId) notifyTargets.add(String(post.author));
  if (parent && String(parent.author) !== viewerId) notifyTargets.add(String(parent.author));

  const actor = await User.findById(viewerId)
    .select("username full_name userprofile_image isPrivate")
    .lean();

  for (const target of notifyTargets) {
    emitToUser(target, "post:commented", {
      postId: String(post._id),
      commentId: String(comment._id),
      by: actor ? publicUser(actor) : null,
      preview: text.slice(0, 120),
    });
  }

  res.status(201).json({
    success: true,
    message: "Comment added",
    comment: serializeComment(comment, viewerId),
    commentCount: (post.commentCount ?? 0) + 1,
  });
}

export async function listComments(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const post = await loadVisiblePost(req.params.postId, viewerId);
  const { limit, page, parentId } = paginationSchema.parse(req.query);

  const [comments, total] = await Promise.all([
    Comment.find({ post: post._id, parent: parentId ?? null })
      .populate("author", "username full_name userprofile_image bio isPrivate")
      .sort({ createdAt: parentId ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Comment.countDocuments({ post: post._id, parent: parentId ?? null }),
  ]);

  res.json({
    success: true,
    total,
    comments: comments.map((comment) => serializeComment(comment, viewerId)),
  });
}

const updateSchema = z.object({
  text: z.string().trim().min(1, "Write something first").max(1000),
});

export async function updateComment(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { text } = updateSchema.parse(req.body);

  const comment = await Comment.findOneAndUpdate(
    { _id: req.params.commentId, author: viewerId, isDeleted: false },
    { text },
    { new: true }
  ).populate("author", "username full_name userprofile_image bio isPrivate");

  if (!comment) throw ApiError.notFound("Comment not found");

  res.json({ success: true, comment: serializeComment(comment, viewerId) });
}

/**
 * The post's author can moderate any comment on their entry; everyone else can
 * only remove their own. Comments with replies are tombstoned rather than
 * removed so the thread underneath stays readable.
 */
export async function deleteComment(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { commentId } = req.params;

  if (!Types.ObjectId.isValid(commentId)) throw ApiError.badRequest("Invalid comment id");

  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) throw ApiError.notFound("Comment not found");

  const post = await ThoughtCard.findById(comment.post).select("author commentCount");
  if (!post) throw ApiError.notFound("Thought not found");

  const isOwner = String(comment.author) === viewerId;
  const isPostAuthor = String(post.author) === viewerId;
  if (!isOwner && !isPostAuthor) {
    throw ApiError.forbidden("You cannot remove this comment");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (comment.replyCount > 0) {
        await Comment.updateOne(
          { _id: comment._id },
          { isDeleted: true, text: "", likes: [] },
          { session }
        );
        await ThoughtCard.updateOne(
          { _id: post._id, commentCount: { $gt: 0 } },
          { $inc: { commentCount: -1 } },
          { session }
        );
        return;
      }

      await Comment.deleteOne({ _id: comment._id }, { session });
      await ThoughtCard.updateOne(
        { _id: post._id, commentCount: { $gt: 0 } },
        { $inc: { commentCount: -1 } },
        { session }
      );
      if (comment.parent) {
        await Comment.updateOne(
          { _id: comment.parent, replyCount: { $gt: 0 } },
          { $inc: { replyCount: -1 } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  res.json({ success: true, message: "Comment removed" });
}

export async function toggleCommentLike(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { commentId } = req.params;

  if (!Types.ObjectId.isValid(commentId)) throw ApiError.badRequest("Invalid comment id");

  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) throw ApiError.notFound("Comment not found");

  await loadVisiblePost(String(comment.post), viewerId);

  const alreadyLiked = comment.likes.some((id) => String(id) === viewerId);
  const updated = await Comment.findByIdAndUpdate(
    comment._id,
    alreadyLiked ? { $pull: { likes: viewerId } } : { $addToSet: { likes: viewerId } },
    { new: true }
  ).lean();

  res.json({
    success: true,
    liked: !alreadyLiked,
    likeCount: updated?.likes.length ?? 0,
  });
}
