const express = require("express");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const CATEGORIES = [
  { id: "all", name: "All Products", icon: "✦" },
  { id: "produce", name: "Naturally Grown Produce", icon: "🌿" },
  { id: "oils", name: "Cold Pressed Oils", icon: "🫒" },
  { id: "spices", name: "Kerala Spices", icon: "🌶" },
  { id: "honey", name: "Honey", icon: "🍯" },
  { id: "dryfruits", name: "Kashmiri Dry Fruits", icon: "🥜" },
  { id: "sweets", name: "Traditional Sweets & Snacks", icon: "🍬" },
  { id: "ghee", name: "Dairy & Ghee", icon: "🧈" },
];

function toPublic(doc) {
  const p = doc.toObject ? doc.toObject() : doc;
  return {
    id: p.slug,
    _id: p._id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    tag: p.tag,
    price: p.price,
    mrp: p.mrp,
    netQuantity: p.netQuantity,
    unit: p.unit,
    sku: p.sku,
    barcode: p.barcode,
    packedOn: p.packedOn,
    bestBefore: p.bestBefore,
    ingredients: p.ingredients,
    specifications: p.specifications || [],
    packagingText: p.packagingText || [],
    storage: p.storage,
    origin: p.origin,
    sizes: p.sizes || [],
    blurb: p.blurb,
    description: p.description,
    image: p.image,
    rating: p.rating,
    reviews: p.reviews,
    active: p.active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

router.get("/meta/categories", (_req, res) => {
  res.json({ categories: CATEGORIES });
});

router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.all === "1";
    const filter = includeInactive ? {} : { active: true };
    if (req.query.category && req.query.category !== "all") {
      filter.category = req.query.category;
    }
    const products = await Product.find(filter).sort({ updatedAt: -1 });
    res.json({
      categories: CATEGORIES,
      products: products.map(toPublic),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product =
      (await Product.findOne({ slug: req.params.id })) ||
      (await Product.findById(req.params.id).catch(() => null));
    if (!product || (!product.active && req.query.admin !== "1")) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product: toPublic(product) });
  } catch (err) {
    res.status(404).json({ error: "Product not found" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Product name is required" });
    if (body.mrp == null || body.price == null) {
      return res.status(400).json({ error: "MRP and selling price are required" });
    }
    let slug = String(body.slug || body.id || slugify(name));
    if (!slug) slug = "product-" + Date.now();
    const exists = await Product.findOne({ slug });
    if (exists) slug = slug + "-" + Date.now().toString().slice(-4);

    const product = await Product.create({
      slug,
      name,
      brand: body.brand || "Nastro Blu",
      category: body.category || "produce",
      tag: body.tag || null,
      price: Number(body.price),
      mrp: Number(body.mrp),
      netQuantity: body.netQuantity || body.unit || "",
      unit: body.unit || body.netQuantity || "",
      sku: body.sku || "",
      barcode: body.barcode || "",
      packedOn: body.packedOn || "",
      bestBefore: body.bestBefore || "",
      ingredients: body.ingredients || "",
      specifications: Array.isArray(body.specifications)
        ? body.specifications
        : String(body.specifications || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
      packagingText: Array.isArray(body.packagingText)
        ? body.packagingText
        : String(body.packagingText || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
      storage: body.storage || "",
      origin: body.origin || "",
      sizes: Array.isArray(body.sizes) && body.sizes.length
        ? body.sizes
        : [{ label: body.unit || body.netQuantity || "1 unit", price: Number(body.price), sku: body.sku || "" }],
      blurb: body.blurb || "",
      description: body.description || "",
      image: body.image || "assets/products/grains.jpg",
      rating: Number(body.rating || 4.8),
      reviews: Number(body.reviews || 0),
      active: body.active !== false,
    });
    res.status(201).json({ product: toPublic(product) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not create product" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const product =
      (await Product.findOne({ slug: req.params.id })) ||
      (await Product.findById(req.params.id).catch(() => null));
    if (!product) return res.status(404).json({ error: "Product not found" });

    const body = req.body || {};
    const fields = [
      "name",
      "brand",
      "category",
      "tag",
      "netQuantity",
      "unit",
      "sku",
      "barcode",
      "packedOn",
      "bestBefore",
      "ingredients",
      "storage",
      "origin",
      "blurb",
      "description",
      "image",
    ];
    fields.forEach((key) => {
      if (body[key] !== undefined) product[key] = body[key];
    });
    if (body.price != null) product.price = Number(body.price);
    if (body.mrp != null) product.mrp = Number(body.mrp);
    if (body.rating != null) product.rating = Number(body.rating);
    if (body.reviews != null) product.reviews = Number(body.reviews);
    if (body.active != null) product.active = Boolean(body.active);
    if (body.slug) product.slug = slugify(body.slug) || product.slug;
    if (body.specifications !== undefined) {
      product.specifications = Array.isArray(body.specifications)
        ? body.specifications
        : String(body.specifications)
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (body.packagingText !== undefined) {
      product.packagingText = Array.isArray(body.packagingText)
        ? body.packagingText
        : String(body.packagingText)
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (Array.isArray(body.sizes)) product.sizes = body.sizes;

    await product.save();
    res.json({ product: toPublic(product) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not update product" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const product =
      (await Product.findOne({ slug: req.params.id })) ||
      (await Product.findById(req.params.id).catch(() => null));
    if (!product) return res.status(404).json({ error: "Product not found" });
    product.active = false;
    await product.save();
    res.json({ ok: true, product: toPublic(product) });
  } catch (err) {
    res.status(500).json({ error: "Could not archive product" });
  }
});

module.exports = router;
