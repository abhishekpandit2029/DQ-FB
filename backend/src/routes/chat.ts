import { Router } from "express";
import * as chat from "../controllers/chatController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(chat.listChats));
router.post("/", asyncHandler(chat.createChat));
router.post("/messages", asyncHandler(chat.sendMessage));
router.get("/:chatId/messages", asyncHandler(chat.listMessages));
router.post("/:chatId/read", asyncHandler(chat.markRead));
router.delete("/:chatId", asyncHandler(chat.deleteChat));

export default router;
