const jwt = require("jsonwebtoken");
const config = require("../config");
const Customer = require("../models/Customer");

const COOKIE_NAME = "nb_customer";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};

  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");

    if (idx === -1) return;

    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(
      part.slice(idx + 1).trim()
    );

    if (key) {
      out[key] = val;
    }
  });

  return out;
}

function readCustomerToken(req) {
  const header = req.headers.authorization || "";

  if (header.startsWith("Bearer ")) {
    return header.slice(7);
  }

  const cookies = parseCookies(req);

  return cookies[COOKIE_NAME] || null;
}

function verifyCustomerToken(token) {
  const payload = jwt.verify(
    token,
    config.jwtSecret
  );

  /*
   * Current customer JWT format:
   *
   * {
   *   sub: customer._id,
   *   type: "customer",
   *   email: customer.email
   * }
   *
   * Also accept the older id/role format so existing
   * tokens do not break unexpectedly.
   */

  const customerId =
    payload?.sub || payload?.id;

  const customerType =
    payload?.type || payload?.role;

  if (
    !payload ||
    customerType !== "customer" ||
    !customerId
  ) {
    const err = new Error(
      "Invalid customer session"
    );

    err.code = "INVALID_ROLE";

    throw err;
  }

  return payload;
}

async function loadCustomerFromToken(token) {
  const payload = verifyCustomerToken(token);

  const customerId =
    payload.sub || payload.id;

  const customer = await Customer.findById(
    customerId
  );

  if (!customer) {
    const err = new Error(
      "Customer account not found"
    );

    err.code = "CUSTOMER_NOT_FOUND";

    throw err;
  }

  if (customer.isActive === false) {
    const err = new Error(
      "Customer account is inactive"
    );

    err.code = "CUSTOMER_INACTIVE";

    throw err;
  }

  return customer;
}

function setCustomerCookie(res, token) {
  const isProd =
    config.nodeEnv === "production";

  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];

  if (isProd) {
    parts.push("Secure");
  }

  res.append(
    "Set-Cookie",
    parts.join("; ")
  );
}

function clearCustomerCookie(res) {
  const isProd =
    config.nodeEnv === "production";

  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (isProd) {
    parts.push("Secure");
  }

  res.append(
    "Set-Cookie",
    parts.join("; ")
  );
}

async function requireCustomer(req, res, next) {
  const token = readCustomerToken(req);

  if (!token) {
    return res.status(401).json({
      error: "Login required",
    });
  }

  try {
    /*
     * Verify JWT and then load the actual
     * MongoDB Customer document.
     */
    req.customer =
      await loadCustomerFromToken(token);

    return next();
  } catch (err) {
    console.error(
      "Customer authentication error:",
      err
    );

    clearCustomerCookie(res);

    return res.status(401).json({
      error: "Invalid or expired session",
    });
  }
}

async function optionalCustomer(
  req,
  _res,
  next
) {
  const token = readCustomerToken(req);

  if (!token) {
    req.customer = null;
    return next();
  }

  try {
    /*
     * Same as requireCustomer, but optional.
     * If the session is invalid, continue as
     * an unauthenticated visitor.
     */
    req.customer =
      await loadCustomerFromToken(token);
  } catch (_err) {
    req.customer = null;
  }

  return next();
}

module.exports = {
  COOKIE_NAME,
  requireCustomer,
  optionalCustomer,
  setCustomerCookie,
  clearCustomerCookie,
  readCustomerToken,
};