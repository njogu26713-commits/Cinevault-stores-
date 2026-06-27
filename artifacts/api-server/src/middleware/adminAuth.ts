import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  // Allow auth routes through without a token
  if (req.path.startsWith("/auth/")) return next();

  const token = req.cookies?.admin_token;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const secret = process.env["ADMIN_JWT_SECRET"];
  if (!secret) {
    return res.status(503).json({ error: "Server misconfiguration" });
  }

  try {
    jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
