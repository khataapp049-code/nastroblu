const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true }, // slug
    name: { type: String, required: true },
    sku: { type: String, default: "" },
    size: { type: String, default: "" },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerSnapshot: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, default: "" },
    },
    items: { type: [orderItemSchema], required: true },
    currency: { type: String, default: "INR" },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    shippingAddress: { type: addressSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
      index: true,
    },
    paymentMethod: { type: String, default: "whatsapp_cod" },
    channel: { type: String, default: "whatsapp", index: true },
    notes: { type: String, default: "" },
    whatsappMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ "customerSnapshot.email": 1, createdAt: -1 });

orderSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    orderNumber: this.orderNumber,
    items: this.items,
    currency: this.currency,
    subtotal: this.subtotal,
    discount: this.discount,
    shipping: this.shipping,
    tax: this.tax,
    total: this.total,
    shippingAddress: this.shippingAddress,
    status: this.status,
    paymentStatus: this.paymentStatus,
    paymentMethod: this.paymentMethod,
    channel: this.channel,
    notes: this.notes,
    customer: this.customerSnapshot,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("Order", orderSchema);
