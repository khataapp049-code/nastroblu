require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nastroblu",
  jwtSecret: process.env.JWT_SECRET || "change-this-nastroblu-jwt-secret",
  adminEmail: (process.env.ADMIN_EMAIL || "admin@nastroblu.in").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "NastroBlu@Admin2026",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  nodeEnv: process.env.NODE_ENV || "development",
};
