const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { requireCustomer } = require("../middleware/customerAuth");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

async function nextOrderNumber() {
  const day = new Date();
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(day.getUTCDate()).padStart(2, "0");
  const prefix = `NB-${y}${m}${d}`;
  const count = await Order.countDocuments({
    orderNumber: new RegExp(`^${prefix}`),
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${seq}`;
}

function formatInr(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function buildWhatsappMessage(order) {
  const lines = [
    `Hi Nastro Blu! I'd like to place order ${order.orderNumber}:`,
    "",
  ];
  order.items.forEach((i) => {
    lines.push(
      `• ${i.name} (${i.size || "1 pack"}) × ${i.qty} - ${formatInr(i.lineTotal)}`
    );
  });
  lines.push("");
  lines.push(`Subtotal: ${formatInr(order.subtotal)}`);
  lines.push(`Total: ${formatInr(order.total)}`);
  lines.push("");
  lines.push(`Customer: ${order.customerSnapshot.name}`);
  lines.push(`Email: ${order.customerSnapshot.email}`);
  if (order.customerSnapshot.phone) {
    lines.push(`Phone: ${order.customerSnapshot.phone}`);
  }
  const a = order.shippingAddress || {};
  const addr = [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ");
  if (addr) lines.push(`Address: ${addr}`);
  lines.push("");
  lines.push("Please confirm availability & delivery.");
  return lines.join("\n");
}

/** Create order from cart - prices revalidated from DB */
router.post("/", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer || customer.isActive === false) {
      return res.status(401).json({ error: "Login required" });
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!rawItems.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    if (rawItems.length > 50) {
      return res.status(400).json({ error: "Too many items in cart" });
    }

    const items = [];
    for (const row of rawItems) {
      const productId = String(row.productId || row.id || "").trim();
      const qty = Math.max(1, Math.min(99, Number(row.qty) || 1));
      const sizeLabel = String(row.size || "").trim();
      if (!productId) continue;

      const product =
        (await Product.findOne({ slug: productId })) ||
        (await Product.findById(productId).catch(() => null));
      if (!product) {
        return res.status(400).json({ error: `Product not found: ${productId}` });
      }
      const status = product.status || (product.active === false ? "unavailable" : "available");
      if (status !== "available") {
        return res.status(400).json({ error: `${product.name} is currently unavailable` });
      }

      let unitPrice = Number(product.price) || 0;
      let size = sizeLabel || product.netQuantity || product.unit || "1 pack";
      if (Array.isArray(product.sizes) && product.sizes.length) {
        const match =
          product.sizes.find((s) => s.label === sizeLabel) || product.sizes[0];
        if (match) {
          unitPrice = Number(match.price != null ? match.price : product.price) || 0;
          size = match.label || size;
        }
      }
      if (unitPrice <= 0) {
        return res.status(400).json({ error: `${product.name} has no valid price` });
      }

      items.push({
        productId: product.slug,
        name: product.name,
        sku: product.sku || "",
        size,
        qty,
        unitPrice,
        lineTotal: Math.round(unitPrice * qty),
        image: product.image || "",
      });
    }

    if (!items.length) {
      return res.status(400).json({ error: "No valid items to order" });
    }

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const shippingAddress = {
      line1: String((req.body.shippingAddress && req.body.shippingAddress.line1) || customer.address?.line1 || "").trim(),
      line2: String((req.body.shippingAddress && req.body.shippingAddress.line2) || customer.address?.line2 || "").trim(),
      city: String((req.body.shippingAddress && req.body.shippingAddress.city) || customer.address?.city || "").trim(),
      state: String((req.body.shippingAddress && req.body.shippingAddress.state) || customer.address?.state || "").trim(),
      pincode: String((req.body.shippingAddress && req.body.shippingAddress.pincode) || customer.address?.pincode || "").trim(),
    };

    const order = await Order.create({
      orderNumber: await nextOrderNumber(),
      customer: customer._id,
      customerSnapshot: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || "",
      },
      items,
      currency: "INR",
      subtotal,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: subtotal,
      shippingAddress,
      status: "pending",
      paymentStatus: "unpaid",
      paymentMethod: "whatsapp_cod",
      channel: "whatsapp",
      notes: String(req.body.notes || "").trim().slice(0, 500),
    });

    order.whatsappMessage = buildWhatsappMessage(order);
    await order.save();

    const WA_MAX = 1800;
    let text = order.whatsappMessage;
    let whatsappUrl = "https://wa.me/919063048255?text=" + encodeURIComponent(text);
    if (whatsappUrl.length > WA_MAX) {
      text =
        `Hi Nastro Blu! Order ${order.orderNumber} for ${formatInr(order.total)} ` +
        `(${order.items.length} items). Please confirm — full details are in your admin panel.`;
      whatsappUrl = "https://wa.me/919063048255?text=" + encodeURIComponent(text);
    }

    res.status(201).json({
      order: order.toPublic(),
      whatsappUrl,
    });
  } catch (err) {
    console.error("Create order error", err);
    res.status(500).json({ error: "Could not create order" });
  }
});

/** Admin: list all orders with customer details (must be before /:id) */
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await Order.find(filter)
      .populate("customer", "name email phone address createdAt lastLoginAt")
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({
      orders: orders.map((o) => {
        const pub = o.toPublic();
        const live = o.customer && o.customer._id ? o.customer : null;
        return {
          ...pub,
          customerId: live ? live._id.toString() : o.customer?.toString?.() || "",
          customerDetails: {
            name: (live && live.name) || pub.customer?.name || "",
            email: (live && live.email) || pub.customer?.email || "",
            phone: (live && live.phone) || pub.customer?.phone || "",
            address: (live && live.address) || pub.shippingAddress || {},
            accountCreatedAt: live ? live.createdAt : null,
            lastLoginAt: live ? live.lastLoginAt : null,
          },
        };
      }),
    });
  } catch (err) {
    console.error("Admin orders list error", err);
    res.status(500).json({ error: "Could not load orders" });
  }
});

/** Admin: update status */
router.patch("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const order =
      (await Order.findOne({ orderNumber: req.params.id })) ||
      (await Order.findById(req.params.id).catch(() => null));
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.body.status) {
      const allowed = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      order.status = req.body.status;
    }
    if (req.body.paymentStatus) {
      const allowedPay = ["unpaid", "paid", "refunded"];
      if (!allowedPay.includes(req.body.paymentStatus)) {
        return res.status(400).json({ error: "Invalid payment status" });
      }
      order.paymentStatus = req.body.paymentStatus;
    }
    await order.save();
    res.json({ order: order.toPublic() });
  } catch (err) {
    res.status(500).json({ error: "Could not update order" });
  }
});

/** Customer order history */
router.get("/", requireCustomer, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.customer.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ orders: orders.map((o) => o.toPublic()) });
  } catch (err) {
    res.status(500).json({ error: "Could not load orders" });
  }
});

router.get("/:id", requireCustomer, async (req, res) => {
  try {
    const order =
      (await Order.findOne({
        customer: req.customer.id,
        orderNumber: req.params.id,
      })) ||
      (await Order.findOne({
        customer: req.customer.id,
        _id: req.params.id,
      }).catch(() => null));
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order: order.toPublic() });
  } catch (err) {
    res.status(500).json({ error: "Could not load order" });
  }
});

module.exports = router;
