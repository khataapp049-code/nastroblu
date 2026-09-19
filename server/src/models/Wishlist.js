const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    productSlug: { type: String, required: true, trim: true, index: true },
  },
  { timestamps: true }
);

wishlistSchema.index({ customer: 1, productSlug: 1 }, { unique: true });
wishlistSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model("Wishlist", wishlistSchema);
