const fs = require("fs");
const path = require("path");
const express = require("express");
const config = require("../config");

const router = express.Router();

const FALLBACK_PATH = path.join(__dirname, "../data/google-reviews.json");

let cache = {
  at: 0,
  data: null,
};

const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

function loadFallback() {
  const raw = fs.readFileSync(FALLBACK_PATH, "utf8");
  return JSON.parse(raw);
}

function shapePayload(source, fromApi) {
  const reviews = (source.reviews || []).slice(0, 6).map((r) => ({
    authorName: r.authorName || r.author_name || "Google user",
    rating: Number(r.rating || 5),
    relativeTime: r.relativeTime || r.relative_time_description || "",
    text: r.text || "",
    profilePhotoUrl: r.profilePhotoUrl || r.profile_photo_url || "",
  }));
  return {
    placeName: source.placeName || source.name || "NASTRO BLU",
    address: source.address || source.formatted_address || "",
    rating: Number(source.rating || 0),
    userRatingsTotal: Number(source.userRatingsTotal || source.user_ratings_total || 0),
    mapsUrl: source.mapsUrl || config.googleMapsUrl,
    reviewsUrl: source.reviewsUrl || config.googleReviewsUrl,
    writeReviewUrl: source.writeReviewUrl || config.googleWriteReviewUrl,
    reviews,
    source: fromApi ? "google" : "cached",
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchFromGooglePlaces() {
  const key = config.googleMapsApiKey;
  if (!key) return null;

  let placeId = config.googlePlaceId;
  if (!placeId) {
    const findUrl =
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?" +
      new URLSearchParams({
        input: "NASTRO BLU Bagh Amberpet Hyderabad",
        inputtype: "textquery",
        fields: "place_id,name,rating,user_ratings_total",
        key,
      });
    const findRes = await fetch(findUrl);
    const findData = await findRes.json();
    placeId = findData.candidates && findData.candidates[0] && findData.candidates[0].place_id;
    if (!placeId) return null;
  }

  const detailsUrl =
    "https://maps.googleapis.com/maps/api/place/details/json?" +
    new URLSearchParams({
      place_id: placeId,
      fields: "name,rating,user_ratings_total,formatted_address,url,reviews",
      reviews_sort: "newest",
      key,
    });
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();
  if (!detailsData.result) return null;

  const result = detailsData.result;
  const fallback = loadFallback();
  return shapePayload(
    {
      placeName: result.name,
      address: result.formatted_address,
      rating: result.rating,
      userRatingsTotal: result.user_ratings_total,
      mapsUrl: result.url || fallback.mapsUrl,
      reviewsUrl: fallback.reviewsUrl,
      writeReviewUrl: fallback.writeReviewUrl,
      reviews: result.reviews || fallback.reviews,
    },
    true
  );
}

router.get("/", async (_req, res) => {
  try {
    const now = Date.now();
    if (cache.data && now - cache.at < CACHE_MS) {
      return res.json(cache.data);
    }

    let payload = null;
    try {
      payload = await fetchFromGooglePlaces();
    } catch (err) {
      console.warn("Google Places fetch failed, using fallback", err.message);
    }

    if (!payload) {
      payload = shapePayload(loadFallback(), false);
    }

    // If API returned rating but few/no reviews text, merge featured fallback texts
    if (payload.source === "google" && (!payload.reviews || payload.reviews.length < 3)) {
      const fb = loadFallback();
      payload.reviews = shapePayload(fb, false).reviews;
      if (!payload.rating) payload.rating = fb.rating;
      if (!payload.userRatingsTotal) payload.userRatingsTotal = fb.userRatingsTotal;
    }

    cache = { at: now, data: payload };
    res.json(payload);
  } catch (err) {
    console.error("Google reviews error", err);
    try {
      res.json(shapePayload(loadFallback(), false));
    } catch (e) {
      res.status(500).json({ error: "Could not load Google reviews" });
    }
  }
});

module.exports = router;
