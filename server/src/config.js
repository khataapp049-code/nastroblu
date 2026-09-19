require("dotenv").config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

const jwtSecret = process.env.JWT_SECRET || "";
const adminPassword = process.env.ADMIN_PASSWORD || "";

if (isProd) {
  const weakJwtDefaults = new Set([
    "",
    "change-me",
    "change-this",
    "dev-only-insecure-jwt-secret-do-not-use-in-prod",
  ]);
  if (!jwtSecret || jwtSecret.length < 32 || weakJwtDefaults.has(jwtSecret)) {
    console.error("FATAL: Set a strong JWT_SECRET (32+ chars) in .env for production.");
    process.exit(1);
  }
  if (!adminPassword || adminPassword.length < 12) {
    console.error("FATAL: Set a strong ADMIN_PASSWORD (12+ chars) in .env for production.");
    process.exit(1);
  }
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nastroblu",
  jwtSecret: jwtSecret || "dev-only-insecure-jwt-secret-do-not-use-in-prod",
  adminEmail: (process.env.ADMIN_EMAIL || "admin@nastroblu.in").toLowerCase(),
  adminPassword: adminPassword || "dev-only-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  nodeEnv,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  googlePlaceId: process.env.GOOGLE_PLACE_ID || "",
  googleMapsUrl:
    process.env.GOOGLE_MAPS_URL || "https://www.google.com/maps?cid=11786458721880673435",
  googleReviewsUrl:
    process.env.GOOGLE_REVIEWS_URL ||
    "https://www.google.com/search?q=nastroblu#lrd=0x3bcb99306e7dd8f1:0xa39753ba4fbbbc9b,1,,,,",
  googleWriteReviewUrl:
    process.env.GOOGLE_WRITE_REVIEW_URL ||
    "https://www.google.com/search?q=nastroblu#lrd=0x3bcb99306e7dd8f1:0xa39753ba4fbbbc9b,3,,,,",
};
