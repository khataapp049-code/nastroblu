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

const CACHE_MS = 30 * 60 * 1000; // 30 minutes — keep the homepage close to Google

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

function looksLikePlaceId(id) {
  const s = String(id || "").trim();
  if (!s || s.startsWith("AIza")) return false;
  return /^ChIJ[A-Za-z0-9_-]+$/.test(s) || s.startsWith("places/");
}

async function fetchFromGooglePlaces() {
  const key = config.googleMapsApiKey;
  if (!key) {
    console.warn("Google reviews: no GOOGLE_MAPS_API_KEY in .env");
    return null;
  }

  let placeId = looksLikePlaceId(config.googlePlaceId) ? config.googlePlaceId.trim() : "";
  if (placeId.startsWith("places/")) placeId = placeId.slice("places/".length);

  if (!placeId) {
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({ textQuery: "NASTRO BLU Bagh Amberpet Hyderabad" }),
    });
    const searchData = await searchRes.json();
    if (searchData.error) {
      console.warn("Google Places search failed:", searchData.error.message || searchData.error.status);
      return null;
    }
    placeId = searchData.places && searchData.places[0] && searchData.places[0].id;
    if (placeId && placeId.startsWith("places/")) placeId = placeId.slice("places/".length);
    if (!placeId) return null;
  }

  const detailsRes = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId), {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "id,displayName,rating,userRatingCount,formattedAddress,googleMapsUri,reviews",
    },
  });
  const result = await detailsRes.json();
  if (result.error) {
    console.warn("Google Places details failed:", result.error.message || result.error.status);
    return null;
  }
  if (result.rating == null && !(result.reviews && result.reviews.length)) return null;

  const reviews = (result.reviews || []).map((r) => ({
    authorName: (r.authorAttribution && r.authorAttribution.displayName) || "Google user",
    rating: r.rating,
    relativeTime: r.relativePublishTimeDescription || "",
    text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || "",
    profilePhotoUrl: (r.authorAttribution && r.authorAttribution.photoUri) || "",
  }));

  const fallback = loadFallback();
  return shapePayload(
    {
      placeName: (result.displayName && result.displayName.text) || "NASTRO BLU",
      address: result.formattedAddress,
      rating: result.rating,
      userRatingsTotal: result.userRatingCount,
      mapsUrl: result.googleMapsUri || fallback.mapsUrl,
      reviewsUrl: fallback.reviewsUrl,
      writeReviewUrl: fallback.writeReviewUrl,
      reviews,
    },
    true
  );
}

router.get("/", async (req, res) => {
  try {
    const now = Date.now();
    const force = req.query.refresh === "1";
    if (!force && cache.data && now - cache.at < CACHE_MS) {
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
