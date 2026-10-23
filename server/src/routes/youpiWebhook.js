const crypto = require("crypto");
const express = require("express");
const Order = require("../models/Order");
const config = require("../config");
const { requireCustomer } = require("../middleware/customerAuth");

const router = express.Router();

/** Public, non-secret settings the storefront needs to open the YouPI checkout. */
router.get("/config", (_req, res) => {
  const enabled = !!(config.youpiHost && config.youpiPublicKey);
  res.set("Cache-Control", "no-store");
  res.json({
    enabled,
    host: enabled ? config.youpiHost : "",
    key: enabled ? config.youpiPublicKey : "",
  });
});

/**
 * Browser talks only to Nastro Blu. We create the YouPI session on the server
 * so Chrome CSP / CORS on :7000 cannot block the Pay button.
 */
router.post("/start", express.json({ limit: "32kb" }), requireCustomer, async (req, res) => {
  try {
    if (!config.youpiHost || !config.youpiPublicKey) {
      return res.status(503).json({ error: "Online payment is not available right now" });
    }
    const orderNumber = String(req.body.orderNumber || "").trim();
    if (!orderNumber) return res.status(400).json({ error: "Missing order" });

    const order = await Order.findOne({ customer: req.customer.id, orderNumber });
    if (!order || order.paymentMethod !== "upi_youpi") {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.paymentStatus === "paid") {
      return res.json({ alreadyPaid: true });
    }

    const cust = order.customerSnapshot || {};
    const returnUrl =
      `${req.protocol}://${req.get("host")}/order-confirmation.html?order=` +
      encodeURIComponent(order.orderNumber);
    const r = await fetch(`${config.youpiHost}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Merchant-Id": config.youpiPublicKey,
      },
      body: JSON.stringify({
        orderId: order.orderNumber,
        amount: Number(order.total).toFixed(2),
        currency: "INR",
        description: "Nastro Blu " + order.orderNumber,
        customer: {
          fullName: cust.name || "",
          email: cust.email || "",
          phoneNumber: cust.phone || "",
        },
        returnUrl,
        metadata: { source: "nastroblu-web" },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.checkoutUrl) {
      console.error("YouPI start failed", r.status, data.error || data.message);
      return res.status(502).json({
        error: data.error || "Could not start UPI checkout. Keep YouPI running on port 7000.",
      });
    }
    res.json({ checkoutUrl: data.checkoutUrl, paymentId: data.paymentId || "" });
  } catch (err) {
    console.error("YouPI start error", err.message || err);
    res.status(502).json({ error: "Could not reach YouPI. Keep it running on port 7000." });
  }
});

/**
 * YouPI-PG server-to-server webhook. This is the ONLY thing that marks an order paid.
 * Mounted BEFORE express.json() in index.js: the HMAC must be computed over the raw bytes.
 */
router.post("/webhook", express.raw({ type: "*/*", limit: "100kb" }), async (req, res) => {
  try {
    if (!config.youpiWebhookSecret) {
      return res.status(503).json({ error: "Webhook not configured" });
    }
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || !raw.length) {
      return res.status(400).json({ error: "Empty body" });
    }

    const got = Buffer.from(String(req.headers["x-gateway-signature"] || ""));
    const want = Buffer.from(
      "sha256=" + crypto.createHmac("sha256", config.youpiWebhookSecret).update(raw).digest("hex")
    );
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    let payload;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch (e) {
      return res.status(400).json({ error: "Bad JSON" });
    }

    // COD / counter events also arrive as SUCCESS: only a real UPI payment counts as paid.
    if (payload.event !== "SUCCESS" || payload.method !== "UPI") {
      return res.json({ received: true, ignored: "not_a_upi_success" });
    }

    const order = await Order.findOne({ orderNumber: String(payload.orderId || "") });
    if (!order || order.paymentMethod !== "upi_youpi") {
      console.warn("YouPI webhook for unknown order", payload.orderId);
      return res.json({ received: true, ignored: "unknown_order" });
    }

    // The amount must match what we priced on the server, to the paisa.
    const expectedPaise = Math.round(order.total * 100);
    if (Number(payload.amountPaise) !== expectedPaise) {
      console.warn(
        `YouPI amount mismatch on ${order.orderNumber}: expected ${expectedPaise}, got ${payload.amountPaise}. Check manually.`
      );
      return res.json({ received: true, ignored: "amount_mismatch" });
    }

    // Atomic + idempotent: only the first delivery flips unpaid -> paid.
    const set = {
      paymentStatus: "paid",
      "payment.gateway": "youpi",
      "payment.paymentId": String(payload.paymentId || ""),
      "payment.utr": String(payload.utr || ""),
      "payment.amountPaise": expectedPaise,
      "payment.paidAt": payload.completedAt ? new Date(payload.completedAt) : new Date(),
    };
    if (order.status === "pending") set.status = "confirmed";

    await Order.updateOne({ _id: order._id, paymentStatus: "unpaid" }, { $set: set });
    res.json({ received: true });
  } catch (err) {
    console.error("YouPI webhook error", err);
    res.status(500).json({ error: "Webhook failed" }); // gateway will retry
  }
});

module.exports = router;