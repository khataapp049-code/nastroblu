const mongoose = require("mongoose");

const GROUPS = ["pantry", "dryfruits", "sweets"];

const hamperItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true },
    group: { type: String, enum: GROUPS, default: "pantry" },
    sizeLabel: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const DEFAULT_ITEMS = [
  { productId: "palakudi-cardamom-25g", group: "pantry", sizeLabel: "25 g" },
  { productId: "raw-honey-250g", group: "pantry", sizeLabel: "250 g" },
  { productId: "mango-squash-1l", group: "pantry", sizeLabel: "500 ml" },
  { productId: "desi-cow-ghee-250g", group: "pantry", sizeLabel: "250 g" },
  { productId: "walnuts-250g", group: "dryfruits", sizeLabel: "" },
  { productId: "desi-mamra-badam-250g", group: "dryfruits", sizeLabel: "" },
  { productId: "konkan-cashew-250g", group: "dryfruits", sizeLabel: "" },
  { productId: "anjeer-fig-250g", group: "dryfruits", sizeLabel: "" },
  { productId: "apricot-250g", group: "dryfruits", sizeLabel: "" },
  { productId: "dry-fruit-mixture-250g", group: "dryfruits", sizeLabel: "" },
  { productId: "plain-mota-bhujia-250g", group: "pantry", sizeLabel: "" },
  { productId: "futana-dal-500g", group: "pantry", sizeLabel: "" },
  { productId: "saffron-1g", group: "pantry", sizeLabel: "1 g" },
  { productId: "kaju-katli-250g", group: "sweets", sizeLabel: "" },
  { productId: "motichoor-laddu-250g", group: "sweets", sizeLabel: "" },
  { productId: "ajmeri-kalakand-jaggery-250g", group: "sweets", sizeLabel: "" },
  { productId: "mamra-badam-anjeer-barfi-250g", group: "sweets", sizeLabel: "" },
  { productId: "dry-fruit-choco-delight-250g", group: "sweets", sizeLabel: "" },
  { productId: "kaju-delight-assorted-250g", group: "sweets", sizeLabel: "" },
  { productId: "anjeer-dry-fruit-roll-250g", group: "sweets", sizeLabel: "" },
  { productId: "kaju-anjeer-roll-250g", group: "sweets", sizeLabel: "" },
  { productId: "desi-mamra-badam-katli-250g", group: "sweets", sizeLabel: "" },
  { productId: "mava-choco-barfi-250g", group: "sweets", sizeLabel: "" },
];

const hamperSchema = new mongoose.Schema(
  {
    key: { type: String, default: "gift", unique: true, index: true },
    title: { type: String, default: "Nastro Blu Gift Hamper" },
    blurb: {
      type: String,
      default: "Pick from this curated list of pantry staples, dry fruits and mithai.",
    },
    items: { type: [hamperItemSchema], default: () => DEFAULT_ITEMS.slice() },
  },
  { timestamps: true }
);

hamperSchema.statics.GROUPS = GROUPS;
hamperSchema.statics.DEFAULT_ITEMS = DEFAULT_ITEMS;

module.exports = mongoose.model("Hamper", hamperSchema);
