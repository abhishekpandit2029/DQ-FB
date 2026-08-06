import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { extractToken, TokenPayload, verifyToken } from "../utils/token";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(
    req.headers as unknown as Record<string, unknown>,
    req.cookies
  );

  if (!token) return next(ApiError.unauthorized("Authentication required"));

  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return next(ApiError.unauthorized("Session expired, please log in again"));
  }
}

/** Attaches `req.user` when a valid token is present but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(
    req.headers as unknown as Record<string, unknown>,
    req.cookies
  );
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      /* ignore - treated as anonymous */
    }
  }
  return next();
}

export function currentUserId(req: Request): string {
  if (!req.user?.id) throw ApiError.unauthorized("Authentication required");
  return req.user.id;
}
