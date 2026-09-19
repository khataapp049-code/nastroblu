const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const root = path.join(__dirname, "../../..");
const uploadDir = path.join(root, "assets", "uploads", "products");

fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    const base = String(file.originalname || "product")
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "product";
    cb(null, `${base}-${Date.now()}${safeExt === ".jpeg" ? ".jpg" : safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));
    }
    cb(null, true);
  },
});

router.post("/image", requireAdmin, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Image must be under 5MB" : err.message;
      return res.status(400).json({ error: msg || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image file received" });
    }
    const relative = `assets/uploads/products/${req.file.filename}`;
    res.status(201).json({
      ok: true,
      path: relative,
      url: `/${relative}`,
      filename: req.file.filename,
      size: req.file.size,
    });
  });
});

module.exports = router;
