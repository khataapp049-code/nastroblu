const express = require("express");
const Product = require("../models/Product");
const ProductReview = require("../models/ProductReview");
const { requireCustomer, optionalCustomer } = require("../middleware/customerAuth");

const router = express.Router();

function stripTags(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

async function syncProductRating(productSlug) {
  const [agg] = await ProductReview.aggregate([
    { $match: { productSlug } },
    {
      $group: {
        _id: null,
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const product = await Product.findOne({ slug: productSlug });
  if (!product) return { rating: 0, reviews: 0 };
  if (!agg || !agg.count) {
    product.rating = 0;
    product.reviews = 0;
  } else {
    product.rating = Math.round(agg.avg * 10) / 10;
    product.reviews = agg.count;
  }
  await product.save();
  return { rating: product.rating, reviews: product.reviews };
}

/** List reviews for a product */
router.get("/", optionalCustomer, async (req, res) => {
  try {
    const productSlug = String(req.query.product || req.query.productId || "").trim();
    if (!productSlug) return res.status(400).json({ error: "product is required" });

    const reviews = await ProductReview.find({ productSlug })
      .sort({ createdAt: -1 })
      .limit(100);

    let mine = null;
    if (req.customer) {
      mine = reviews.find((r) => String(r.customer) === String(req.customer.id)) || null;
    }

    res.json({
      productSlug,
      reviews: reviews.map((r) => r.toPublic()),
      mine: mine ? mine.toPublic() : null,
    });
  } catch (err) {
    console.error("List reviews error", err);
    res.status(500).json({ error: "Could not load reviews" });
  }
});

/** Create or update own review (login required) */
router.post("/", requireCustomer, async (req, res) => {
  try {
    const productSlug = String(req.body.productId || req.body.product || "").trim();
    const rating = Number(req.body.rating);
    const comment = stripTags(req.body.comment || "");

    if (!productSlug) return res.status(400).json({ error: "Product is required" });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    if (comment.length < 10) {
      return res.status(400).json({ error: "Please write at least 10 characters" });
    }
    if (comment.length > 1200) {
      return res.status(400).json({ error: "Review is too long" });
    }

    const product = await Product.findOne({ slug: productSlug });
    if (!product || product.status === "archived") {
      return res.status(404).json({ error: "Product not found" });
    }

    const Customer = require("../models/Customer");
    const customer = await Customer.findById(req.customer.id);
    if (!customer || !customer.isActive) {
      return res.status(401).json({ error: "Login required" });
    }

    const review = await ProductReview.findOneAndUpdate(
      { productSlug, customer: customer._id },
      {
        productSlug,
        customer: customer._id,
        customerName: stripTags(customer.name).slice(0, 80) || "Customer",
        rating: Math.round(rating),
        comment,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const summary = await syncProductRating(productSlug);
    res.status(201).json({
      review: review.toPublic(),
      summary,
    });
  } catch (err) {
    console.error("Save review error", err);
    res.status(500).json({ error: "Could not save review" });
  }
});

/** Delete own review */
router.delete("/", requireCustomer, async (req, res) => {
  try {
    const productSlug = String(req.query.product || req.body.productId || "").trim();
    if (!productSlug) return res.status(400).json({ error: "product is required" });
    await ProductReview.deleteOne({ productSlug, customer: req.customer.id });
    const summary = await syncProductRating(productSlug);
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ error: "Could not delete review" });
  }
});

module.exports = router;
