import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as auth from "../controllers/authController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Email delivery and credential checks are the abuse-prone endpoints here.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many codes requested. Please wait a few minutes." },
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes." },
});

router.post("/send-otp", otpLimiter, asyncHandler(auth.sendOtp));
router.post("/verify-otp", authLimiter, asyncHandler(auth.verifyOtp));
router.post("/signup", authLimiter, asyncHandler(auth.signup));
router.post("/login", authLimiter, asyncHandler(auth.login));
router.post("/login-otp", authLimiter, asyncHandler(auth.loginWithOtp));
router.post("/update-password", authLimiter, asyncHandler(auth.updatePassword));
router.post("/logout", asyncHandler(auth.logout));

export default router;
