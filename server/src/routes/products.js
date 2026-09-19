const express = require("express");
const Product = require("../models/Product");
const { requireAdmin, optionalAdmin } = require("../middleware/auth");
const { cleanText, isValidPrice, isSafeImagePath } = require("../sanitize");

const router = express.Router();

const CATEGORIES = [
 { id: "all", name: "All Products", icon: "✦" },
 { id: "produce", name: "Naturally Grown Produce", icon: "🌿" },
 { id: "oils", name: "Cold Pressed Oils", icon: "🫒" },
 { id: "spices", name: "Kerala Spices & Teas", icon: "🌶" },
 { id: "honey", name: "Honey", icon: "🍯" },
 { id: "dryfruits", name: "Kashmiri Dry Fruits", icon: "🥜" },
 { id: "sweets", name: "Traditional Sweets & Snacks", icon: "🍬" },
 { id: "ghee", name: "Dairy & Ghee", icon: "🧈" },
];

const VALID_CATEGORY_IDS = new Set(
 CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id)
);

function validateMoneyFields(price, mrp) {
 if (!isValidPrice(price) || !isValidPrice(mrp)) {
 return "Price and MRP must be valid non-negative numbers";
 }
 if (price > mrp) {
 return "Selling price cannot be greater than MRP";
 }
 return null;
}

function normalizeTags(input, primaryTag) {
 let tags = [];
 if (Array.isArray(input)) {
 tags = input.map((t) => String(t || "").trim()).filter(Boolean);
 } else if (typeof input === "string") {
 tags = input
 .split(/[,|\n]/)
 .map((t) => t.trim())
 .filter(Boolean);
 }
 const primary = primaryTag ? String(primaryTag).trim() : "";
 if (primary && !tags.includes(primary)) tags.unshift(primary);
 return [...new Set(tags)];
}

function resolveStatus(body, existing) {
 if (body.status && ["available", "unavailable", "archived"].includes(body.status)) {
 return body.status;
 }
 if (body.active === false || body.active === "false" || body.active === 0) {
 return "unavailable";
 }
 if (body.active === true || body.active === "true" || body.active === 1) {
 return "available";
 }
 return existing || "available";
}

function toPublic(doc, { includePrivate = false } = {}) {
 const p = doc.toObject ? doc.toObject() : doc;
 const status = p.status || (p.active === false ? "unavailable" : "available");
 const tags = Array.isArray(p.tags) ? p.tags : [];
 const out = {
 id: p.slug,
 _id: p._id,
 name: p.name,
 brand: p.brand,
 category: p.category,
 tag: p.tag || tags[0] || null,
 tags,
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
 status,
 active: status === "available",
 sortOrder: p.sortOrder != null ? p.sortOrder : 100,
 createdAt: p.createdAt,
 updatedAt: p.updatedAt,
 };
 // Cost / costing is confidential - only for authenticated admin responses
 if (includePrivate) {
 out.cost = p.cost || 0;
 }
 return out;
}

function slugify(text) {
 return String(text || "")
 .toLowerCase()
 .trim()
 .replace(/[^a-z0-9]+/g, "-")
 .replace(/(^-|-$)/g, "")
 .slice(0, 80);
}

function linesToArray(value) {
 if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
 return String(value || "")
 .split("\n")
 .map((s) => s.trim())
 .filter(Boolean);
}

router.get("/meta/categories", (_req, res) => {
 res.json({ categories: CATEGORIES });
});

router.get("/", optionalAdmin, async (req, res) => {
 try {
 const includeAll = req.query.all === "1";
 // Admin catalog (inactive/archived + cost) requires a valid JWT
 if (includeAll && !req.admin) {
 return res.status(401).json({ error: "Login required" });
 }
 const filter = {};
 if (!includeAll) {
 // Storefront: show available + temporarily unavailable; hide archived only
 filter.status = { $ne: "archived" };
 } else if (typeof req.query.status === "string") {
 // Primitive string only — blocks NoSQL operator injection via status[$ne]=…
 if (["available", "unavailable", "archived"].includes(req.query.status)) {
 filter.status = req.query.status;
 }
 }
 if (typeof req.query.category === "string" && req.query.category !== "all") {
 // Primitive string only — blocks category[$ne]=x operator injection
 filter.category = req.query.category;
 }
 const products = await Product.find(filter).sort({ sortOrder: 1, updatedAt: -1 });
 const includePrivate = Boolean(req.admin && includeAll);
 res.json({
 categories: CATEGORIES,
 products: products.map((p) => toPublic(p, { includePrivate })),
 });
 } catch (err) {
 console.error(err);
 res.status(500).json({ error: "Could not load products" });
 }
});

router.get("/:id", optionalAdmin, async (req, res) => {
 try {
 const product =
 (await Product.findOne({ slug: req.params.id })) ||
 (await Product.findById(req.params.id).catch(() => null));
 const status = product && (product.status || (product.active === false ? "unavailable" : "available"));
 const wantsAdmin = req.query.admin === "1";
 if (wantsAdmin && !req.admin) {
 return res.status(401).json({ error: "Login required" });
 }
 // Public can view available + unavailable; archived stays admin-only
 if (!product || (status === "archived" && !req.admin)) {
 return res.status(404).json({ error: "Product not found" });
 }
 res.json({ product: toPublic(product, { includePrivate: Boolean(req.admin) }) });
 } catch (err) {
 res.status(404).json({ error: "Product not found" });
 }
});

router.post("/", requireAdmin, async (req, res) => {
 try {
 const body = req.body || {};
 const name = cleanText(body.name, 200);
 if (!name) return res.status(400).json({ error: "Product name is required" });
 if (body.mrp == null || body.price == null) {
 return res.status(400).json({ error: "MRP and selling price are required" });
 }
 const price = Number(body.price);
 const mrp = Number(body.mrp);
 const moneyErr = validateMoneyFields(price, mrp);
 if (moneyErr) return res.status(400).json({ error: moneyErr });

 const category = String(body.category || "produce").trim();
 if (!VALID_CATEGORY_IDS.has(category)) {
 return res.status(400).json({ error: "Invalid category" });
 }

 const image = cleanText(body.image || "assets/products/grains.jpg", 500);
 if (!isSafeImagePath(image)) {
 return res.status(400).json({ error: "Invalid image path" });
 }

 let slug = String(body.slug || body.id || slugify(name));
 if (!slug) slug = "product-" + Date.now();
 const exists = await Product.findOne({ slug });
 if (exists) slug = slug + "-" + Date.now().toString().slice(-4);

 const tags = normalizeTags(body.tags, body.tag).map((t) => cleanText(t, 40)).filter(Boolean);
 const status = resolveStatus(body, "available");
 const cost = Number(body.cost || 0);
 if (body.cost != null && !isValidPrice(cost)) {
 return res.status(400).json({ error: "Invalid cost" });
 }

 const product = await Product.create({
 slug,
 name,
 brand: cleanText(body.brand || "Nastro Blu", 80) || "Nastro Blu",
 category,
 tag: cleanText(body.tag || tags[0] || "", 40) || null,
 tags,
 price,
 mrp,
 cost: isValidPrice(cost) ? cost : 0,
 netQuantity: cleanText(body.netQuantity || body.unit || "", 80),
 unit: cleanText(body.unit || body.netQuantity || "", 80),
 sku: cleanText(body.sku || "", 80),
 barcode: cleanText(body.barcode || "", 80),
 packedOn: cleanText(body.packedOn || "", 80),
 bestBefore: cleanText(body.bestBefore || "", 80),
 ingredients: cleanText(body.ingredients || "", 4000),
 specifications: linesToArray(body.specifications).map((s) => cleanText(s, 300)).filter(Boolean),
 packagingText: linesToArray(body.packagingText).map((s) => cleanText(s, 300)).filter(Boolean),
 storage: cleanText(body.storage || "", 300),
 origin: cleanText(body.origin || "", 200),
 sizes:
 Array.isArray(body.sizes) && body.sizes.length
 ? body.sizes
 .map((s) => ({
 label: cleanText(s.label || "1 unit", 80) || "1 unit",
 price: Number(s.price),
 sku: cleanText(s.sku || "", 80),
 }))
 .filter((s) => isValidPrice(s.price))
 : [
 {
 label: cleanText(body.unit || body.netQuantity || "1 unit", 80) || "1 unit",
 price,
 sku: cleanText(body.sku || "", 80),
 },
 ],
 blurb: cleanText(body.blurb || "", 300),
 description: cleanText(body.description || "", 8000),
 image,
 // Rating/reviews only from real ProductReview aggregates — never client mass-assign
 rating: 0,
 reviews: 0,
 status,
 active: status === "available",
 sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 100,
 });
 res.status(201).json({ product: toPublic(product, { includePrivate: true }) });
 } catch (err) {
 if (err && (err.code === 11000 || err.code === "E11000")) {
 return res.status(409).json({ error: "A product with this slug already exists" });
 }
 console.error(err);
 res.status(500).json({ error: "Could not create product" });
 }
});

router.put("/:id", requireAdmin, async (req, res) => {
 try {
 const product =
 (await Product.findOne({ slug: req.params.id })) ||
 (await Product.findById(req.params.id).catch(() => null));
 if (!product) return res.status(404).json({ error: "Product not found" });

 const body = req.body || {};
 const textFields = {
 name: 200,
 brand: 80,
 tag: 40,
 netQuantity: 80,
 unit: 80,
 sku: 80,
 barcode: 80,
 packedOn: 80,
 bestBefore: 80,
 ingredients: 4000,
 storage: 300,
 origin: 200,
 blurb: 300,
 description: 8000,
 };
 Object.keys(textFields).forEach((key) => {
 if (body[key] !== undefined) product[key] = cleanText(body[key], textFields[key]);
 });
 if (body.category !== undefined) {
 const category = String(body.category || "").trim();
 if (!VALID_CATEGORY_IDS.has(category)) {
 return res.status(400).json({ error: "Invalid category" });
 }
 product.category = category;
 }
 if (body.image !== undefined) {
 const image = cleanText(body.image, 500);
 if (!isSafeImagePath(image)) {
 return res.status(400).json({ error: "Invalid image path" });
 }
 product.image = image;
 }
 if (body.price != null || body.mrp != null) {
 const price = body.price != null ? Number(body.price) : product.price;
 const mrp = body.mrp != null ? Number(body.mrp) : product.mrp;
 const moneyErr = validateMoneyFields(price, mrp);
 if (moneyErr) return res.status(400).json({ error: moneyErr });
 product.price = price;
 product.mrp = mrp;
 }
 if (body.cost != null) {
 const cost = Number(body.cost);
 if (!isValidPrice(cost)) return res.status(400).json({ error: "Invalid cost" });
 product.cost = cost;
 }
 if (body.sortOrder != null) product.sortOrder = Number(body.sortOrder);
 // Do not allow mass-assignment of rating/reviews from admin body
 if (body.tags !== undefined || body.tag !== undefined) {
 product.tags = normalizeTags(body.tags !== undefined ? body.tags : product.tags, body.tag)
 .map((t) => cleanText(t, 40))
 .filter(Boolean);
 if (body.tag !== undefined) product.tag = cleanText(body.tag || product.tags[0] || "", 40) || null;
 else if (!product.tag && product.tags[0]) product.tag = product.tags[0];
 }
 if (body.status !== undefined || body.active !== undefined) {
 product.status = resolveStatus(body, product.status || "available");
 product.active = product.status === "available";
 }
 if (body.slug) {
 const next = slugify(body.slug) || product.slug;
 if (next !== product.slug) {
 const clash = await Product.findOne({ slug: next, _id: { $ne: product._id } });
 if (clash) return res.status(400).json({ error: "Slug already in use" });
 product.slug = next;
 }
 }
 if (body.specifications !== undefined) {
 product.specifications = linesToArray(body.specifications)
 .map((s) => cleanText(s, 300))
 .filter(Boolean);
 }
 if (body.packagingText !== undefined) {
 product.packagingText = linesToArray(body.packagingText)
 .map((s) => cleanText(s, 300))
 .filter(Boolean);
 }
 // Only replace sizes when explicitly provided with at least one valid size
 if (Array.isArray(body.sizes) && body.sizes.length) {
 const nextSizes = body.sizes
 .map((s) => ({
 label: cleanText(s.label || "1 unit", 80) || "1 unit",
 price: Number(s.price),
 sku: cleanText(s.sku || "", 80),
 }))
 .filter((s) => isValidPrice(s.price));
 if (!nextSizes.length) {
 return res.status(400).json({ error: "At least one valid size/price is required" });
 }
 product.sizes = nextSizes;
 }

 await product.save();
 res.json({ product: toPublic(product, { includePrivate: true }) });
 } catch (err) {
 if (err && (err.code === 11000 || err.code === "E11000")) {
 return res.status(409).json({ error: "A product with this slug already exists" });
 }
 console.error(err);
 res.status(500).json({ error: "Could not update product" });
 }
});

router.delete("/:id", requireAdmin, async (req, res) => {
 try {
 const product =
 (await Product.findOne({ slug: req.params.id })) ||
 (await Product.findById(req.params.id).catch(() => null));
 if (!product) return res.status(404).json({ error: "Product not found" });

 if (req.query.hard === "1") {
 await product.deleteOne();
 return res.json({ ok: true, deleted: true });
 }

 product.status = "archived";
 product.active = false;
 await product.save();
 res.json({ ok: true, product: toPublic(product, { includePrivate: true }) });
 } catch (err) {
 res.status(500).json({ error: "Could not delete product" });
 }
});

module.exports = router;
