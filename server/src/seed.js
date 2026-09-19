const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { connectDb } = require("./db");
const config = require("./config");
const Admin = require("./models/Admin");
const Product = require("./models/Product");

function loadCatalogProducts() {
 const file = path.join(__dirname, "../../products.js");
 const raw = fs.readFileSync(file, "utf8");
 const wrapped = raw
 .replace("window.NASTRO_BRAND", "globalThis.NASTRO_BRAND")
 .replace("window.NASTRO_CATALOG", "globalThis.NASTRO_CATALOG");
 // eslint-disable-next-line no-new-func
 new Function(wrapped)();
 return globalThis.NASTRO_CATALOG.products || [];
}

async function ensureAdmin() {
 const email = config.adminEmail;
 let admin = await Admin.findOne({ email });
 const passwordHash = await bcrypt.hash(config.adminPassword, 10);
 if (!admin) {
 admin = await Admin.create({
 email,
 passwordHash,
 name: "Nastro Blu Admin",
 });
 console.log("Admin created:", email);
 } else {
 admin.passwordHash = passwordHash;
 await admin.save();
 console.log("Admin password synced from env:", email);
 }
}

async function seedProducts() {
 const catalog = loadCatalogProducts();
 const keepSlugs = catalog.map((p) => p.id).filter(Boolean);

 // Replace catalog: remove anything not in the current products.js list
 if (keepSlugs.length) {
 const removed = await Product.deleteMany({ slug: { $nin: keepSlugs } });
 console.log("Old products removed:", removed.deletedCount || 0);
 }

 let inserted = 0;
 let skipped = 0;
 let i = 0;
 for (const p of catalog) {
 i += 1;
 const tags = Array.isArray(p.tags) && p.tags.length ? p.tags : p.tag ? [p.tag] : [];
 // Insert-only: never overwrite admin edits on existing products
 const exists = await Product.findOne({ slug: p.id }).select("_id").lean();
 if (exists) {
 skipped += 1;
 continue;
 }
 await Product.create({
 slug: p.id,
 name: p.name,
 brand: p.brand || "Nastro Blu",
 category: p.category,
 tag: p.tag || null,
 tags,
 price: p.price,
 mrp: p.mrp != null ? p.mrp : p.price,
 cost: typeof p.cost === "number" ? p.cost : 0,
 netQuantity: p.netQuantity || p.unit || "",
 unit: p.unit || p.netQuantity || "",
 sku: p.sku || "",
 barcode: p.barcode || "",
 packedOn: p.packedOn || "",
 bestBefore: p.bestBefore || "",
 ingredients: p.ingredients || "",
 specifications: p.specifications || [],
 packagingText: p.packagingText || [],
 storage: p.storage || "",
 origin: p.origin || "",
 sizes: p.sizes || [],
 blurb: p.blurb || "",
 description: p.description || "",
 image: p.image || "assets/products/grains.jpg",
 rating: Number(p.reviews) > 0 ? Number(p.rating || 0) : 0,
 reviews: Number(p.reviews || 0),
 status: p.status || "available",
 active: p.active !== false,
 sortOrder: p.sortOrder != null ? p.sortOrder : i * 10,
 });
 inserted += 1;
 }
 console.log("Products inserted:", inserted, "| existing preserved:", skipped);
}

async function main() {
 await connectDb();
 await ensureAdmin();
 await seedProducts();
 console.log("\nAdmin ready at /admin/ (credentials are only in .env - never log the password).");
 console.log(" Email:", config.adminEmail);
 process.exit(0);
}

main().catch((err) => {
 console.error(err);
 process.exit(1);
});
