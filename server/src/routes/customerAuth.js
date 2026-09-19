const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");
const config = require("../config");
const {
  requireCustomer,
  setCustomerCookie,
  clearCustomerCookie,
} = require("../middleware/customerAuth");

const router = express.Router();

/** Rate limit: 10 auth attempts / 15 min per IP */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function clientKey(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function checkRate(req, res) {
  const key = "cust:" + clientKey(req);
  const now = Date.now();
  let entry = attempts.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    attempts.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return false;
  }
  return true;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include letters and numbers";
  }
  return null;
}

function signCustomerToken(customer) {
  return jwt.sign(
    {
      id: customer._id.toString(),
      email: customer.email,
      name: customer.name,
      role: "customer",
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function publicCustomer(customer) {
  return customer.toSafeJSON ? customer.toSafeJSON() : customer;
}

router.post("/register", async (req, res) => {
  try {
    if (!checkRate(req, res)) return;

    const { cleanName, cleanText } = require("../sanitize");
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const name = cleanName(req.body.name || "");
    const phone = cleanText(req.body.phone || "", 20).replace(/[^\d+\s()-]/g, "");

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Please enter your full name" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email" });
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ error: pwdErr });

    const existing = await Customer.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const customer = await Customer.create({
      email,
      passwordHash,
      name,
      phone,
      lastLoginAt: new Date(),
    });

    const token = signCustomerToken(customer);
    setCustomerCookie(res, token);
    res.status(201).json({
      token,
      customer: publicCustomer(customer),
    });
  } catch (err) {
    console.error("Customer register error", err.message);
    res.status(500).json({ error: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    if (!checkRate(req, res)) return;

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const customer = await Customer.findOne({ email });
    // Valid bcrypt dummy so missing users still pay compare cost
    const dummy =
      "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const ok = await bcrypt.compare(password, customer ? customer.passwordHash : dummy);
    if (!customer || !ok || customer.isActive === false) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    customer.lastLoginAt = new Date();
    await customer.save();

    const token = signCustomerToken(customer);
    setCustomerCookie(res, token);
    res.json({
      token,
      customer: publicCustomer(customer),
    });
  } catch (err) {
    console.error("Customer login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  clearCustomerCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer || customer.isActive === false) {
      clearCustomerCookie(res);
      return res.status(401).json({ error: "Account not found" });
    }
    res.json({ customer: publicCustomer(customer) });
  } catch (err) {
    res.status(500).json({ error: "Could not load account" });
  }
});

router.put("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer || customer.isActive === false) {
      return res.status(401).json({ error: "Account not found" });
    }

    const { cleanName, cleanText } = require("../sanitize");
    if (req.body.name != null) {
      const name = cleanName(req.body.name || "");
      if (name.length < 2) {
        return res.status(400).json({ error: "Please enter your full name" });
      }
      customer.name = name;
    }
    if (req.body.phone != null) {
      customer.phone = cleanText(req.body.phone || "", 20).replace(/[^\d+\s()-]/g, "");
    }
    if (req.body.address && typeof req.body.address === "object") {
      const a = req.body.address;
      customer.address = {
        line1: cleanText(a.line1 || "", 120),
        line2: cleanText(a.line2 || "", 120),
        city: cleanText(a.city || "", 80),
        state: cleanText(a.state || "", 80),
        pincode: cleanText(a.pincode || "", 12).replace(/[^\d]/g, ""),
      };
    }

    await customer.save();
    res.json({ customer: publicCustomer(customer) });
  } catch (err) {
    console.error("Customer profile update error");
    res.status(500).json({ error: "Could not update profile" });
  }
});

router.put("/password", requireCustomer, async (req, res) => {
  try {
    if (!checkRate(req, res)) return;

    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) return res.status(400).json({ error: pwdErr });

    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(401).json({ error: "Account not found" });

    const ok = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    customer.passwordHash = await bcrypt.hash(newPassword, 12);
    await customer.save();

    const token = signCustomerToken(customer);
    setCustomerCookie(res, token);
    res.json({ ok: true, token });
  } catch (err) {
    res.status(500).json({ error: "Could not update password" });
  }
});

module.exports = router;
