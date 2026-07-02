import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { getUserSecret, USER_COOKIE, USER_COOKIE_OPTS } from "../middleware/userAuth";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/user/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email and password are required" });
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: "Username must be 3–20 characters (letters, numbers, underscore)" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const existing = await User.findOne({ $or: [{ email: String(email).toLowerCase() }, { username }] });
    if (existing) {
      const field = existing.email === String(email).toLowerCase() ? "Email" : "Username";
      return res.status(409).json({ error: `${field} already taken` });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ username, email: String(email).toLowerCase(), passwordHash });
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, email: user.email },
      getUserSecret(),
      { expiresIn: "7d" }
    );
    res.cookie(USER_COOKIE, token, USER_COOKIE_OPTS);
    return res.status(201).json({ id: user._id, username: user.username, email: user.email });
  } catch (err: any) {
    logger.error({ err }, "Register error");
    return res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/user/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, email: user.email },
      getUserSecret(),
      { expiresIn: "7d" }
    );
    res.cookie(USER_COOKIE, token, USER_COOKIE_OPTS);
    return res.json({ id: user._id, username: user.username, email: user.email });
  } catch (err: any) {
    logger.error({ err }, "Login error");
    return res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/user/auth/me
router.get("/me", (req, res) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = jwt.verify(token, getUserSecret()) as any;
    return res.json({ id: payload.userId, username: payload.username, email: payload.email });
  } catch {
    res.clearCookie(USER_COOKIE);
    return res.status(401).json({ error: "Invalid session" });
  }
});

// POST /api/user/auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie(USER_COOKIE);
  return res.json({ success: true });
});

export default router;
