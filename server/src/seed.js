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
  let upserts = 0;
  for (const p of catalog) {
    await Product.findOneAndUpdate(
      { slug: p.id },
      {
        slug: p.id,
        name: p.name,
        brand: p.brand || "Nastro Blu",
        category: p.category,
        tag: p.tag || null,
        price: p.price,
        mrp: p.mrp,
        netQuantity: p.netQuantity || p.unit || "",
        unit: p.unit || "",
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
        rating: p.rating || 4.8,
        reviews: p.reviews || 0,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upserts += 1;
  }
  console.log("Products upserted:", upserts);
}

async function main() {
  await connectDb();
  await ensureAdmin();
  await seedProducts();
  console.log("\nAdmin login");
  console.log("  URL:   /admin/");
  console.log("  Email:", config.adminEmail);
  console.log("  Pass: ", config.adminPassword);
  console.log("\nChange ADMIN_EMAIL / ADMIN_PASSWORD in .env on the VPS.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
