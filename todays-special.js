/**
 * Today's Special storefront popup — controlled from Admin → Today's Special
 */
(function () {
  var DISMISS_KEY = "nb-special-dismissed";
  var root = null;
  var current = null;

  function todayKey() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function wasDismissedToday() {
    try {
      return localStorage.getItem(DISMISS_KEY) === todayKey();
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, todayKey());
    } catch (e) {}
  }

  function imgUrl(path) {
    if (!path) return "";
    return path.charAt(0) === "/" ? path : "/" + path;
  }

  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }

  function findInCatalog(id) {
    var catalog = window.NASTRO_CATALOG || {};
    var list = catalog.products || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function addProductToCart(productId) {
    if (window.Nastro && typeof window.Nastro.addToCart === "function") {
      window.Nastro.addToCart(productId, 0, 1);
      if (typeof window.Nastro.updateCartBadges === "function") {
        window.Nastro.updateCartBadges();
      }
      return true;
    }
    if (typeof window.__nastroAddToCart === "function") {
      window.__nastroAddToCart(productId);
      return true;
    }
    // Fallback: write same cart shape as app.js / shared.js
    var p = findInCatalog(productId);
    if (!p || !p.sizes || !p.sizes.length) return false;
    var size = p.sizes[0];
    var key = p.id + "::" + size.label;
    var cart = [];
    try {
      cart = JSON.parse(localStorage.getItem("nastro-cart") || "[]");
    } catch (e) {
      cart = [];
    }
    var existing = cart.find(function (i) {
      return i.key === key;
    });
    if (existing) existing.qty += 1;
    else {
      cart.push({
        key: key,
        id: p.id,
        name: p.name,
        size: size.label,
        price: size.price,
        image: p.image,
        qty: 1,
      });
    }
    localStorage.setItem("nastro-cart", JSON.stringify(cart));
    var count = cart.reduce(function (s, i) {
      return s + i.qty;
    }, 0);
    document.querySelectorAll("#cartCount, [data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
    });
    return true;
  }

  function closeSpecial(persistDay) {
    if (!root) return;
    root.classList.remove("is-open");
    document.body.classList.remove("nb-special-open");
    if (persistDay && current && current.showOncePerDay !== false) {
      markDismissed();
    }
  }

  function ensureDom() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "todaysSpecial";
    root.className = "todays-special";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "todaysSpecialTitle");
    root.innerHTML =
      '<div class="todays-special__scrim" data-special-close="1"></div>' +
      '<div class="todays-special__card">' +
      '<button type="button" class="todays-special__close" data-special-close="1" aria-label="Close">×</button>' +
      '<div class="todays-special__media">' +
      '<span class="todays-special__badge" id="todaysSpecialBadge">Today\'s Special</span>' +
      '<img id="todaysSpecialImg" alt="" />' +
      '<div class="todays-special__shine" aria-hidden="true"></div>' +
      "</div>" +
      '<div class="todays-special__body">' +
      '<p class="todays-special__eyebrow">Nastro Blu · Eat Better</p>' +
      '<h2 id="todaysSpecialTitle"></h2>' +
      '<p class="todays-special__desc" id="todaysSpecialDesc"></p>' +
      '<div class="todays-special__price" id="todaysSpecialPrice"></div>' +
      '<div class="todays-special__actions">' +
      '<button type="button" class="todays-special__cta" id="todaysSpecialCta">Add to cart</button>' +
      '<button type="button" class="todays-special__later" data-special-close="1">Maybe later</button>' +
      "</div>" +
      "</div>" +
      "</div>";
    document.body.appendChild(root);

    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-special-close]")) {
        closeSpecial(true);
      }
    });

    var cta = document.getElementById("todaysSpecialCta");
    cta.addEventListener("click", function () {
      if (!current || !current.productId || !current.available) return;
      var ok = addProductToCart(current.productId);
      if (ok) {
        closeSpecial(true);
        var toast = document.getElementById("toast");
        if (toast) {
          toast.textContent = (current.productName || current.title) + " added to cart";
          toast.classList.add("show");
          clearTimeout(toast._specialTimer);
          toast._specialTimer = setTimeout(function () {
            toast.classList.remove("show");
          }, 2200);
        }
        var cartBtn = document.getElementById("cartBtn");
        if (cartBtn) cartBtn.click();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && root.classList.contains("is-open")) {
        closeSpecial(true);
      }
    });

    return root;
  }

  function openSpecial(special) {
    current = special;
    ensureDom();
    document.getElementById("todaysSpecialBadge").textContent = special.badge || "Today's Special";
    document.getElementById("todaysSpecialTitle").textContent = special.title;
    document.getElementById("todaysSpecialDesc").textContent = special.description || "";
    var img = document.getElementById("todaysSpecialImg");
    img.src = imgUrl(special.image);
    img.alt = special.title;

    var priceEl = document.getElementById("todaysSpecialPrice");
    if (special.available && special.price != null) {
      var html = "<strong>" + inr(special.price) + "</strong>";
      if (special.mrp && special.mrp > special.price) {
        html += ' <span class="was">' + inr(special.mrp) + "</span>";
      }
      if (special.unit) html += ' <span class="unit">' + special.unit + "</span>";
      priceEl.innerHTML = html;
      priceEl.hidden = false;
    } else {
      priceEl.innerHTML = "";
      priceEl.hidden = true;
    }

    var cta = document.getElementById("todaysSpecialCta");
    cta.textContent = special.ctaLabel || "Add to cart";
    cta.disabled = !special.available;
    if (!special.available) cta.textContent = "Currently unavailable";

    root.classList.add("is-open");
    document.body.classList.add("nb-special-open");
    // trigger entrance animation
    requestAnimationFrame(function () {
      root.classList.add("is-visible");
    });
  }

  function afterDelivery(fn) {
    // Wait for delivery popup to finish (or skip if already dismissed / script absent)
    if (window.NastroDeliveryInfo && typeof window.NastroDeliveryInfo.whenDone === "function") {
      window.NastroDeliveryInfo.whenDone(fn);
      return;
    }
    if (window.__nastroDeliveryDone) {
      fn();
      return;
    }
    var fired = false;
    function once() {
      if (fired) return;
      fired = true;
      fn();
    }
    window.addEventListener("nastroblu:delivery-done", once, { once: true });
    // Fallback: if delivery script is missing or never signals, still show special
    setTimeout(once, 5000);
  }

  async function initTodaysSpecial() {
    try {
      var res = await fetch("/api/special/today", { credentials: "same-origin" });
      if (!res.ok) return;
      var data = await res.json();
      var special = data && data.special;
      if (!special) return;
      if (special.showOncePerDay !== false && wasDismissedToday()) return;
      // Delivery popup first, then Today's Special (as usual)
      afterDelivery(function () {
        setTimeout(function () {
          openSpecial(special);
        }, 450);
      });
    } catch (e) {
      /* silent — storefront still works */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(initTodaysSpecial, 200);
    });
  } else {
    setTimeout(initTodaysSpecial, 200);
  }

  window.initTodaysSpecial = initTodaysSpecial;
})();
