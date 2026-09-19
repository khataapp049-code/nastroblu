const express = require("express");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

function formatCustomer(c, extras = {}) {
  const a = c.address || {};
  return {
    id: c._id.toString(),
    name: c.name,
    email: c.email,
    phone: c.phone || "",
    address: {
      line1: a.line1 || "",
      line2: a.line2 || "",
      city: a.city || "",
      state: a.state || "",
      pincode: a.pincode || "",
    },
    isActive: c.isActive !== false,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastLoginAt: c.lastLoginAt || null,
    orderCount: extras.orderCount || 0,
    orderTotal: extras.orderTotal || 0,
    wishlistCount: extras.wishlistCount || 0,
  };
}

/** Admin: full customer database */
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const filter = {};
    if (req.query.active === "1") filter.isActive = true;
    if (req.query.active === "0") filter.isActive = false;
    if (q) {
      filter.$or = [
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { phone: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      ];
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();
    const ids = customers.map((c) => c._id);

    const [orderAgg, wishAgg] = await Promise.all([
      Order.aggregate([
        { $match: { customer: { $in: ids } } },
        {
          $group: {
            _id: "$customer",
            orderCount: { $sum: 1 },
            orderTotal: { $sum: "$total" },
          },
        },
      ]),
      Wishlist.aggregate([
        { $match: { customer: { $in: ids } } },
        { $group: { _id: "$customer", wishlistCount: { $sum: 1 } } },
      ]),
    ]);

    const orderMap = new Map(
      orderAgg.map((r) => [String(r._id), { orderCount: r.orderCount, orderTotal: r.orderTotal }])
    );
    const wishMap = new Map(wishAgg.map((r) => [String(r._id), r.wishlistCount]));

    const list = customers.map((c) => {
      const o = orderMap.get(String(c._id)) || { orderCount: 0, orderTotal: 0 };
      return formatCustomer(c, {
        orderCount: o.orderCount,
        orderTotal: o.orderTotal,
        wishlistCount: wishMap.get(String(c._id)) || 0,
      });
    });

    res.json({
      customers: list,
      meta: {
        total: list.length,
        active: list.filter((c) => c.isActive).length,
        withOrders: list.filter((c) => c.orderCount > 0).length,
      },
    });
  } catch (err) {
    console.error("Admin customers list error", err);
    res.status(500).json({ error: "Could not load customers" });
  }
});

/** Admin: one customer with recent orders + wishlist */
router.get("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const [orders, wishRows, orderStats] = await Promise.all([
      Order.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(25),
      Wishlist.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
      Order.aggregate([
        { $match: { customer: customer._id } },
        {
          $group: {
            _id: null,
            orderCount: { $sum: 1 },
            orderTotal: { $sum: "$total" },
          },
        },
      ]),
    ]);

    const slugs = wishRows.map((w) => w.productSlug);
    const products = await Product.find({ slug: { $in: slugs } })
      .select("slug name price image status")
      .lean();
    const bySlug = new Map(products.map((p) => [p.slug, p]));

    const stats = orderStats[0] || { orderCount: 0, orderTotal: 0 };

    res.json({
      customer: formatCustomer(customer, {
        orderCount: stats.orderCount,
        orderTotal: stats.orderTotal,
        wishlistCount: wishRows.length,
      }),
      orders: orders.map((o) => (o.toPublic ? o.toPublic() : o)),
      wishlist: wishRows.map((w) => {
        const p = bySlug.get(w.productSlug);
        return {
          productSlug: w.productSlug,
          addedAt: w.createdAt,
          name: p ? p.name : w.productSlug,
          price: p ? p.price : null,
          image: p ? p.image : "",
          status: p ? p.status || "available" : "missing",
        };
      }),
    });
  } catch (err) {
    console.error("Admin customer detail error", err);
    res.status(500).json({ error: "Could not load customer" });
  }
});

/** Admin: activate / deactivate account */
router.patch("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (typeof req.body.isActive === "boolean") {
      customer.isActive = req.body.isActive;
    }
    await customer.save();

    const [orderCount, wishlistCount, orderTotalAgg] = await Promise.all([
      Order.countDocuments({ customer: customer._id }),
      Wishlist.countDocuments({ customer: customer._id }),
      Order.aggregate([
        { $match: { customer: customer._id } },
        { $group: { _id: null, orderTotal: { $sum: "$total" } } },
      ]),
    ]);

    res.json({
      customer: formatCustomer(customer.toObject ? customer.toObject() : customer, {
        orderCount,
        orderTotal: (orderTotalAgg[0] && orderTotalAgg[0].orderTotal) || 0,
        wishlistCount,
      }),
    });
  } catch (err) {
    console.error("Admin customer patch error", err);
    res.status(500).json({ error: "Could not update customer" });
  }
});

module.exports = router;
