const express = require("express");
const Hamper = require("../models/Hamper");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");
const { cleanText } = require("../sanitize");

const router = express.Router();
const GROUPS = Hamper.GROUPS;

async function getOrCreate() {
  let doc = await Hamper.findOne({ key: "gift" });
  if (!doc) {
    doc = await Hamper.create({
      key: "gift",
      items: Hamper.DEFAULT_ITEMS.slice(),
    });
  }
  return doc;
}

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return { error: "Items must be a list" };
  const seen = {};
  const items = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] || {};
    const productId = cleanText(row.productId || row.id || "", 80);
    if (!productId) {
      return { error: "Hamper row " + (i + 1) + " needs a product." };
    }
    if (seen[productId]) {
      return { error: "The same product is listed twice in the hamper." };
    }
    seen[productId] = true;
    const group = GROUPS.indexOf(row.group) >= 0 ? row.group : "pantry";
    items.push({
      productId,
      group,
      sizeLabel: cleanText(row.sizeLabel || "", 80),
      note: cleanText(row.note || "", 120),
    });
  }
  return { items };
}

function toAdmin(doc) {
  return {
    title: doc.title || "",
    blurb: doc.blurb || "",
    items: (doc.items || []).map((it) => ({
      productId: it.productId,
      group: it.group || "pantry",
      sizeLabel: it.sizeLabel || "",
      note: it.note || "",
    })),
    updatedAt: doc.updatedAt,
  };
}

function productCard(p, item) {
  const status = p.status || (p.active === false ? "unavailable" : "available");
  if (status === "archived") return null;
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const wanted = (item.sizeLabel || "").toLowerCase().replace(/\s+/g, "");
  let size = sizes[0] || { label: p.unit || p.netQuantity || "", price: p.price };
  if (wanted) {
    const match = sizes.find((s) =>
      String(s.label || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .includes(wanted.replace(/gms?/g, "g"))
    );
    if (match) size = match;
  }
  return {
    productId: p.slug,
    group: item.group || "pantry",
    sizeLabel: item.sizeLabel || size.label || "",
    note: item.note || "",
    id: p.slug,
    name: p.name,
    price: Number(size.price) || Number(p.price) || 0,
    unit: size.label || p.unit || p.netQuantity || "",
    img: p.image,
    cat: p.category,
    status,
    available: status === "available",
  };
}

router.get("/", async (_req, res) => {
  try {
    const doc = await getOrCreate();
    const slugs = (doc.items || []).map((it) => it.productId);
    const products = slugs.length
      ? await Product.find({ slug: { $in: slugs } })
      : [];
    const bySlug = {};
    products.forEach((p) => {
      bySlug[p.slug] = p;
    });
    const items = (doc.items || [])
      .map((it) => {
        const p = bySlug[it.productId];
        return p ? productCard(p, it) : null;
      })
      .filter(Boolean);
    res.json({
      title: doc.title,
      blurb: doc.blurb,
      items,
    });
  } catch (err) {
    console.error("Hamper public error", err);
    res.status(500).json({ error: "Could not load hamper" });
  }
});

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const doc = await getOrCreate();
    res.json({ hamper: toAdmin(doc) });
  } catch (err) {
    res.status(500).json({ error: "Could not load hamper settings" });
  }
});

router.put("/admin", requireAdmin, async (req, res) => {
  try {
    const doc = await getOrCreate();
    const body = req.body || {};
    if (body.title != null) doc.title = cleanText(body.title, 120) || doc.title;
    if (body.blurb != null) doc.blurb = cleanText(body.blurb, 400);
    if (body.items !== undefined) {
      const parsed = normalizeItems(body.items);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      for (const it of parsed.items) {
        const exists = await Product.findOne({ slug: it.productId }).select("_id").lean();
        if (!exists) {
          return res.status(400).json({ error: "Product not found: " + it.productId });
        }
      }
      doc.items = parsed.items;
    }
    await doc.save();
    res.json({ hamper: toAdmin(doc) });
  } catch (err) {
    console.error("Hamper save error", err);
    res.status(500).json({ error: "Could not save hamper" });
  }
});

module.exports = router;
