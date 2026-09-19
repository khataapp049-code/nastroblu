/**
 * Homepage Google reviews block — rating + 5–6 reviews + verify link
 */
(function () {
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    var parts = String(name || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function stars(n) {
    var r = Math.round(Number(n) || 0);
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out += '<span class="' + (i <= r ? "is-on" : "") + '">★</span>';
    }
    return out;
  }

  function avatarHtml(r) {
    if (r.profilePhotoUrl) {
      return (
        '<img class="greview__avatar" src="' +
        escapeHtml(r.profilePhotoUrl) +
        '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
      );
    }
    return (
      '<span class="greview__avatar greview__avatar--initials" aria-hidden="true">' +
      escapeHtml(initials(r.authorName)) +
      "</span>"
    );
  }

  async function loadGoogleReviews() {
    var root = document.getElementById("googleReviews");
    if (!root) return;
    try {
      var res = await fetch("/api/google-reviews", { credentials: "same-origin" });
      if (!res.ok) throw new Error("fail");
      var data = await res.json();
      var rating = Number(data.rating || 0).toFixed(1);
      var total = Number(data.userRatingsTotal || 0).toLocaleString("en-IN");
      var reviewsUrl = data.reviewsUrl || data.mapsUrl || "#";
      var writeUrl = data.writeReviewUrl || reviewsUrl;

      var summary = document.getElementById("googleReviewsSummary");
      if (summary) {
        summary.innerHTML =
          '<div class="greviews__score">' +
          '<div class="greviews__score-num">' +
          escapeHtml(rating) +
          "</div>" +
          '<div class="greviews__score-stars" aria-label="' +
          escapeHtml(rating) +
          ' out of 5">' +
          stars(data.rating) +
          "</div>" +
          '<div class="greviews__score-count">' +
          escapeHtml(total) +
          " Google reviews</div>" +
          '<a class="greviews__verify" href="' +
          escapeHtml(reviewsUrl) +
          '" target="_blank" rel="noopener">Verify on Google</a>' +
          "</div>" +
          '<div class="greviews__brand">' +
          '<img src="assets/brand/Nastro Blu_Square Logo - JPEG.jpg" alt="" onerror="this.style.display=\'none\'" />' +
          "<div><strong>" +
          escapeHtml(data.placeName || "NASTRO BLU") +
          "</strong>" +
          "<span>Bagh Amberpet, Hyderabad</span>" +
          '<a class="btn btn--gold" href="' +
          escapeHtml(writeUrl) +
          '" target="_blank" rel="noopener">Write a review</a>' +
          "</div></div>";
      }

      var list = document.getElementById("googleReviewsList");
      if (list) {
        list.innerHTML = (data.reviews || [])
          .slice(0, 6)
          .map(function (r) {
            return (
              '<article class="greview">' +
              '<div class="greview__head">' +
              avatarHtml(r) +
              "<div>" +
              '<div class="greview__name">' +
              escapeHtml(r.authorName) +
              "</div>" +
              '<div class="greview__meta"><span class="greview__stars">' +
              stars(r.rating) +
              "</span> · " +
              escapeHtml(r.relativeTime || "") +
              "</div></div></div>" +
              '<p class="greview__text">' +
              escapeHtml(r.text) +
              "</p>" +
              '<a class="greview__source" href="' +
              escapeHtml(reviewsUrl) +
              '" target="_blank" rel="noopener">Posted on Google</a>' +
              "</article>"
            );
          })
          .join("");
      }
    } catch (e) {
      console.warn("Google reviews unavailable", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadGoogleReviews);
  } else {
    loadGoogleReviews();
  }
})();
