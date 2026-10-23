const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Customer = require("../models/Customer");
const CustomerLoginOtp = require("../models/CustomerLoginOtp");
const config = require("../config");

const {
  requireCustomer,
  setCustomerCookie,
  clearCustomerCookie,
} = require("../middleware/customerAuth");

const {
  sendLoginOtpEmail,
} = require("../services/brevo");
const {
  validateName,
  validatePhone,
  validateShipping,
} = require("../deliveryValidate");

const router = express.Router();

/* =========================================================
 * Authentication rate limiter
 * ======================================================= */

const authAttempts = new Map();

const AUTH_WINDOW_MS =
  15 * 60 * 1000;

const AUTH_MAX_ATTEMPTS = 10;

function getClientIp(req) {
  return (
    req.ip ||
    req.headers[
      "x-forwarded-for"
    ]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function checkRateLimit(
  req,
  res,
  next
) {
  const ip =
    getClientIp(req);

  const now =
    Date.now();

  let record =
    authAttempts.get(ip);

  if (
    !record ||
    now - record.startedAt >
      AUTH_WINDOW_MS
  ) {
    record = {
      startedAt: now,
      count: 0,
    };
  }

  record.count += 1;

  authAttempts.set(
    ip,
    record
  );

  if (
    record.count >
    AUTH_MAX_ATTEMPTS
  ) {
    return res.status(429).json({
      error:
        "Too many authentication attempts. Please try again later.",
    });
  }

  next();
}

/* =========================================================
 * Validation
 * ======================================================= */

function isValidEmail(
  value
) {
  const email =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (!email) {
    return false;
  }

  if (email.length > 254) {
    return false;
  }

  const parts =
    email.split("@");

  if (parts.length !== 2) {
    return false;
  }

  const local =
    parts[0];

  const domain =
    parts[1];

  if (
    !local ||
    !domain
  ) {
    return false;
  }

  if (
    local.length > 64
  ) {
    return false;
  }

  if (
    email.includes("..")
  ) {
    return false;
  }

  if (
    local.startsWith(".") ||
    local.endsWith(".")
  ) {
    return false;
  }

  return /^[a-z0-9._%+\-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(
    email
  );
}

/* =========================================================
 * JWT
 * ======================================================= */

function signCustomerToken(
  customer
) {
  return jwt.sign(
    {
      sub: customer._id.toString(),

      type: "customer",

      email: customer.email,
    },

    config.jwtSecret,

    {
      expiresIn:
        config.jwtExpiresIn ||
        "7d",
    }
  );
}

/* =========================================================
 * Safe customer response
 * ======================================================= */

function publicCustomer(
  customer
) {
  if (!customer) {
    return null;
  }

  if (
    typeof customer.toSafeJSON ===
    "function"
  ) {
    return customer.toSafeJSON();
  }

  return {
    id:
      customer._id.toString(),

    email:
      customer.email,

    name:
      customer.name,

    phone:
      customer.phone || "",

    address:
      customer.address || {},

    isActive:
      customer.isActive !==
      false,

    createdAt:
      customer.createdAt,

    updatedAt:
      customer.updatedAt,

    lastLoginAt:
      customer.lastLoginAt,
  };
}

/* =========================================================
 * OTP helpers
 * ======================================================= */

function generateOtp() {
  return crypto
    .randomInt(
      100000,
      1000000
    )
    .toString();
}

function hashOtp(otp) {
  return crypto
    .createHmac(
      "sha256",
      config.jwtSecret
    )
    .update(
      String(otp)
    )
    .digest("hex");
}

function isValidOtp(
  value
) {
  return /^\d{6}$/.test(
    String(value || "")
  );
}

function safeCompareOtp(
  hashA,
  hashB
) {
  const a =
    Buffer.from(
      String(hashA),
      "hex"
    );

  const b =
    Buffer.from(
      String(hashB),
      "hex"
    );

  if (
    a.length !==
    b.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    a,
    b
  );
}

async function invalidateCustomerOtps(
  customerId
) {
  await CustomerLoginOtp.updateMany(
    {
      customerId,
      used: false,
    },
    {
      $set: {
        used: true,
      },
    }
  );
}

/* =========================================================
 * Issue a login code (shared by register and login)
 * ======================================================= */

async function issueLoginOtp(customer) {
  const recent = await CustomerLoginOtp.findOne({
    customerId: customer._id,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (
    recent &&
    Date.now() - new Date(recent.lastSentAt).getTime() < 60 * 1000
  ) {
    return {
      status: 200,
      body: {
        otpRequired: true,
        email: customer.email,
        message: "A verification code was already sent to your email.",
      },
    };
  }

  const otp = generateOtp();

  await invalidateCustomerOtps(customer._id);

  const doc = await CustomerLoginOtp.create({
    customerId: customer._id,
    email: customer.email,
    otpHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    lastSentAt: new Date(),
    used: false,
  });

  try {
    await sendLoginOtpEmail({
      email: customer.email,
      name: customer.name,
      otp,
    });
  } catch (mailError) {
    console.error("Login OTP email error:", mailError);

    await CustomerLoginOtp.deleteOne({ _id: doc._id });

    return {
      status: 502,
      body: {
        error: "We could not send the verification email. Please try again.",
      },
    };
  }

  return {
    status: 200,
    body: {
      otpRequired: true,
      email: customer.email,
      message: "A verification code has been sent to your email.",
    },
  };
}

/* =========================================================
 * REGISTER (no password: account is created, a code is emailed)
 * ======================================================= */

router.post(
  "/register",
  checkRateLimit,
  async (req, res) => {
    try {
      const name = String(req.body.name || "").trim().replace(/\s+/g, " ");
      const email = String(req.body.email || "").trim().toLowerCase();
      const phone = String(req.body.phone || "").trim();

      if (!name) {
        return res.status(400).json({ error: "Full name is required" });
      }

      if (name.length < 3 || name.length > 60) {
        return res.status(400).json({
          error: "Name must be between 3 and 60 characters",
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Enter a valid email address" });
      }

      const existing = await Customer.findOne({ email });

      if (existing) {
        return res.status(409).json({
          error: "An account with this email already exists",
        });
      }

      const customer = await Customer.create({
        name,
        email,
        phone,
        passwordHash: "",
      });

      const out = await issueLoginOtp(customer);

      return res
        .status(out.status === 200 ? 201 : out.status)
        .json(out.body);
    } catch (err) {
      console.error("Customer registration error:", err);

      return res.status(500).json({ error: "Could not create account" });
    }
  }
);

/* =========================================================
 * LOGIN - STEP 1 (no password: email a code)
 * ======================================================= */

router.post(
  "/login",
  checkRateLimit,
  async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Enter a valid email address" });
      }

      const customer = await Customer.findOne({ email });

      if (customer && customer.isActive === false) {
        return res.status(403).json({ error: "Your account is inactive." });
      }

      if (!customer) {
        // Same response as success, so nobody can probe which emails exist.
        return res.status(200).json({
          otpRequired: true,
          email,
          message: "If this email has an account, a code has been sent.",
        });
      }

      const out = await issueLoginOtp(customer);

      return res.status(out.status).json(out.body);
    } catch (err) {
      console.error("Customer login error:", err);

      return res.status(500).json({ error: "Login failed" });
    }
  }
);

/* =========================================================
 * LOGIN - STEP 2
 *
 * Verify OTP.
 *
 * Only after successful OTP verification
 * do we create the JWT.
 * ======================================================= */

router.post(
  "/login/verify-otp",
  checkRateLimit,
  async (req, res) => {
    try {

      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const otp =
        String(
          req.body.otp || ""
        ).trim();

      if (
        !isValidEmail(email)
      ) {
        return res.status(400).json({
          error:
            "Enter a valid email address",
        });
      }

      if (
        !isValidOtp(otp)
      ) {
        return res.status(400).json({
          error:
            "Enter the 6-digit verification code",
        });
      }

      const customer =
        await Customer.findOne({
          email,
        });

      if (
        !customer ||
        customer.isActive ===
          false
      ) {
        return res.status(401).json({
          error:
            "Invalid verification code",
        });
      }

      /*
       * Find the latest active OTP.
       */

      const otpDocument =
        await CustomerLoginOtp.findOne(
          {
            customerId:
              customer._id,

            email:
              customer.email,

            used: false,

            expiresAt: {
              $gt: new Date(),
            },
          }
        ).sort({
          createdAt: -1,
        });

      if (!otpDocument) {

        return res.status(401).json({
          error:
            "This verification code has expired. Please request a new code.",
        });
      }

      /*
       * Maximum 5 incorrect OTP attempts.
       */

      if (
        otpDocument.attempts >=
        5
      ) {

        otpDocument.used =
          true;

        await otpDocument.save();

        return res.status(429).json({
          error:
            "Too many incorrect verification attempts. Please request a new code.",
        });
      }

      const suppliedHash =
        hashOtp(otp);

      const matches =
        safeCompareOtp(
          suppliedHash,
          otpDocument.otpHash
        );

      if (!matches) {

        otpDocument.attempts +=
          1;

        if (
          otpDocument.attempts >=
          5
        ) {
          otpDocument.used =
            true;
        }

        await otpDocument.save();

        return res.status(401).json({
          error:
            "Incorrect verification code.",
        });
      }

      /*
       * OTP is correct.
       *
       * Mark it as used before creating
       * the authentication session.
       */

      otpDocument.used =
        true;

      await otpDocument.save();

      customer.lastLoginAt =
        new Date();

      await customer.save();

      /*
       * JWT is created ONLY here.
       */

      const token =
        signCustomerToken(
          customer
        );

      setCustomerCookie(
        res,
        token
      );

      return res.status(200).json({

        token,

        customer:
          publicCustomer(
            customer
          ),

      });

    } catch (err) {

      console.error(
        "Customer OTP verification error:",
        err
      );

      return res.status(500).json({
        error:
          "Could not verify the code. Please try again.",
      });
    }
  }
);

/* =========================================================
 * LOGIN - RESEND OTP
 * ======================================================= */

router.post(
  "/login/resend-otp",
  checkRateLimit,
  async (req, res) => {
    try {

      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      if (
        !isValidEmail(email)
      ) {
        return res.status(400).json({
          error:
            "Enter a valid email address",
        });
      }

      const customer =
        await Customer.findOne({
          email,
        });

      /*
       * Do not reveal whether the
       * email belongs to an account.
       */

      if (
        !customer ||
        customer.isActive ===
          false
      ) {

        return res.status(200).json({
          message:
            "If an account exists for this email, a new verification code will be sent.",
        });
      }

      /*
       * Enforce resend cooldown.
       */

      const previousOtp =
        await CustomerLoginOtp.findOne(
          {
            customerId:
              customer._id,

            used: false,

            expiresAt: {
              $gt: new Date(),
            },
          }
        ).sort({
          createdAt: -1,
        });

      if (previousOtp) {

        const elapsed =
          Date.now() -
          new Date(
            previousOtp.lastSentAt
          ).getTime();

        const cooldownMs =
          60 * 1000;

        if (
          elapsed <
          cooldownMs
        ) {

          const retryAfter =
            Math.ceil(
              (
                cooldownMs -
                elapsed
              ) / 1000
            );

          return res.status(429).json({

            error:
              "Please wait before requesting another code.",

            retryAfter,

          });
        }
      }

      /*
       * Generate new OTP.
       */

      const otp =
        generateOtp();

      const otpHashValue =
        hashOtp(otp);

      /*
       * Invalidate previous OTP.
       */

      await invalidateCustomerOtps(
        customer._id
      );

      /*
       * Create new OTP document.
       */

      const otpDocument =
        await CustomerLoginOtp.create({
          customerId:
            customer._id,

          email:
            customer.email,

          otpHash:
            otpHashValue,

          expiresAt:
            new Date(
              Date.now() +
                5 * 60 * 1000
            ),

          attempts:
            0,

          lastSentAt:
            new Date(),

          used:
            false,
        });

      /*
       * Send email.
       */

      try {

        await sendLoginOtpEmail({
          email:
            customer.email,

          name:
            customer.name,

          otp,
        });

      } catch (mailError) {

        console.error(
          "Resend login OTP email error:",
          mailError
        );

        await CustomerLoginOtp.deleteOne(
          {
            _id:
              otpDocument._id,
          }
        );

        return res.status(502).json({
          error:
            "We could not send the verification email. Please try again.",
        });
      }

      return res.status(200).json({

        message:
          "A new verification code has been sent to your email.",

      });

    } catch (err) {

      console.error(
        "Resend OTP error:",
        err
      );

      return res.status(500).json({
        error:
          "Could not resend the verification code.",
      });
    }
  }
);

/* =========================================================
 * LOGOUT
 * ======================================================= */

router.post(
  "/logout",
  async (_req, res) => {

    clearCustomerCookie(
      res
    );

    return res.status(200).json({
      ok: true,
    });
  }
);

/* =========================================================
 * CURRENT CUSTOMER
 * ======================================================= */

router.get(
  "/me",
  requireCustomer,
  async (req, res) => {

    return res.status(200).json({
      customer:
        publicCustomer(
          req.customer
        ),
    });
  }
);

/* =========================================================
 * UPDATE PROFILE
 * ======================================================= */

router.put(
  "/me",
  requireCustomer,
  async (req, res) => {
    try {

      const name =
        String(
          req.body.name || ""
        )
          .trim()
          .replace(
            /\s+/g,
            " "
          );

      const phone =
        String(
          req.body.phone || ""
        ).trim();

      const address =
        req.body.address &&
        typeof req.body.address ===
          "object"
          ? req.body.address
          : {};

      if (!name) {
        return res.status(400).json({
          error:
            "Full name is required",
        });
      }

      const nameCheck = validateName(name);
      if (nameCheck.error) {
        return res.status(400).json({ error: nameCheck.error });
      }

      let phoneValue = "";
      if (phone) {
        const phoneCheck = validatePhone(phone);
        if (phoneCheck.error) {
          return res.status(400).json({ error: phoneCheck.error });
        }
        phoneValue = phoneCheck.value;
      }

      const line1 = String(address.line1 || "").trim();
      const line2 = String(address.line2 || "").trim();
      const city = String(address.city || "").trim();
      const state = String(address.state || "").trim();
      const pincode = String(address.pincode || "").trim();
      const hasAddress = !!(line1 || line2 || city || state || pincode);

      let nextAddress = {
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
      };

      if (hasAddress) {
        const shipCheck = validateShipping({
          shippingAddress: {
            name: nameCheck.value,
            phone: phoneValue,
            line1,
            line2,
            city,
            state,
            pincode,
          },
        });
        if (shipCheck.error) {
          return res.status(400).json({
            error: shipCheck.error,
            fields: shipCheck.fields || {},
          });
        }
        nextAddress = {
          line1: shipCheck.value.line1,
          line2: shipCheck.value.line2,
          city: shipCheck.value.city,
          state: shipCheck.value.state,
          pincode: shipCheck.value.pincode,
        };
        if (!phoneValue) phoneValue = shipCheck.value.phone;
      }

      req.customer.name = nameCheck.value;
      req.customer.phone = phoneValue;
      req.customer.address = nextAddress;

      await req.customer.save();

      return res.status(200).json({
        customer:
          publicCustomer(
            req.customer
          ),
      });

    } catch (err) {

      console.error(
        "Customer profile update error:",
        err
      );

      return res.status(500).json({
        error:
          "Could not save profile",
      });
    }
  }
);

module.exports = router;