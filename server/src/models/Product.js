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
    tag: { type: String, default: null },
    price: { type: Number, required: true },
    mrp: { type: Number, required: true },
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
    rating: { type: Number, default: 4.8 },
    reviews: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
