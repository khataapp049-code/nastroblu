const express = require("express");
const bcrypt = require("bcryptjs");
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

function validatePassword(
  password
) {
  const value =
    String(
      password || ""
    );

  if (!value) {
    return "Password is required";
  }

  if (value.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (value.length > 64) {
    return "Password must be 64 characters or fewer";
  }

  if (/\s/.test(value)) {
    return "Password cannot contain spaces";
  }

  if (!/[a-z]/.test(value)) {
    return "Password must contain a lowercase letter";
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must contain an uppercase letter";
  }

  if (!/\d/.test(value)) {
    return "Password must contain a number";
  }

  if (
    !/[^A-Za-z0-9]/.test(
      value
    )
  ) {
    return "Password must contain a special character";
  }

  return null;
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
 * REGISTER
 * ======================================================= */

router.post(
  "/register",
  checkRateLimit,
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

      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const phone =
        String(
          req.body.phone || ""
        ).trim();

      const password =
        String(
          req.body.password || ""
        );

      if (!name) {
        return res.status(400).json({
          error:
            "Full name is required",
        });
      }

      if (
        name.length < 3 ||
        name.length > 60
      ) {
        return res.status(400).json({
          error:
            "Name must be between 3 and 60 characters",
        });
      }

      if (
        !isValidEmail(email)
      ) {
        return res.status(400).json({
          error:
            "Enter a valid email address",
        });
      }

      const passwordError =
        validatePassword(
          password
        );

      if (passwordError) {
        return res.status(400).json({
          error:
            passwordError,
        });
      }

      const existing =
        await Customer.findOne({
          email,
        });

      if (existing) {
        return res.status(409).json({
          error:
            "An account with this email already exists",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const customer =
        await Customer.create({
          name,

          email,

          phone,

          passwordHash,

          lastLoginAt:
            new Date(),
        });

      const token =
        signCustomerToken(
          customer
        );

      setCustomerCookie(
        res,
        token
      );

      return res.status(201).json({
        token,

        customer:
          publicCustomer(
            customer
          ),
      });

    } catch (err) {

      console.error(
        "Customer registration error:",
        err
      );

      return res.status(500).json({
        error:
          "Could not create account",
      });
    }
  }
);

/* =========================================================
 * LOGIN - STEP 1
 *
 * Email + password are checked.
 *
 * JWT is NOT returned here.
 *
 * If credentials are correct:
 * generate OTP -> store hash -> send email.
 * ======================================================= */

router.post(
  "/login",
  checkRateLimit,
  async (req, res) => {
    try {

      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ""
        );

      if (
        !isValidEmail(email)
      ) {
        return res.status(400).json({
          error:
            "Enter a valid email address",
        });
      }

      if (!password) {
        return res.status(400).json({
          error:
            "Password is required",
        });
      }

      const customer =
        await Customer.findOne({
          email,
        });

      /*
       * Always perform a bcrypt comparison,
       * even when the email does not exist.
       *
       * This avoids making account existence
       * easier to detect from timing.
       */

      const dummyHash =
        "$2a$12$" +
        "LQv3c1yqBW0u5G6H4Q7Y8." +
        "K8V6j9pJ5q7w2mN4xY1Za";

      const passwordHash =
        customer
          ? customer.passwordHash
          : dummyHash;

      let passwordMatches =
        false;

      try {

        passwordMatches =
          await bcrypt.compare(
            password,
            passwordHash
          );

      } catch (bcryptError) {

        console.error(
          "Password comparison error:",
          bcryptError
        );

        passwordMatches =
          false;
      }

      if (
        !customer ||
        !passwordMatches
      ) {

        return res.status(401).json({
          error:
            "Incorrect email or password.",
        });
      }

      if (
        customer.isActive ===
        false
      ) {

        return res.status(403).json({
          error:
            "Your account is inactive.",
        });
      }

      /*
       * Check whether an active OTP was
       * already sent recently.
       */

      const existingOtp =
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

      if (existingOtp) {

        const elapsed =
          Date.now() -
          new Date(
            existingOtp.lastSentAt
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

          return res.status(200).json({
            otpRequired:
              true,

            email:
              customer.email,

            retryAfter,

            message:
              "A verification code was already sent to your email.",
          });
        }
      }

      /*
       * Generate a cryptographically secure
       * 6-digit OTP.
       */

      const otp =
        generateOtp();

      /*
       * Never store the plaintext OTP.
       */

      const otpHashValue =
        hashOtp(otp);

      /*
       * Invalidate any previous OTPs.
       */

      await invalidateCustomerOtps(
        customer._id
      );

      /*
       * OTP expires in 5 minutes.
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
       * Send OTP through Brevo.
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
          "Login OTP email error:",
          mailError
        );

        /*
         * Do not leave an unusable OTP
         * in the database if email failed.
         */

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

        otpRequired:
          true,

        email:
          customer.email,

        message:
          "A verification code has been sent to your email.",

      });

    } catch (err) {

      console.error(
        "Customer login error:",
        err
      );

      return res.status(500).json({
        error:
          "Login failed",
      });
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

      if (
        name.length < 3 ||
        name.length > 60
      ) {
        return res.status(400).json({
          error:
            "Name must be between 3 and 60 characters",
        });
      }

      req.customer.name =
        name;

      req.customer.phone =
        phone;

      req.customer.address = {
        line1:
          String(
            address.line1 || ""
          ).trim(),

        line2:
          String(
            address.line2 || ""
          ).trim(),

        city:
          String(
            address.city || ""
          ).trim(),

        state:
          String(
            address.state || ""
          ).trim(),

        pincode:
          String(
            address.pincode || ""
          ).trim(),
      };

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

/* =========================================================
 * CHANGE PASSWORD
 * ======================================================= */

router.put(
  "/password",
  requireCustomer,
  async (req, res) => {
    try {

      const currentPassword =
        String(
          req.body.currentPassword ||
            ""
        );

      const newPassword =
        String(
          req.body.newPassword ||
            ""
        );

      if (!currentPassword) {
        return res.status(400).json({
          error:
            "Current password is required",
        });
      }

      const passwordError =
        validatePassword(
          newPassword
        );

      if (passwordError) {
        return res.status(400).json({
          error:
            passwordError,
        });
      }

      if (
        currentPassword ===
        newPassword
      ) {
        return res.status(400).json({
          error:
            "New password must be different from your current password",
        });
      }

      const matches =
        await bcrypt.compare(
          currentPassword,
          req.customer
            .passwordHash
        );

      if (!matches) {
        return res.status(401).json({
          error:
            "Current password is incorrect",
        });
      }

      req.customer.passwordHash =
        await bcrypt.hash(
          newPassword,
          12
        );

      await req.customer.save();

      /*
       * Any outstanding login OTP becomes
       * invalid after a password change.
       */

      await invalidateCustomerOtps(
        req.customer._id
      );

      const token =
        signCustomerToken(
          req.customer
        );

      setCustomerCookie(
        res,
        token
      );

      return res.status(200).json({

        token,

        customer:
          publicCustomer(
            req.customer
          ),

      });

    } catch (err) {

      console.error(
        "Customer password update error:",
        err
      );

      return res.status(500).json({
        error:
          "Could not update password",
      });
    }
  }
);

module.exports = router;