import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./users";
import followRoutes from "./follow";
import postRoutes from "./posts";
import chatRoutes from "./chat";
import callRoutes from "./calls";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/follow", followRoutes);
router.use("/posts", postRoutes);
router.use("/chats", chatRoutes);
router.use("/calls", callRoutes);

export default router;
