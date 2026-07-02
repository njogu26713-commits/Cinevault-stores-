import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface UserTokenPayload {
  userId: string;
  username: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

export function getUserSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("No JWT secret configured for user auth");
  return `usr_${s}`;
}

export const USER_COOKIE = "user_token";
export const USER_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, getUserSecret()) as UserTokenPayload;
    next();
  } catch {
    res.clearCookie(USER_COOKIE);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function optionalUserAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[USER_COOKIE];
  if (token) {
    try {
      req.user = jwt.verify(token, getUserSecret()) as UserTokenPayload;
    } catch {}
  }
  next();
}
