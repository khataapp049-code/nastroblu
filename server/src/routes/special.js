const express = require("express");
const Special = require("../models/Special");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

async function getOrCreate() {
  let doc = await Special.findOne({ key: "today" });
  if (!doc) {
    doc = await Special.create({ key: "today", enabled: false });
  }
  return doc;
}

/** Public: active today's special for storefront popup */
router.get("/today", async (_req, res) => {
  try {
    const doc = await getOrCreate();
    if (!doc.enabled) {
      return res.json({ special: null });
    }
    if (!doc.title || !doc.image) {
      return res.json({ special: null });
    }

    let product = null;
    if (doc.productId) {
      product = await Product.findOne({ slug: doc.productId });
    }

    const status =
      product && (product.status || (product.active === false ? "unavailable" : "available"));
    const available = Boolean(product && status === "available");

    res.json({
      special: {
        badge: doc.badge || "Today's Special",
        title: doc.title,
        description: doc.description || "",
        image: doc.image,
        productId: doc.productId || "",
        ctaLabel: doc.ctaLabel || "Add to cart",
        showOncePerDay: doc.showOncePerDay !== false,
        available,
        price: available ? product.price : null,
        mrp: available ? product.mrp : null,
        unit: available ? product.netQuantity || product.unit || "" : "",
        productName: available ? product.name : doc.title,
      },
    });
  } catch (err) {
    console.error("Special public error", err);
    res.status(500).json({ error: "Could not load today's special" });
  }
});

/** Admin: get current config */
router.get("/admin/today", requireAdmin, async (_req, res) => {
  try {
    const doc = await getOrCreate();
    res.json({ special: doc.toAdmin() });
  } catch (err) {
    res.status(500).json({ error: "Could not load special settings" });
  }
});

/** Admin: update today's special */
router.put("/admin/today", requireAdmin, async (req, res) => {
  try {
    const doc = await getOrCreate();
    const body = req.body || {};

    if (body.enabled != null) doc.enabled = Boolean(body.enabled);
    if (body.badge != null) doc.badge = String(body.badge).trim() || "Today's Special";
    if (body.title != null) doc.title = String(body.title).trim();
    if (body.description != null) doc.description = String(body.description).trim();
    if (body.image != null) doc.image = String(body.image).trim();
    if (body.productId != null) doc.productId = String(body.productId).trim();
    if (body.ctaLabel != null) doc.ctaLabel = String(body.ctaLabel).trim() || "Add to cart";
    if (body.showOncePerDay != null) doc.showOncePerDay = Boolean(body.showOncePerDay);

    if (doc.enabled) {
      if (!doc.title) return res.status(400).json({ error: "Title is required when enabled" });
      if (!doc.image) return res.status(400).json({ error: "Image is required when enabled" });
      if (!doc.productId) {
        return res.status(400).json({ error: "Link a product for Add to cart" });
      }
      const product = await Product.findOne({ slug: doc.productId });
      if (!product) {
        return res.status(400).json({ error: "Linked product not found. Check the product slug." });
      }
    }

    await doc.save();
    res.json({ special: doc.toAdmin() });
  } catch (err) {
    console.error("Special save error", err);
    res.status(500).json({ error: "Could not save today's special" });
  }
});

module.exports = router;
