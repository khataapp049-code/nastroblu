const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config");
const { connectDb } = require("./db");
const authRoutes = require("./routes/auth");
const customerAuthRoutes = require("./routes/customerAuth");
const orderRoutes = require("./routes/orders");
const productRoutes = require("./routes/products");
const uploadRoutes = require("./routes/uploads");

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

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "nastroblu-api", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", authRoutes); // alias: POST /api/admin/login
  app.use("/api/customer", customerAuthRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/uploads", uploadRoutes);

  const root = path.join(__dirname, "../..");
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
