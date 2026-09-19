const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema(
 {
 label: { type: String, required: true },
 price: { type: Number, required: true },
 sku: String,
 },
 { _id: false }
);

const productSchema = new mongoose.Schema(
 {
 slug: { type: String, required: true, unique: true, index: true },
 name: { type: String, required: true },
 brand: { type: String, default: "Nastro Blu" },
 category: { type: String, required: true, index: true },
 /** Primary badge shown on storefront cards */
 tag: { type: String, default: null },
 /** Extra searchable tags */
 tags: { type: [String], default: [] },
 price: { type: Number, required: true },
 mrp: { type: Number, required: true },
 /** Costing / purchase cost (admin only; not required on storefront) */
 cost: { type: Number, default: 0 },
 netQuantity: { type: String, default: "" },
 unit: { type: String, default: "" },
 sku: { type: String, default: "" },
 barcode: { type: String, default: "" },
 packedOn: { type: String, default: "" },
 bestBefore: { type: String, default: "" },
 ingredients: { type: String, default: "" },
 specifications: { type: [String], default: [] },
 packagingText: { type: [String], default: [] },
 storage: { type: String, default: "" },
 origin: { type: String, default: "" },
 sizes: { type: [sizeSchema], default: [] },
 blurb: { type: String, default: "" },
 description: { type: String, default: "" },
 image: { type: String, default: "assets/products/grains.jpg" },
 /** Aggregated from customer ProductReview docs — 0 until someone reviews */
 rating: { type: Number, default: 0 },
 reviews: { type: Number, default: 0 },
 /**
 * available - shown on storefront
 * unavailable - temporarily not available (hidden from shop)
 * archived - soft-deleted
 */
 status: {
 type: String,
 enum: ["available", "unavailable", "archived"],
 default: "available",
 index: true,
 },
 /** Kept in sync with status for older clients */
 active: { type: Boolean, default: true, index: true },
 /** Lower number = higher on storefront */
 sortOrder: { type: Number, default: 100, index: true },
 },
 { timestamps: true }
);

productSchema.pre("save", function syncActive(next) {
 if (this.status) {
 this.active = this.status === "available";
 } else if (this.active === false) {
 this.status = "unavailable";
 } else {
 this.status = "available";
 this.active = true;
 }
 next();
});

module.exports = mongoose.model("Product", productSchema);
