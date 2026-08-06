import { Router } from "express";
import * as calls from "../controllers/callController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth);

router.get("/ice-servers", asyncHandler(calls.getIceServers));
router.get("/history", asyncHandler(calls.listCallHistory));
router.get("/permission/:userId", asyncHandler(calls.checkCallPermission));

export default router;
