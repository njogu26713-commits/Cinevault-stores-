import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

const router = Router();

function getSecret(): string {
  const s = process.env["ADMIN_JWT_SECRET"];
  if (!s) throw new Error("ADMIN_JWT_SECRET not set");
  return s;
}

// ── POST /admin/auth/login ────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  const adminEmail = process.env["ADMIN_EMAIL"] || "admin";
  const adminHash = process.env["ADMIN_PASSWORD_HASH"];

  if (!adminHash) {
    return res.status(503).json({ error: "Admin credentials not configured" });
  }

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const emailMatch = email.toLowerCase().trim() === adminEmail.toLowerCase().trim();
  const passMatch = await bcrypt.compare(password, adminHash);

  if (!emailMatch || !passMatch) {
    logger.warn({ email }, "Failed admin login attempt");
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { email: adminEmail, role: "admin" },
    getSecret(),
    { expiresIn: "7d" }
  );

  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  logger.info({ email: adminEmail }, "Admin login successful");
  return res.json({ ok: true, email: adminEmail });
});

// ── POST /admin/auth/logout ───────────────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.clearCookie("admin_token", { path: "/" });
  return res.json({ ok: true });
});

// ── GET /admin/auth/me ────────────────────────────────────────────────────────
router.get("/me", (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const payload = jwt.verify(token, getSecret()) as { email: string };
    return res.json({ ok: true, email: payload.email });
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
});

export default router;
