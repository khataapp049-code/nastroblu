const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config");
const { connectDb } = require("./db");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");

async function start() {
  await connectDb();

  const app = express();
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "nastroblu-api", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);

  const root = path.join(__dirname, "../..");
  app.use("/admin", express.static(path.join(root, "admin")));
  app.use(express.static(root));

  app.get("/admin/*", (_req, res) => {
    res.sendFile(path.join(root, "admin", "index.html"));
  });

  app.listen(config.port, () => {
    console.log(`Nastro Blu API listening on :${config.port}`);
    console.log(`Storefront: http://localhost:${config.port}/`);
    console.log(`Admin:      http://localhost:${config.port}/admin/`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
