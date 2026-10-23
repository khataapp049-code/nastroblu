const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { requireCustomer } = require("../middleware/customerAuth");
const { requireAdmin } = require("../middleware/auth");
const { validateShipping } = require("../deliveryValidate");
const { verifyAddress, publicLookup } = require("../pincodeLookup");
const config = require("../config");

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
    `Hi Nastro Blu! I've placed order ${order.orderNumber}:`,
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
  const who = a.name || (order.customerSnapshot && order.customerSnapshot.name) || "";
  const phone = a.phone || (order.customerSnapshot && order.customerSnapshot.phone) || "";
  if (who || phone) lines.push(`Deliver to: ${[who, phone].filter(Boolean).join(" · ")}`);
  const addr = [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ");
  if (addr) lines.push(`Address: ${addr}`);
  lines.push("Delivery charges applicable — please confirm the amount.");
  if (order.notes) {
    lines.push("");
    lines.push("Note: " + order.notes);
  }
  lines.push("");
  lines.push("Please confirm availability and the delivery charges.");
  return lines.join("\n");
}

/** Re-price cart rows from the database. Returns { items } or { status, error }. */
async function buildItems(rawItems) {
  if (!rawItems.length) return { status: 400, error: "Cart is empty" };
  if (rawItems.length > 50) return { status: 400, error: "Too many items in cart" };

  const items = [];
  for (const row of rawItems) {
    const productId = String(row.productId || row.id || "").trim();
    const qty = Math.max(1, Math.min(99, Number(row.qty) || 1));
    const sizeLabel = String(row.size || "").trim();
    if (!productId) continue;

    const product =
      (await Product.findOne({ slug: productId })) ||
      (await Product.findById(productId).catch(() => null));
    if (!product) return { status: 400, error: `Product not found: ${productId}` };
    const status = product.status || (product.active === false ? "unavailable" : "available");
    if (status !== "available") {
      return { status: 400, error: `${product.name} is currently unavailable` };
    }

    let unitPrice = Number(product.price) || 0;
    let size = sizeLabel || product.netQuantity || product.unit || "1 pack";
    if (Array.isArray(product.sizes) && product.sizes.length) {
      const match = product.sizes.find((s) => s.label === sizeLabel) || product.sizes[0];
      if (match) {
        unitPrice = Number(match.price != null ? match.price : product.price) || 0;
        size = match.label || size;
      }
    }
    if (unitPrice <= 0) return { status: 400, error: `${product.name} has no valid price` };

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
  if (!items.length) return { status: 400, error: "No valid items to order" };
  return { items };
}

/** Validate the delivery address. PIN/city/state lookup is optional so a slow
 *  India Post request cannot hang checkout. */
async function checkAddress(body, { lookup = true } = {}) {
  const shipCheck = validateShipping(body);
  if (shipCheck.error) return { error: shipCheck.error, fields: shipCheck.fields || {} };
  const a = shipCheck.value;
  if (!lookup) return { address: a, verified: false };
  try {
    const match = await Promise.race([
      verifyAddress(a.pincode, a.city, a.state),
      new Promise((resolve) => setTimeout(() => resolve({ ok: true, verified: false }), 2500)),
    ]);
    if (!match.ok) return { error: match.error, fields: { pincode: match.error } };
    return { address: a, verified: !!match.verified };
  } catch (err) {
    return { address: a, verified: false };
  }
}

/** Preview: re-prices the cart and validates the address, but creates no order. */
router.post("/preview", requireCustomer, async (req, res) => {
  try {
    const built = await buildItems(Array.isArray(req.body.items) ? req.body.items : []);
    if (built.error) return res.status(built.status).json({ error: built.error });

    const addr = await checkAddress(req.body, { lookup: false });
    if (addr.error) return res.status(400).json({ error: addr.error, fields: addr.fields });

    const subtotal = built.items.reduce((s, i) => s + i.lineTotal, 0);
    res.json({
      items: built.items,
      subtotal,
      total: subtotal,
      shippingAddress: addr.address,
      notes: String(req.body.notes || "").trim().slice(0, 500),
    });
  } catch (err) {
    console.error("Order preview error", err);
    res.status(500).json({ error: "Could not prepare your order" });
  }
});

/** Create order from cart - prices revalidated from DB */
router.post("/", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer || customer.isActive === false) {
      return res.status(401).json({ error: "Login required" });
    }

    const built = await buildItems(Array.isArray(req.body.items) ? req.body.items : []);
    if (built.error) return res.status(built.status).json({ error: built.error });
    const items = built.items;

    const addr = await checkAddress(req.body);
    if (addr.error) return res.status(400).json({ error: addr.error, fields: addr.fields });
    const shippingAddress = addr.address;

    if (req.body.saveAddress) {
      customer.phone = shippingAddress.phone;
      customer.address = {
        line1: shippingAddress.line1,
        line2: shippingAddress.line2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
      };
      await customer.save();
    }

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

    // "upi" = pay online through YouPI-PG; anything else keeps the WhatsApp / COD flow.
    const payOnline = String(req.body.paymentMethod || "") === "upi";
    if (payOnline && !(config.youpiHost && config.youpiPublicKey)) {
      return res.status(400).json({ error: "Online payment is not available right now" });
    }

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
      paymentMethod: payOnline ? "upi_youpi" : "whatsapp_cod",
      channel: payOnline ? "web" : "whatsapp",
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

/** Public PIN lookup: used by the delivery form to auto-fill city/state. */
router.get("/pincode/:pin", async (req, res) => {
  const pin = String(req.params.pin || "").replace(/\D/g, "");
  if (!/^[1-9]\d{5}$/.test(pin)) {
    return res.status(400).json({ ok: false, error: "Enter a valid 6-digit PIN code" });
  }
  try {
    const result = await publicLookup(pin);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    res.json({ ok: true, verified: false });
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

/** Customer tapped Send on WhatsApp — mark this order confirmed and stay on the same page. */
router.post("/:id/whatsapp-sent", requireCustomer, async (req, res) => {
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
    if (order.status === "cancelled") {
      return res.status(400).json({ error: "This order was cancelled" });
    }
    // A UPI order is confirmed by the verified payment webhook, never by a WhatsApp tap.
    if (order.paymentMethod === "upi_youpi" && order.paymentStatus !== "paid") {
      return res.json({ order: order.toPublic() });
    }
    if (order.status === "pending") {
      order.status = "confirmed";
      await order.save();
    }
    res.json({ order: order.toPublic() });
  } catch (err) {
    console.error("WhatsApp sent update error", err);
    res.status(500).json({ error: "Could not update order" });
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