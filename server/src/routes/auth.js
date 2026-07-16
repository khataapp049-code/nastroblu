const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const config = require("../config");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

/** Simple in-memory rate limit: 8 attempts / 15 min per IP */
const loginAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function clientKey(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function checkLoginRate(req, res) {
  const key = clientKey(req);
  const now = Date.now();
  let entry = loginAttempts.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    loginAttempts.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return false;
  }
  return true;
}

router.post("/login", async (req, res) => {
  try {
    if (!checkLoginRate(req, res)) return;

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const admin = await Admin.findOne({ email });
    // Dummy bcrypt hash so missing users still pay compare cost
    const dummy =
      "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const ok = await bcrypt.compare(password, admin ? admin.passwordHash : dummy);
    if (!admin || !ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: "admin",
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );
    res.json({
      token,
      admin: { email: admin.email, name: admin.name },
    });
  } catch (err) {
    console.error("Login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", requireAdmin, async (req, res) => {
  res.json({ admin: { email: req.admin.email, name: req.admin.name } });
});

module.exports = router;
