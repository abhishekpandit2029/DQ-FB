import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { isProduction } from "../config/env";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: err.issues[0]?.message ?? "Invalid request payload",
      details: err.issues,
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  const error = err as { name?: string; code?: number; message?: string; keyValue?: Record<string, unknown> };

  // Duplicate key -> a unique index was violated (username/email/follow edge).
  if (error?.code === 11000) {
    const field = Object.keys(error.keyValue ?? {})[0] ?? "value";
    return res.status(409).json({ error: `That ${field} is already taken` });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({ error: error.message ?? "Validation failed" });
  }

  if (error?.name === "CastError") {
    return res.status(400).json({ error: "Invalid identifier" });
  }

  console.error("[error]", err);

  return res.status(500).json({
    error: isProduction
      ? "Something went wrong, please try again later"
      : error?.message ?? "Internal server error",
  });
}
