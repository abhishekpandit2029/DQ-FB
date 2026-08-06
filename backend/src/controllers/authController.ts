import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { z } from "zod";
import Otp from "../models/Otp";
import User from "../models/User";
import { sendOtpEmail } from "../services/mailer";
import { ApiError } from "../utils/ApiError";
import { AUTH_COOKIE, authCookieOptions, signToken } from "../utils/token";
import { publicUser } from "../utils/serialize";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtp() {
  // crypto.randomInt avoids the modulo bias of Math.random based codes.
  return String(crypto.randomInt(100000, 1000000));
}

function issueSession(res: Response, user: { _id: unknown; username: string; email: string }) {
  const token = signToken({
    id: String(user._id),
    username: user.username,
    email: user.email,
  });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  return token;
}

/* -------------------------------------------------------------------------- */
/*                                     OTP                                    */
/* -------------------------------------------------------------------------- */

const sendOtpSchema = z.object({
  email: emailSchema,
  // "signup" requires the email to be free; the others require it to exist.
  purpose: z.enum(["signup", "login", "forgot-password", "reset-password"]),
  currentPassword: z.string().optional(),
});

export async function sendOtp(req: Request, res: Response) {
  const { email, purpose, currentPassword } = sendOtpSchema.parse(req.body);

  const existingUser = await User.findOne({ email }).select("+password username");

  if (purpose === "signup" && existingUser) {
    throw ApiError.conflict("Email is already in use. Please use another.");
  }

  if (purpose !== "signup" && !existingUser) {
    throw ApiError.notFound("No account found with this email.");
  }

  // Changing a known password requires proving you know the current one.
  if (purpose === "reset-password") {
    if (!currentPassword) throw ApiError.badRequest("Current password is required.");
    const valid = await bcrypt.compare(currentPassword, existingUser!.password);
    if (!valid) throw ApiError.unauthorized("Current password is incorrect.");
  }

  const otp = generateOtp();

  await Otp.deleteMany({ email });
  await Otp.create({
    email,
    otp: hashOtp(otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendOtpEmail(
    email,
    otp,
    purpose === "signup" ? "Let's sign you up" : "Let's verify it's you"
  );

  res.json({ message: "OTP sent successfully", name: existingUser?.username ?? "" });
}

const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6, "Enter the 6 digit code"),
});

/** Shared OTP check. Consumes the record only when the code matches. */
async function consumeOtp(email: string, otp: string) {
  const record = await Otp.findOne({ email });
  if (!record) throw ApiError.badRequest("OTP not found. Please request a new one.");

  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    throw ApiError.badRequest("OTP has expired. Please request a new one.");
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    throw ApiError.badRequest("Too many incorrect attempts. Please request a new code.");
  }

  if (record.otp !== hashOtp(otp)) {
    await Otp.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw ApiError.badRequest("Invalid OTP");
  }

  await Otp.deleteOne({ _id: record._id });
}

export async function verifyOtp(req: Request, res: Response) {
  const { email, otp } = verifyOtpSchema.parse(req.body);
  await consumeOtp(email, otp);
  res.json({ message: "Email verified successfully", success: true });
}

/* -------------------------------------------------------------------------- */
/*                              Signup / login                                */
/* -------------------------------------------------------------------------- */

const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username is too long")
    .regex(/^[a-z0-9._]+$/, "Use letters, numbers, dots and underscores only"),
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().max(80).optional(),
});

export async function signup(req: Request, res: Response) {
  const { username, email, password, full_name } = signupSchema.parse(req.body);

  const clash = await User.findOne({ $or: [{ email }, { username }] }).lean();
  if (clash) {
    throw ApiError.conflict(
      clash.email === email ? "Email is already in use" : "Username is already taken"
    );
  }

  const user = await User.create({
    username,
    email,
    password: await bcrypt.hash(password, 12),
    full_name: full_name || username,
    isVerfied: true,
  });

  const token = issueSession(res, user);

  res.status(201).json({
    message: "User created successfully",
    success: true,
    token,
    user: publicUser(user),
  });
}

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email }).select("+password");
  // Same message for both branches so the endpoint can't be used to probe
  // which email addresses have accounts.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = issueSession(res, user);

  res.json({
    message: "Login successful",
    success: true,
    token,
    userId: String(user._id),
    user: publicUser(user),
  });
}

const otpLoginSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6, "Enter the 6 digit code"),
});

/** Passwordless login: verifying the emailed code is enough to get a session. */
export async function loginWithOtp(req: Request, res: Response) {
  const { email, otp } = otpLoginSchema.parse(req.body);

  const user = await User.findOne({ email });
  if (!user) throw ApiError.notFound("No account found with this email.");

  await consumeOtp(email, otp);

  const token = issueSession(res, user);

  res.json({
    message: "Login successful",
    success: true,
    token,
    userId: String(user._id),
    user: publicUser(user),
  });
}

const updatePasswordSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6, "Enter the 6 digit code"),
  new_password: passwordSchema,
});

/**
 * Completes forgot/reset password. The OTP is verified here rather than in a
 * prior step so a verified-but-unused code can't be replayed by someone else.
 */
export async function updatePassword(req: Request, res: Response) {
  const { email, otp, new_password } = updatePasswordSchema.parse(req.body);

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw ApiError.notFound("No account found with this email.");

  await consumeOtp(email, otp);

  user.password = await bcrypt.hash(new_password, 12);
  await user.save();

  res.json({ message: "Password updated successfully", success: true });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, { ...authCookieOptions, maxAge: undefined });
  res.json({ message: "Logged out", success: true });
}
