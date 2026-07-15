const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const config = require("../config");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign(
      { id: admin._id.toString(), email: admin.email, name: admin.name },
      config.jwtSecret,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      admin: { email: admin.email, name: admin.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    res.json({ admin: { email: payload.email, name: payload.name } });
  } catch (err) {
    res.status(401).json({ error: "Invalid session" });
  }
});

module.exports = router;
