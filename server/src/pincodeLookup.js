/**
 * PIN code lookup (India Post public API) + city/state matching.
 * Runs on the server so the browser never calls a third-party site.
 * If the lookup service is down or slow we do NOT block the order: the result
 * is { status: "unavailable" } and the caller accepts the address as unverified.
 */
const URL_BASE = "https://api.postalpincode.in/pincode/";
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function norm(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function lookupPincode(pin) {
  const p = String(pin || "").replace(/\D/g, "");
  const hit = cache.get(p);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value;
  try {
    if (typeof fetch !== "function") return { status: "unavailable" };
    let signal;
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      signal = AbortSignal.timeout(4000);
    } else if (typeof AbortController !== "undefined") {
      const ac = new AbortController();
      setTimeout(function () {
        ac.abort();
      }, 4000);
      signal = ac.signal;
    }
    const res = await fetch(URL_BASE + p, signal ? { signal: signal } : {});
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : null;
    const offices = row && Array.isArray(row.PostOffice) ? row.PostOffice : [];
    if (row && row.Status === "Success" && offices.length) {
      const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
      value = {
        status: "ok",
        state: offices[0].State || "",
        district: offices[0].District || "",
        places: uniq(offices.map((o) => o.Name)),
        areas: uniq(
          offices.reduce((acc, o) => acc.concat([o.Name, o.Block, o.District]), [])
        ),
      };
    } else if (row && (row.Status === "Error" || row.Status === "404")) {
      value = { status: "notfound" };
    } else {
      throw new Error("Unexpected response");
    }
  } catch (err) {
    return { status: "unavailable" }; // not cached: try again next time
  }
  cache.set(p, { at: Date.now(), value });
  return value;
}

function cityMatches(city, info) {
  const c = norm(city);
  if (!c) return false;
  return info.areas.some((a) => {
    const n = norm(a);
    if (!n) return false;
    if (n === c) return true;
    return Math.min(n.length, c.length) >= 4 && (n.includes(c) || c.includes(n));
  });
}

function stateMatches(state, info) {
  const a = norm(state);
  const b = norm(info.state);
  return !!a && (a === b || a.includes(b) || b.includes(a));
}

/** Used when an order is previewed or placed. */
async function verifyAddress(pin, city, state) {
  const info = await lookupPincode(pin);
  if (info.status === "unavailable") return { ok: true, verified: false };
  if (info.status === "notfound") {
    return { ok: false, error: "We couldn’t find this PIN code. Check it and try again." };
  }
  if (!stateMatches(state, info)) {
    return { ok: false, error: "This PIN code belongs to " + info.state + ". Check your state or PIN code." };
  }
  if (!cityMatches(city, info)) {
    return {
      ok: false,
      error:
        "This PIN code doesn’t match " + String(city).trim() + ". It belongs to " + info.district + ", " + info.state + ".",
    };
  }
  return { ok: true, verified: true };
}

/** Used by the PIN field on the delivery form (auto-fill). */
async function publicLookup(pin) {
  const info = await lookupPincode(pin);
  if (info.status === "unavailable") return { ok: true, verified: false };
  if (info.status === "notfound") {
    return { ok: false, error: "We couldn’t find this PIN code. Check it and try again." };
  }
  return {
    ok: true,
    verified: true,
    state: info.state,
    district: info.district,
    places: info.places,
    areas: info.areas,
  };
}

module.exports = { lookupPincode, verifyAddress, publicLookup, cityMatches, stateMatches };