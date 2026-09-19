/** Shared input sanitization for API writes */

function stripTags(s) {
  return String(s == null ? "" : s)
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

function cleanText(s, maxLen) {
  const out = stripTags(s);
  if (maxLen && out.length > maxLen) return out.slice(0, maxLen);
  return out;
}

function cleanName(s) {
  // Letters, numbers, spaces, and common name punctuation only
  return cleanText(s, 80)
    .replace(/[^\p{L}\p{N}\s.'’-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidPrice(n) {
  return Number.isFinite(n) && n >= 0 && n <= 1e7;
}

function isSafeImagePath(image) {
  const s = String(image || "").trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return false;
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (_e) {
      return false;
    }
  }
  // Relative asset paths only
  return /^(assets\/|\/assets\/)/i.test(s) && !s.includes("..");
}

module.exports = {
  stripTags,
  cleanText,
  cleanName,
  isValidPrice,
  isSafeImagePath,
};
