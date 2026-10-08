(function () {
  var state = { sizeIndex: 0, qty: 1, product: null, reviewRating: 5 };

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      t.classList.remove("show");
    }, 2200);
  }

  function customerHeaders() {
    var h = { "Content-Type": "application/json" };
    try {
      var token = localStorage.getItem("nb-customer-token") || "";
      if (token) h.Authorization = "Bearer " + token;
    } catch (e) {}
    return h;
  }

  function starsHtml(n, interactive) {
    var r = Math.round(Number(n) || 0);
    var html = "";
    for (var i = 1; i <= 5; i++) {
      if (interactive) {
        html +=
          '<button type="button" class="star-pick' +
          (i <= r ? " is-on" : "") +
          '" data-star="' +
          i +
          '" aria-label="' +
          i +
          ' stars">★</button>';
      } else {
        html += '<span class="' + (i <= r ? "is-on" : "") + '">★</span>';
      }
    }
    return html;
  }

  /* ---------- weights / sizes ---------- */

  // "500 g", "1 kg", "750 gms", "1/2 kg", "1 litre", "250 ml" -> { amount (g or ml), kind }
  function parseQty(label) {
    var s = String(label || "")
      .toLowerCase()
      .replace("½", "1/2")
      .replace("¼", "1/4")
      .replace("¾", "3/4");
    var m = s.match(
      /(\d+\s*\/\s*\d+|\d*\.?\d+)\s*(kgs?|kilograms?|gms?|grams?|g|ltr|litres?|liters?|l|ml)\b/
    );
    if (!m) return null;
    var num;
    if (m[1].indexOf("/") !== -1) {
      var f = m[1].split("/");
      num = Number(f[0]) / Number(f[1]);
    } else {
      num = Number(m[1]);
    }
    if (!isFinite(num) || num <= 0) return null;
    var u = m[2];
    if (u.charAt(0) === "k") return { amount: num * 1000, kind: "weight" };
    if (u === "ml") return { amount: num, kind: "volume" };
    if (u === "l" || u === "ltr" || u.indexOf("lit") === 0) {
      return { amount: num * 1000, kind: "volume" };
    }
    return { amount: num, kind: "weight" };
  }

  // MRP for one size. If the size has its own MRP use it, otherwise scale
  // the product MRP by price so 500 g gets half the MRP of 1 kg.
  function sizeMrp(p, size) {
    var own = Number(size && size.mrp);
    if (own > 0) return own;
    var pm = Number(p.mrp);
    var pp = Number(p.price);
    var sp = Number(size && size.price);
    if (pm > 0 && pp > 0 && sp >= 0) return Math.round((pm * sp) / pp);
    return pm > 0 ? pm : 0;
  }

  // Order chips smallest to largest when every size can be read as a weight
  // or volume. Values returned are real indexes into p.sizes.
  function displayOrder(sizes) {
    var idx = sizes.map(function (_, i) {
      return i;
    });
    var q = sizes.map(function (s) {
      return parseQty(s.label);
    });
    var first = q[0];
    var ok =
      first &&
      q.every(function (x) {
        return x && x.kind === first.kind;
      });
    if (!ok) return idx;
    idx.sort(function (a, b) {
      return q[a].amount - q[b].amount || a - b;
    });
    return idx;
  }

  function unitPriceText(size, count) {
    if (count < 2) return "";
    var q = parseQty(size.label);
    var price = Number(size.price);
    if (!q || !(price > 0)) return "";
    var per = Math.round(price / (q.amount / 1000));
    return Nastro.inr(per) + (q.kind === "volume" ? " per litre" : " per kg");
  }

  function currentSize() {
    var p = state.product;
    if (p && Array.isArray(p.sizes) && p.sizes.length) {
      return p.sizes[state.sizeIndex] || p.sizes[0];
    }
    return null;
  }

  function isUnavailable(p) {
    return (p.status || (p.active === false ? "unavailable" : "available")) === "unavailable";
  }

  function updateAddLabel(price) {
    var btn = document.getElementById("pdpAdd");
    if (!btn || btn.disabled) return;
    btn.textContent = price > 0 ? "Add to cart · " + Nastro.inr(price * state.qty) : "Add to cart";
  }

  // Refresh everything that depends on the selected weight.
  function applySize() {
    var p = state.product;
    if (!p) return;
    var size = currentSize();
    var count = Array.isArray(p.sizes) ? p.sizes.length : 0;
    var price = size ? Number(size.price) || 0 : Number(p.price) || 0;
    var mrp = size ? sizeMrp(p, size) : Number(p.mrp) || 0;
    var label = size ? size.label : p.netQuantity || "";
    var sku = size ? size.sku || p.sku || "" : p.sku || "";

    setText("pdpPrice", Nastro.inr(price));

    var mrpEl = document.getElementById("pdpMrp");
    if (mrpEl) {
      if (mrp > price) {
        mrpEl.textContent = "MRP " + Nastro.inr(mrp);
        mrpEl.hidden = false;
      } else {
        mrpEl.textContent = "";
        mrpEl.hidden = true;
      }
    }

    setText("pdpNet", label);

    var upEl = document.getElementById("pdpUnitPrice");
    if (upEl) {
      var up = size ? unitPriceText(size, count) : "";
      upEl.textContent = up;
      upEl.hidden = !up;
    }

    setText("specPrice", Nastro.inr(price));
    setText("specMrp", mrp > 0 ? Nastro.inr(mrp) : " - ");
    setText("specQty", label || " - ");
    var specSku = document.getElementById("specSku");
    if (specSku) specSku.innerHTML = "<code>" + escapeHtml(sku) + "</code>";

    updateAddLabel(price);
  }

  /* ---------- cart drawer ---------- */

  function renderCart() {
    var body = document.getElementById("cartBody");
    var total = document.getElementById("cartTotal");
    var cart = Nastro.loadCart();
    if (!body) return;
    if (!cart.length) {
      body.innerHTML = '<div class="drawer__empty">Your cart is empty.</div>';
    } else {
      body.innerHTML = cart
        .map(function (i) {
          return (
            '<div class="cart-item">' +
            '<img src="' +
            escapeHtml(i.image) +
            '" alt="" onerror="this.onerror=null;this.src=\'assets/products/grains.jpg\'" />' +
            "<div><h4>" +
            escapeHtml(i.name) +
            '</h4><div class="meta">' +
            escapeHtml(i.size) +
            (i.sku ? " · " + escapeHtml(i.sku) : "") +
            " × " +
            (Number(i.qty) || 0) +
            '</div><button type="button" class="rm" data-rm="' +
            escapeHtml(i.key) +
            '">Remove</button></div>' +
            '<div class="line">' +
            Nastro.inr((Number(i.price) || 0) * (Number(i.qty) || 0)) +
            "</div></div>"
          );
        })
        .join("");
    }
    if (total) total.textContent = Nastro.inr(Nastro.cartTotal(cart));
    Nastro.updateCartBadges();
  }

  function openCart() {
    document.getElementById("cartDrawer").classList.add("open");
    document.getElementById("overlay").classList.add("open");
    document.body.style.overflow = "hidden";
    renderCart();
  }

  function closeCart() {
    document.getElementById("cartDrawer").classList.remove("open");
    document.getElementById("overlay").classList.remove("open");
    document.body.style.overflow = "";
  }

  // id is optional: lets applySize() update that value later.
  function row(label, value, id) {
    var raw = value == null || value === "" ? " - " : value;
    // Allow intentional HTML only for our own <code> wrappers
    var safe =
      typeof raw === "string" && raw.indexOf("<code>") === 0 ? raw : escapeHtml(raw);
    return (
      '<div class="spec-row"><dt>' +
      escapeHtml(label) +
      "</dt><dd" +
      (id ? ' id="' + id + '"' : "") +
      ">" +
      safe +
      "</dd></div>"
    );
  }

  /* ---------- loading skeleton ---------- */

  function skeletonHtml() {
    return (
      '<div class="pdp-skeleton" aria-busy="true" style="display:grid;gap:14px;max-width:560px;padding:32px 0">' +
      '<div class="sk" style="height:320px;border-radius:12px"></div>' +
      '<div class="sk" style="height:18px;width:60%;border-radius:8px"></div>' +
      '<div class="sk" style="height:18px;width:30%;border-radius:8px"></div>' +
      '<div class="sk" style="height:18px;width:80%;border-radius:8px"></div>' +
      "</div>"
    );
  }

  function injectSkeletonStyles() {
    if (document.getElementById("pdpSkStyles")) return;
    var st = document.createElement("style");
    st.id = "pdpSkStyles";
    st.textContent =
      ".sk{background:linear-gradient(90deg,#e8e0d0 25%,#f3ecdc 50%,#e8e0d0 75%);" +
      "background-size:200% 100%;animation:pdpSk 1.2s infinite}" +
      "@keyframes pdpSk{to{background-position:-200% 0}}";
    document.head.appendChild(st);
  }

  /* ---------- page render ---------- */

  // keepState: keep selected size / quantity (used when the API refresh redraws the page)
  // final: the API has answered, so a missing product really is "not found"
  function render(keepState, final) {
    var id = qs("id");
    var p = Nastro.findProduct(id);
    var root = document.getElementById("productPage");
    if (!p) {
      root.innerHTML = final
        ? '<div class="product-missing"><h1 class="display">Product not found</h1><p class="lede">This SKU is not in the catalog.</p><a class="btn btn--wine" href="index.html#shop">Back to shop</a></div>'
        : skeletonHtml();
      return;
    }
    state.product = p;
    if (keepState) {
      var n = Array.isArray(p.sizes) ? p.sizes.length : 0;
      state.sizeIndex = Math.max(0, Math.min(state.sizeIndex, n - 1));
    } else {
      state.sizeIndex = 0;
      state.qty = 1;
    }
    document.title = p.name + " - Nastro Blu";

    var cat =
      (window.NASTRO_CATALOG.categories.find(function (c) {
        return c.id === p.category;
      }) || {}).name || p.category;

    var unavailable = isUnavailable(p);
    var multi = Array.isArray(p.sizes) && p.sizes.length > 1;

    root.innerHTML =
      '<nav class="breadcrumb"><a href="index.html">Home</a> / <a href="index.html#shop">Catalog</a> / <span>' +
      escapeHtml(p.name) +
      "</span></nav>" +
      '<div class="pdp' +
      (unavailable ? " pdp--unavailable" : "") +
      '">' +
      '<div class="pdp__media">' +
      (unavailable
        ? '<span class="pcard__badge pcard__badge--unavailable">Unavailable</span>'
        : p.tag
        ? '<span class="pcard__badge">' + escapeHtml(p.tag) + "</span>"
        : "") +
      (unavailable ? '<span class="pcard__soldout" aria-hidden="true">Sold out</span>' : "") +
      '<img src="' +
      escapeHtml(p.image) +
      '" alt="' +
      escapeHtml(p.name) +
      '" width="640" height="640" fetchpriority="high" decoding="async" onerror="this.onerror=null;this.src=\'assets/products/grains.jpg\'" />' +
      "</div>" +
      '<div class="pdp__info">' +
      '<p class="pdp__brand">' +
      escapeHtml(p.brand || "Nastro Blu") +
      " · " +
      escapeHtml(cat) +
      "</p>" +
      '<h1 class="display">' +
      escapeHtml(p.name) +
      "</h1>" +
      (unavailable
        ? '<p class="pdp__unavailable-note">Temporarily unavailable — you can still view details. We\'ll restock soon.</p>'
        : "") +
      '<p class="pdp__blurb">' +
      escapeHtml(p.blurb || "") +
      "</p>" +
      (String(p.description || "").trim() &&
      String(p.description || "").trim() !== String(p.blurb || "").trim()
        ? '<p class="pdp__desc">' + escapeHtml(p.description) + "</p>"
        : "") +
      '<div class="pdp__price-block">' +
      '<div><span class="pdp__price" id="pdpPrice"></span>' +
      '<span class="pdp__mrp" id="pdpMrp" hidden></span></div>' +
      '<div class="pdp__qty-label">Net quantity: <strong id="pdpNet"></strong></div>' +
      "</div>" +
      '<p class="pdp__unitprice" id="pdpUnitPrice" hidden></p>' +
      (multi ? '<p class="pdp__size-label">Select weight</p>' : "") +
      '<div class="sizes" id="pdpSizes"></div>' +
      '<div class="qty"><button type="button" id="qtyMinus"' +
      (unavailable ? " disabled" : "") +
      ">−</button><span id=\"pdpQty\">1</span><button type=\"button\" id=\"qtyPlus\"" +
      (unavailable ? " disabled" : "") +
      ">+</button></div>" +
      '<div class="pdp__actions">' +
      (unavailable
        ? '<button type="button" class="btn btn--muted" id="pdpAdd" disabled>Currently unavailable</button>'
        : '<button type="button" class="btn btn--wine" id="pdpAdd">Add to cart</button>') +
      (window.NastroWishlist ? window.NastroWishlist.buttonHtml(p.id, true) : "") +
      '<a class="btn btn--ghost" style="border-color:var(--wine);color:var(--wine)" id="pdpWa" target="_blank" rel="noopener">' +
      (unavailable ? "Ask on WhatsApp" : "Order on WhatsApp") +
      "</a>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<section class="spec-panel">' +
      "<h2>Packaging &amp; product specification</h2>" +
      '<p class="spec-note">Internal catalog fields aligned to what appears on pack / label. Confirm live batch dates on physical packaging.</p>' +
      '<dl class="spec-table">' +
      row("Product name", p.name) +
      row("Brand", p.brand || "Nastro Blu") +
      row("Product description", p.description) +
      row("MRP", "", "specMrp") +
      row("Selling price (catalog)", "", "specPrice") +
      row("Quantity / net weight", "", "specQty") +
      row("SKU", "<code></code>", "specSku") +
      row("Barcode (EAN)", "<code>" + escapeHtml(p.barcode || "") + "</code>") +
      row("Manufacturing / packed on", p.packedOn) +
      row("Expiry / best before", p.bestBefore) +
      row("Ingredients", p.ingredients) +
      row("Storage", p.storage) +
      row("Origin / source", p.origin) +
      "</dl>" +
      (p.specifications && p.specifications.length
        ? "<h3>Specifications</h3><ul class=\"pack-list\">" +
          p.specifications
            .map(function (s) {
              return "<li>" + escapeHtml(s) + "</li>";
            })
            .join("") +
          "</ul>"
        : "") +
      (p.packagingText && p.packagingText.length
        ? "<h3>Other text shown on packaging</h3><ul class=\"pack-list pack-list--claims\">" +
          p.packagingText
            .map(function (s) {
              return "<li>“" + escapeHtml(s) + "”</li>";
            })
            .join("") +
          "</ul>"
        : "") +
      "</section>" +
      '<section class="review-panel" id="reviewPanel">' +
      '<div class="review-panel__head">' +
      "<h2>Customer reviews</h2>" +
      '<p class="review-panel__summary" id="reviewSummary">' +
      (p.reviews > 0
        ? "★ " +
          Number(p.rating).toFixed(1) +
          " · " +
          p.reviews +
          (p.reviews === 1 ? " review" : " reviews")
        : "No reviews yet — be the first") +
      "</p>" +
      "</div>" +
      '<div class="review-compose" id="reviewCompose"></div>' +
      '<div class="review-list" id="reviewList"><p class="meta">Loading reviews…</p></div>' +
      "</section>";

    renderSizes();
    applySize();
    bindPdp();
    setText("pdpQty", String(state.qty));
    updateAddLabel(currentSize() ? Number(currentSize().price) || 0 : Number(p.price) || 0);
    loadReviews();
    if (window.NastroWishlist) {
      window.NastroWishlist.paint(document.getElementById("productPage"));
      window.NastroWishlist.refresh();
    }
  }

  /* ---------- reviews ---------- */

  async function loadReviews() {
    var list = document.getElementById("reviewList");
    var compose = document.getElementById("reviewCompose");
    var summary = document.getElementById("reviewSummary");
    if (!list || !state.product) return;
    try {
      // Start the login check at the same time as the reviews request
      // (they do not depend on each other), instead of one after the other.
      var mePromise = fetch("/api/customer/me", {
        credentials: "include",
        headers: customerHeaders(),
      })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        });

      var res = await fetch(
        "/api/reviews?product=" + encodeURIComponent(state.product.id),
        { credentials: "include", headers: customerHeaders() }
      );
      var data = await res.json().catch(function () {
        return {};
      });
      var reviews = data.reviews || [];
      if (summary) {
        if (state.product.reviews > 0) {
          summary.textContent =
            "★ " +
            Number(state.product.rating).toFixed(1) +
            " · " +
            state.product.reviews +
            (state.product.reviews === 1 ? " review" : " reviews");
        } else {
          summary.textContent = reviews.length
            ? reviews.length + " review" + (reviews.length === 1 ? "" : "s")
            : "No reviews yet — be the first";
        }
      }

      if (!reviews.length) {
        list.innerHTML = '<p class="meta">No customer reviews for this product yet.</p>';
      } else {
        list.innerHTML = reviews
          .map(function (r) {
            return (
              '<article class="review-card">' +
              '<div class="review-card__top">' +
              "<strong>" +
              escapeHtml(r.customerName) +
              "</strong>" +
              '<span class="review-card__stars">' +
              starsHtml(r.rating, false) +
              "</span>" +
              "</div>" +
              '<p class="review-card__text">' +
              escapeHtml(r.comment) +
              "</p>" +
              '<time class="review-card__time">' +
              escapeHtml(
                r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""
              ) +
              "</time>" +
              "</article>"
            );
          })
          .join("");
      }

      renderReviewForm(compose, data.mine || null, mePromise);
    } catch (e) {
      list.innerHTML = '<p class="meta">Could not load reviews.</p>';
      if (compose) {
        compose.innerHTML =
          '<p class="meta"><a href="account.html?next=' +
          encodeURIComponent("product.html?id=" + state.product.id) +
          '">Sign in</a> to write a review.</p>';
      }
    }
  }

  function renderReviewForm(compose, mine, mePromise) {
    if (!compose) return;
    var loggedIn = false;
    try {
      loggedIn =
        Boolean(window.__NASTRO_CUSTOMER) || Boolean(localStorage.getItem("nb-customer-token"));
    } catch (e) {}
    (mePromise || Promise.resolve(null))
      .then(function (data) {
        if (data && data.customer) {
          window.__NASTRO_CUSTOMER = data.customer;
          loggedIn = true;
        }
        if (!loggedIn) {
          compose.innerHTML =
            '<div class="review-login-prompt">' +
            "<p>Sign in to rate this product and share your experience.</p>" +
            '<a class="btn btn--wine" href="account.html?next=' +
            encodeURIComponent("product.html?id=" + state.product.id) +
            '">Login to review</a>' +
            "</div>";
          return;
        }
        state.reviewRating = mine ? mine.rating : 5;
        compose.innerHTML =
          "<h3>" +
          (mine ? "Update your review" : "Write a review") +
          "</h3>" +
          '<div class="star-picker" id="starPicker" aria-label="Your rating">' +
          starsHtml(state.reviewRating, true) +
          "</div>" +
          '<label class="review-label">Your review' +
          '<textarea id="reviewComment" rows="4" maxlength="1200" placeholder="How was the taste, freshness, packaging…">' +
          (mine ? escapeHtml(mine.comment) : "") +
          "</textarea></label>" +
          '<div class="review-form-actions">' +
          '<button type="button" class="btn btn--wine" id="btnSubmitReview">' +
          (mine ? "Save review" : "Submit review") +
          "</button>" +
          '<p class="msg is-hidden" id="reviewMsg"></p>' +
          "</div>";

        var picker = document.getElementById("starPicker");
        if (picker) {
          picker.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-star]");
            if (!btn) return;
            state.reviewRating = Number(btn.dataset.star);
            picker.innerHTML = starsHtml(state.reviewRating, true);
          });
        }
        var submit = document.getElementById("btnSubmitReview");
        if (submit) {
          submit.addEventListener("click", submitReview);
        }
      })
      .catch(function () {
        compose.innerHTML =
          '<p class="meta"><a href="account.html?next=' +
          encodeURIComponent("product.html?id=" + state.product.id) +
          '">Sign in</a> to write a review.</p>';
      });
  }

  async function submitReview() {
    var commentEl = document.getElementById("reviewComment");
    var msg = document.getElementById("reviewMsg");
    var btn = document.getElementById("btnSubmitReview");
    var comment = (commentEl && commentEl.value) || "";
    if (btn) btn.disabled = true;
    try {
      var res = await fetch("/api/reviews", {
        method: "POST",
        credentials: "include",
        headers: customerHeaders(),
        body: JSON.stringify({
          productId: state.product.id,
          rating: state.reviewRating,
          comment: comment,
        }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401) {
        toast("Please sign in to review");
        window.location.href =
          "account.html?next=" + encodeURIComponent("product.html?id=" + state.product.id);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not save review");
      if (data.summary) {
        state.product.rating = data.summary.rating;
        state.product.reviews = data.summary.reviews;
      }
      toast("Thank you for your review");
      await loadReviews();
    } catch (err) {
      if (msg) {
        msg.textContent = err.message || "Could not save review";
        msg.classList.remove("is-hidden");
        msg.hidden = false;
        msg.style.color = "#9b1c1c";
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ---------- size chips + actions ---------- */

  function renderSizes() {
    var p = state.product;
    var box = document.getElementById("pdpSizes");
    if (!box) return;
    if (!Array.isArray(p.sizes) || !p.sizes.length) {
      box.innerHTML = '<p class="lede">No size options available.</p>';
      return;
    }
    box.innerHTML = displayOrder(p.sizes)
      .map(function (i) {
        var s = p.sizes[i];
        var active = i === state.sizeIndex;
        return (
          '<button type="button" class="size-chip' +
          (active ? " active" : "") +
          '" data-size="' +
          i +
          '" aria-pressed="' +
          (active ? "true" : "false") +
          '">' +
          escapeHtml(s.label) +
          " · " +
          Nastro.inr(s.price) +
          (s.sku ? '<span class="size-sku">' + escapeHtml(s.sku) + "</span>" : "") +
          "</button>"
        );
      })
      .join("");
  }

  function bindPdp() {
    var p = state.product;

    document.getElementById("pdpSizes").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-size]");
      if (!btn || !Array.isArray(p.sizes) || !p.sizes.length) return;
      state.sizeIndex = Number(btn.dataset.size);
      renderSizes();
      applySize();
    });

    document.getElementById("qtyMinus").addEventListener("click", function () {
      state.qty = Math.max(1, state.qty - 1);
      document.getElementById("pdpQty").textContent = String(state.qty);
      applySize();
    });

    document.getElementById("qtyPlus").addEventListener("click", function () {
      state.qty = Math.min(99, state.qty + 1);
      document.getElementById("pdpQty").textContent = String(state.qty);
      applySize();
    });

    document.getElementById("pdpAdd").addEventListener("click", function () {
      if (isUnavailable(p)) {
        toast("This item is currently unavailable");
        return;
      }
      if (!Array.isArray(p.sizes) || !p.sizes.length) {
        toast("This product has no size/price options");
        return;
      }
      Nastro.addToCart(p.id, state.sizeIndex, state.qty);
      toast(p.name + " (" + (currentSize() || {}).label + ") added");
      renderCart();
      openCart();
    });

    document.getElementById("pdpWa").addEventListener("click", function (e) {
      if (!Array.isArray(p.sizes) || !p.sizes.length) {
        e.preventDefault();
        toast("This product has no size/price options");
        return;
      }
      var size = p.sizes[state.sizeIndex] || p.sizes[0];
      var unavailable = isUnavailable(p);
      var mrp = sizeMrp(p, size);
      var msg = unavailable
        ? "Hi Nastro Blu! I'd like to know when this is back in stock:\n• " +
          p.name +
          " (" +
          size.label +
          ") [" +
          (size.sku || p.sku) +
          "]\nPlease notify me when available."
        : "Hi Nastro Blu! I'd like to order:\n• " +
          p.name +
          " (" +
          size.label +
          ") [" +
          (size.sku || p.sku) +
          "] × " +
          state.qty +
          " - " +
          Nastro.inr(size.price * state.qty) +
          "\nMRP: " +
          Nastro.inr(mrp) +
          "\nPlease confirm availability.";
      var url = "https://wa.me/" + Nastro.WA + "?text=" + encodeURIComponent(msg);
      if (url.length > 1800) {
        msg =
          "Hi Nastro Blu! Order request for " +
          p.name +
          " (" +
          size.label +
          ") × " +
          state.qty +
          ". Please confirm.";
        url = "https://wa.me/" + Nastro.WA + "?text=" + encodeURIComponent(msg);
      }
      e.currentTarget.href = url;
    });
  }

  /* ---------- background refresh from the API ---------- */

  // The page is already drawn from the built-in catalog (products.js).
  // This quietly fetches the live catalog and redraws only if this product changed.
  function refreshFromApi() {
    if (!(window.Nastro && Nastro.loadCatalogFromApi)) {
      if (!state.product) render(true, true);
      return;
    }
    Promise.resolve(Nastro.loadCatalogFromApi())
      .then(function () {
        var fresh = Nastro.findProduct(qs("id"));
        if (!fresh) {
          if (!state.product) render(true, true);
          return;
        }
        if (!state.product || JSON.stringify(fresh) !== JSON.stringify(state.product)) {
          render(true, true);
        }
      })
      .catch(function () {
        // API down: keep showing the built-in catalog
        if (!state.product) render(true, true);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    injectSkeletonStyles();
    render(); // instant, from the built-in catalog
    Nastro.updateCartBadges();
    renderCart();
    refreshFromApi(); // quiet background refresh

    document.getElementById("navToggle").addEventListener("click", function () {
      document.getElementById("navLinks").classList.toggle("open");
    });
    document.getElementById("cartBtn").addEventListener("click", openCart);
    document.getElementById("closeCart").addEventListener("click", closeCart);
    document.getElementById("overlay").addEventListener("click", closeCart);
    document.getElementById("cartBody").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-rm]");
      if (!btn) return;
      var cart = Nastro.loadCart().filter(function (i) {
        return (i.key || i.id + "::" + i.size) !== btn.dataset.rm;
      });
      Nastro.saveCart(cart);
      renderCart();
    });
    document.getElementById("checkoutWa").addEventListener("click", async function (e) {
      e.preventDefault();
      var btn = e.currentTarget;
      var cart = Nastro.loadCart();
      if (!cart.length) {
        toast("Cart is empty");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Saving order…";
      try {
        var data = await Nastro.placeOrderAndCheckout({
          onEmpty: function () {
            toast("Cart is empty");
          },
        });
        if (data && data.order) {
          toast("Order " + data.order.orderNumber + " saved");
          renderCart();
          document.getElementById("closeCart").click();
        }
      } catch (err) {
        toast(err.message || "Checkout failed");
      } finally {
        btn.disabled = false;
        btn.textContent = "Checkout";
      }
    });
  });
})();