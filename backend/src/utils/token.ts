import jwt, { SignOptions } from "jsonwebtoken";
import { env, isProduction } from "../config/env";

export interface TokenPayload {
  id: string;
  username: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.tokenSecret, {
    expiresIn: env.tokenExpiry,
  } as SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.tokenSecret) as TokenPayload;
}

export const AUTH_COOKIE = "token";

export const authCookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  secure: isProduction,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
};

/** Pulls a bearer token out of the Authorization header or the auth cookie. */
export function extractToken(
  headers: Record<string, unknown>,
  cookies?: Record<string, string>
): string | null {
  const raw = headers["authorization"] ?? headers["Authorization"];
  const header = typeof raw === "string" ? raw : null;
  if (header?.startsWith("Bearer ")) {
    const value = header.slice(7).trim();
    if (value) return value;
  }
  return cookies?.[AUTH_COOKIE] || null;
}
