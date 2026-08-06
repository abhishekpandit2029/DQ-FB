import { Router } from "express";
import * as posts from "../controllers/postController";
import * as comments from "../controllers/commentController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth);

// Feeds — declared before `/:postId` so they aren't captured as ids.
router.get("/feed", asyncHandler(posts.getFeed));
router.get("/explore", asyncHandler(posts.getExplore));
router.get("/mine", asyncHandler(posts.listMyPosts));
router.get("/user/:userId", asyncHandler(posts.listUserPosts));

router.post("/", asyncHandler(posts.createPost));
router.get("/:postId", asyncHandler(posts.getPost));
router.patch("/:postId", asyncHandler(posts.updatePost));
router.delete("/:postId", asyncHandler(posts.deletePost));

// Likes and sharing.
router.post("/:postId/like", asyncHandler(posts.toggleLike));
router.get("/:postId/likes", asyncHandler(posts.listLikes));
router.post("/:postId/share", asyncHandler(posts.sharePost));
router.post("/:postId/share-to", asyncHandler(posts.shareToFollowers));

// Comments.
router.get("/:postId/comments", asyncHandler(comments.listComments));
router.post("/:postId/comments", asyncHandler(comments.createComment));
router.patch("/comments/:commentId", asyncHandler(comments.updateComment));
router.delete("/comments/:commentId", asyncHandler(comments.deleteComment));
router.post("/comments/:commentId/like", asyncHandler(comments.toggleCommentLike));

export default router;
