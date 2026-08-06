import { Router } from "express";
import * as follow from "../controllers/followController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth);

// Requests awaiting action.
router.get("/requests/incoming", asyncHandler(follow.listIncomingRequests));
router.get("/requests/outgoing", asyncHandler(follow.listOutgoingRequests));

// Acting on a follow edge.
router.post("/request", asyncHandler(follow.sendFollowRequest));
router.post("/cancel", asyncHandler(follow.cancelFollowRequest));
router.post("/accept", asyncHandler(follow.acceptFollowRequest));
router.post("/reject", asyncHandler(follow.rejectFollowRequest));
router.post("/unfollow", asyncHandler(follow.unfollow));
router.post("/remove-follower", asyncHandler(follow.removeFollower));

// Listings.
router.get("/followers", asyncHandler(follow.listFollowers));
router.get("/following", asyncHandler(follow.listFollowing));
router.get("/followers/:userId", asyncHandler(follow.listFollowers));
router.get("/following/:userId", asyncHandler(follow.listFollowing));
router.get("/relationship/:userId", asyncHandler(follow.relationshipWith));

export default router;
