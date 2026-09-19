const mongoose = require("mongoose");

/** Singleton-style "Today's Special" promo controlled by admin */
const specialSchema = new mongoose.Schema(
  {
    key: { type: String, default: "today", unique: true, index: true },
    enabled: { type: Boolean, default: false, index: true },
    badge: { type: String, default: "Today's Special" },
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "" },
    /** Linked catalog product slug for Add to cart */
    productId: { type: String, default: "", trim: true, index: true },
    ctaLabel: { type: String, default: "Add to cart" },
    showOncePerDay: { type: Boolean, default: true },
  },
  { timestamps: true }
);

specialSchema.methods.toAdmin = function toAdmin() {
  return {
    enabled: this.enabled,
    badge: this.badge || "Today's Special",
    title: this.title || "",
    description: this.description || "",
    image: this.image || "",
    productId: this.productId || "",
    ctaLabel: this.ctaLabel || "Add to cart",
    showOncePerDay: this.showOncePerDay !== false,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("Special", specialSchema);
