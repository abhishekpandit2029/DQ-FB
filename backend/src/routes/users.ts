import { Router } from "express";
import * as users from "../controllers/userController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth);

router.get("/me", asyncHandler(users.getMe));
router.patch("/me", asyncHandler(users.updateMe));
router.patch("/me/privacy", asyncHandler(users.updatePrivacy));
router.patch("/me/interaction", asyncHandler(users.updateInteractionSettings));
router.patch("/me/avatar", asyncHandler(users.updateAvatar));
router.patch("/me/password", asyncHandler(users.changePassword));

router.get("/", asyncHandler(users.listUsers));
router.get("/:identifier", asyncHandler(users.getProfile));

export default router;
