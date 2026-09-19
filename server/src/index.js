const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config");
const { connectDb } = require("./db");
const authRoutes = require("./routes/auth");
const customerAuthRoutes = require("./routes/customerAuth");
const customersAdminRoutes = require("./routes/customersAdmin");
const orderRoutes = require("./routes/orders");
const specialRoutes = require("./routes/special");
const reviewRoutes = require("./routes/reviews");
const googleReviewRoutes = require("./routes/googleReviews");
const wishlistRoutes = require("./routes/wishlist");
const productRoutes = require("./routes/products");
const uploadRoutes = require("./routes/uploads");
const Product = require("./models/Product");
const { mountSeoRoutes } = require("./seo");

async function start() {
  await connectDb();

  const app = express();
  app.set("trust proxy", 1);
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.disable("x-powered-by");

  // Security headers (also set in nginx when TLS terminates there)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    // Allow self + Google Fonts + WhatsApp images; block inline script eval
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "form-action 'self' https://wa.me https://api.whatsapp.com",
      ].join("; ")
    );
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "nastroblu-api", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", authRoutes); // alias: POST /api/admin/login
  app.use("/api/customer", customerAuthRoutes);
  app.use("/api/customer", customersAdminRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/special", specialRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/google-reviews", googleReviewRoutes);
  app.use("/api/wishlist", wishlistRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/uploads", uploadRoutes);

  // One-time hygiene: clear placeholder catalog ratings (no fake stars)
  try {
    const fake = await Product.updateMany(
      { reviews: { $lte: 0 }, rating: { $gt: 0 } },
      { $set: { rating: 0 } }
    );
    if (fake.modifiedCount) {
      console.log(`Cleared default ratings on ${fake.modifiedCount} products`);
    }
  } catch (err) {
    console.warn("Could not clear default ratings", err.message);
  }

  const root = path.join(__dirname, "../..");

  // robots.txt, sitemap.xml, SEO product HTML, block sensitive static files
  mountSeoRoutes(app);

  // Never cache admin HTML/JS so login UI updates show immediately
  app.use("/admin", (req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    next();
  });
  app.use(
    "/admin",
    express.static(path.join(root, "admin"), {
      etag: false,
      lastModified: false,
      maxAge: 0,
    })
  );
  app.use(express.static(root));

  app.get(["/admin", "/admin/"], (_req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.sendFile(path.join(root, "admin", "index.html"));
  });
  app.get("/admin/*", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(root, "admin", "index.html"));
  });

  app.get(["/account", "/account.html"], (_req, res) => {
    res.sendFile(path.join(root, "account.html"));
  });

  app.listen(config.port, () => {
    console.log(`Nastro Blu API listening on :${config.port}`);
    console.log(`Storefront: http://localhost:${config.port}/`);
    console.log(`Account:    http://localhost:${config.port}/account.html`);
    console.log(`Admin:      http://localhost:${config.port}/admin/`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
