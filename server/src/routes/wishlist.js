const express = require("express");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const { requireCustomer } = require("../middleware/customerAuth");

const router = express.Router();

function toPublicProduct(p) {
  if (!p) return null;
  const status = p.status || (p.active === false ? "unavailable" : "available");
  return {
    id: p.slug,
    slug: p.slug,
    name: p.name,
    brand: p.brand || "Nastro Blu",
    category: p.category,
    price: p.price,
    mrp: p.mrp,
    image: p.image,
    unit: p.unit || p.netQuantity || "",
    status,
    blurb: p.blurb || "",
  };
}

/** Slug list for heart buttons */
router.get("/ids", requireCustomer, async (req, res) => {
  try {
    const rows = await Wishlist.find({ customer: req.customer.id })
      .select("productSlug")
      .lean();
    res.json({ ids: rows.map((r) => r.productSlug) });
  } catch (err) {
    console.error("Wishlist ids error", err);
    res.status(500).json({ error: "Could not load wishlist" });
  }
});

/** Full wishlist with product cards */
router.get("/", requireCustomer, async (req, res) => {
  try {
    const rows = await Wishlist.find({ customer: req.customer.id })
      .sort({ createdAt: -1 })
      .lean();
    const slugs = rows.map((r) => r.productSlug);
    const products = await Product.find({
      slug: { $in: slugs },
      status: { $ne: "archived" },
    }).lean();
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const items = rows
      .map((r) => {
        const p = bySlug.get(r.productSlug);
        if (!p) return null;
        return {
          id: r._id.toString(),
          productSlug: r.productSlug,
          addedAt: r.createdAt,
          product: toPublicProduct(p),
        };
      })
      .filter(Boolean);
    res.json({ items, count: items.length });
  } catch (err) {
    console.error("Wishlist list error", err);
    res.status(500).json({ error: "Could not load wishlist" });
  }
});

router.post("/toggle/:slug", requireCustomer, async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Product required" });
    const existing = await Wishlist.findOne({
      customer: req.customer.id,
      productSlug: slug,
    });
    if (existing) {
      await existing.deleteOne();
      const count = await Wishlist.countDocuments({ customer: req.customer.id });
      return res.json({ ok: true, wished: false, productSlug: slug, count });
    }
    const product = await Product.findOne({ slug, status: { $ne: "archived" } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    await Wishlist.create({ customer: req.customer.id, productSlug: slug });
    const count = await Wishlist.countDocuments({ customer: req.customer.id });
    res.status(201).json({ ok: true, wished: true, productSlug: slug, count });
  } catch (err) {
    console.error("Wishlist toggle error", err);
    res.status(500).json({ error: "Could not update wishlist" });
  }
});

router.post("/:slug", requireCustomer, async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug || slug === "toggle" || slug === "ids") {
      return res.status(400).json({ error: "Product required" });
    }
    const product = await Product.findOne({ slug, status: { $ne: "archived" } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    await Wishlist.findOneAndUpdate(
      { customer: req.customer.id, productSlug: slug },
      { $setOnInsert: { customer: req.customer.id, productSlug: slug } },
      { upsert: true, new: true }
    );
    const count = await Wishlist.countDocuments({ customer: req.customer.id });
    res.status(201).json({ ok: true, wished: true, productSlug: slug, count });
  } catch (err) {
    if (err && err.code === 11000) {
      const count = await Wishlist.countDocuments({ customer: req.customer.id });
      return res.json({ ok: true, wished: true, productSlug: req.params.slug, count });
    }
    console.error("Wishlist add error", err);
    res.status(500).json({ error: "Could not add to wishlist" });
  }
});

router.delete("/:slug", requireCustomer, async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    await Wishlist.deleteOne({ customer: req.customer.id, productSlug: slug });
    const count = await Wishlist.countDocuments({ customer: req.customer.id });
    res.json({ ok: true, wished: false, productSlug: slug, count });
  } catch (err) {
    console.error("Wishlist remove error", err);
    res.status(500).json({ error: "Could not remove from wishlist" });
  }
});

module.exports = router;
