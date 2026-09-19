#!/usr/bin/env node
/**
 * Builds products.js + catalog-seed.json from nastroblu-products.zip
 * (products.json is the single source of truth for name, MRP, description, etc.).
 * Admin can still edit any field after seed.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(
 ROOT,
 "assets/uploads/nastroblu-products/nastroblu-products"
);
const SRC_JSON = path.join(SRC_DIR, "products.json");
const IMG_OUT = path.join(ROOT, "assets/uploads/products");

const CAT_MAP = {
 sweets: "sweets",
 snacks: "sweets",
 "farm-products": "produce",
 pickles: "produce",
 squashes: "produce",
 "cold-pressed-oils": "oils",
 "kerala-spices-teas": "spices",
 "kashmiri-dry-fruits": "dryfruits",
 dairy: "ghee",
 "gift-hampers": "produce",
};

function siteCategory(row) {
 const slug = String(row.category_slug || "").toLowerCase();
 const name = String(row.name || "").toLowerCase();
 if (/honey/.test(name) || /honey/.test(slug)) return "honey";
 return CAT_MAP[slug] || "produce";
}

function cleanText(d) {
 if (d == null) return "";
 return String(d).replace(/\u2026/g, "…").trim();
}

if (!fs.existsSync(SRC_JSON)) {
 console.error("Missing source catalog:", SRC_JSON);
 process.exit(1);
}

const master = JSON.parse(fs.readFileSync(SRC_JSON, "utf8"));
const rows = Array.isArray(master.products) ? master.products : [];

fs.mkdirSync(IMG_OUT, { recursive: true });

// Keep a deploy copy of the master catalog for audits
fs.copyFileSync(SRC_JSON, path.join(__dirname, "catalog-source-of-truth.json"));

const products = [];
let skippedNoPrice = 0;

for (const row of rows) {
 const slug = String(row.slug || "").trim();
 const name = String(row.name || "").trim();
 if (!slug || !name) continue;

 const mrpRaw = row.mrp_inr;
 const hasPrice = mrpRaw != null && mrpRaw !== "" && !Number.isNaN(Number(mrpRaw));
 const mrp = hasPrice ? Math.round(Number(mrpRaw)) : 0;
 const price = mrp; // app list price = selling price until admin sets a different offer

 // Copy product image into public uploads path
 const srcImg = path.join(SRC_DIR, row.image || `images/${slug}.jpg`);
 const ext = path.extname(srcImg) || ".jpg";
 const destRel = `assets/uploads/products/${slug}${ext}`;
 const destAbs = path.join(ROOT, destRel);
 if (fs.existsSync(srcImg)) {
 fs.copyFileSync(srcImg, destAbs);
 } else {
 console.warn("Missing image for", slug, srcImg);
 }

 const netQuantity = cleanText(row.pack_size);
 const description =
 cleanText(row.description) ||
 `${name} from Nastro Blu - Eat Better. Naturally grown / traditionally prepared.`;
 const ingredients = cleanText(row.ingredients_as_listed);
 const category = siteCategory(row);
 const tags = [];
 if (row.category) tags.push(String(row.category));
 if (row.notes) tags.push("Review notes");
 if (!hasPrice) tags.push("Custom pricing");

 const onRequest = !hasPrice;
 if (onRequest) skippedNoPrice += 1;

 products.push({
 id: slug,
 name,
 brand: "Nastro Blu",
 category,
 tag: onRequest ? "On request" : null,
 tags,
 price,
 mrp,
 cost: 0,
 netQuantity,
 unit: netQuantity,
 sku: String(row.id || "").trim(),
 barcode: "",
 packedOn: "",
 bestBefore: "",
 ingredients,
 specifications: [
 netQuantity ? `Net quantity: ${netQuantity}` : null,
 row.id ? `SKU: ${row.id}` : null,
 row.notes ? `Note: ${cleanText(row.notes)}` : null,
 ].filter(Boolean),
 packagingText: [],
 storage: "Store in a cool, dry place",
 origin: "India",
 sizes: [{ label: netQuantity || "1 unit", price, sku: String(row.id || "") }],
 blurb: description.slice(0, 160),
 description,
 image: destRel,
 rating: 4.8,
 reviews: 0,
 status: "available",
 active: true,
 sortOrder: 100,
 });
}

products.sort((a, b) => a.name.localeCompare(b.name));
products.forEach((p, i) => {
 p.sortOrder = (i + 1) * 10;
});

const categories = [
 { id: "all", name: "All Products", icon: "✦" },
 { id: "produce", name: "Naturally Grown Produce", icon: "🌿" },
 { id: "oils", name: "Cold Pressed Oils", icon: "🫒" },
 { id: "spices", name: "Kerala Spices & Teas", icon: "🌶" },
 { id: "honey", name: "Honey", icon: "🍯" },
 { id: "dryfruits", name: "Kashmiri Dry Fruits", icon: "🥜" },
 { id: "sweets", name: "Traditional Sweets & Snacks", icon: "🍬" },
 { id: "ghee", name: "Dairy & Ghee", icon: "🧈" },
];

const outJs = `window.NASTRO_BRAND = {
 name: "Nastro Blu",
 tagline: "Eat Better",
 whatsapp: "919063048255",
 phone: "+91 40 4540 8385",
 email: "nastroblu.eatbetter@gmail.com",
};

window.NASTRO_CATALOG = {
 categories: ${JSON.stringify(categories, null, 2)},
 products: ${JSON.stringify(products, null, 2)},
};
`;

fs.writeFileSync(path.join(ROOT, "products.js"), outJs);
fs.writeFileSync(path.join(ROOT, "deploy", "catalog-seed.json"), JSON.stringify(products, null, 2));

console.log("Wrote products.js with", products.length, "products");
console.log("Images in", IMG_OUT);
console.log("Custom-pricing (no MRP in source):", skippedNoPrice);
const by = {};
products.forEach((p) => {
 by[p.category] = (by[p.category] || 0) + 1;
});
console.log("By site category:", by);
