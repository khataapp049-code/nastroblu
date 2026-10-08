const mongoose = require("mongoose");

const customerLoginOtpSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    lastSentAt: {
      type: Date,
      default: Date.now,
    },

    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// MongoDB automatically removes expired OTP documents.
customerLoginOtpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
  "CustomerLoginOtp",
  customerLoginOtpSchema
);