const jwt = require("jsonwebtoken");
const config = require("../config");

const COOKIE_NAME = "nb_customer";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = val;
  });
  return out;
}

function readCustomerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] || null;
}

function verifyCustomerToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (!payload || payload.role !== "customer" || !payload.id) {
    const err = new Error("Invalid customer session");
    err.code = "INVALID_ROLE";
    throw err;
  }
  return payload;
}

function setCustomerCookie(res, token) {
  const isProd = config.nodeEnv === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (isProd) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function clearCustomerCookie(res) {
  const isProd = config.nodeEnv === "production";
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProd) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function requireCustomer(req, res, next) {
  const token = readCustomerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Login required" });
  }
  try {
    req.customer = verifyCustomerToken(token);
    next();
  } catch (_err) {
    clearCustomerCookie(res);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function optionalCustomer(req, _res, next) {
  const token = readCustomerToken(req);
  if (!token) return next();
  try {
    req.customer = verifyCustomerToken(token);
  } catch (_err) {
    req.customer = null;
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  requireCustomer,
  optionalCustomer,
  setCustomerCookie,
  clearCustomerCookie,
  readCustomerToken,
};
