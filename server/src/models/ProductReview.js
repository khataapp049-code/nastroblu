const mongoose = require("mongoose");

const productReviewSchema = new mongoose.Schema(
  {
    productSlug: { type: String, required: true, index: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1200 },
  },
  { timestamps: true }
);

productReviewSchema.index({ productSlug: 1, customer: 1 }, { unique: true });
productReviewSchema.index({ productSlug: 1, createdAt: -1 });

productReviewSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    productSlug: this.productSlug,
    customerName: this.customerName,
    rating: this.rating,
    comment: this.comment,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("ProductReview", productReviewSchema);
