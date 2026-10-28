const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

(async () => {
  const uri = process.env.ATLAS_URI;
  if (!uri) { console.error("Set ATLAS_URI first"); process.exit(1); }
  const apply = process.argv.includes("--apply");

  const text = fs.readFileSync(path.join(__dirname, "../images.json"), "utf8").replace(/^\uFEFF/, "");
  const rows = JSON.parse(text);

  const client = await MongoClient.connect(uri);
  const db = client.db();
  const products = db.collection("products");
  console.log("Database:", db.databaseName,
    "| products in Atlas:", await products.countDocuments(),
    "| rows in images.json:", rows.length);

  let same = 0, diff = 0, missing = 0;
  const ops = [];
  for (const r of rows) {
    const p = await products.findOne({ slug: r.slug }, { projection: { image: 1 } });
    if (!p) { missing++; continue; }
    if (p.image === r.image) { same++; continue; }
    diff++;
    if (diff <= 5) console.log("  e.g.", r.slug, ":", p.image, "->", r.image);
    ops.push({ updateOne: { filter: { slug: r.slug }, update: { $set: { image: r.image } } } });
  }
  console.log({ alreadyCorrect: same, wouldChange: diff, notInAtlas: missing });

  if (apply && ops.length) {
    const res = await products.bulkWrite(ops);
    console.log("Updated:", res.modifiedCount);
  } else {
    console.log("Dry run only. Nothing was changed. Add --apply to write.");
  }
  await client.close();
})();