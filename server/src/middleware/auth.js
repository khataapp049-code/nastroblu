const jwt = require("jsonwebtoken");
const config = require("../config");

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Login required" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // Reject customer tokens on admin routes
    if (payload.role && payload.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

/** Attaches req.admin when a valid token is present; never fails the request. */
function optionalAdmin(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role && payload.role !== "admin") {
      req.admin = null;
    } else {
      req.admin = payload;
    }
  } catch (_err) {
    req.admin = null;
  }
  next();
}

module.exports = { requireAdmin, optionalAdmin };
