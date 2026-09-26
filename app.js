(function () {
  var catalog = window.NASTRO_CATALOG || {
    categories: [],
    products: []
  };

  // Show 10 products at a time
  var PRODUCTS_PER_PAGE = 10;

  // Single cap used everywhere
  var MAX_QTY = 99;

  var state = {
    filter: "all",
    query: "",
    sort: "default",
    cart: loadCart(),
    activeProduct: null,
    sizeIndex: 0,
    qty: 1,
    visibleCount: PRODUCTS_PER_PAGE
  };

  var lastFocus = {
    modal: null,
    cart: null
  };

  /* ---------- small DOM helpers ---------- */

  function $(id) {
    return document.getElementById(id);
  }

  function on(id, evt, handler) {
    var el = $(id);

    if (el) {
      el.addEventListener(evt, handler);
    }

    return el;
  }

  function setText(id, text) {
    var el = $(id);

    if (el) {
      el.textContent = text;
    }
  }

  /* ---------- catalog ---------- */

  function setCatalog(data) {
    if (!data) {
      return;
    }

    catalog = data;
    window.NASTRO_CATALOG = data;
  }

  async function loadCatalogFromApi() {
    try {
      var res = await fetch("/api/products");

      if (!res.ok) {
        throw new Error("api");
      }

      var data = await res.json();

      if (
        data &&
        Array.isArray(data.products) &&
        data.products.length
      ) {
        setCatalog({
          categories: data.categories || catalog.categories,
          products: data.products
        });

        syncCartPrices();
      }
    } catch (err) {
      console.warn("Using local catalog fallback", err);
    }
  }

  /* ---------- cart storage ---------- */

  function clampQty(n) {
    return Math.max(
      1,
      Math.min(
        MAX_QTY,
        Math.floor(Number(n)) || 1
      )
    );
  }

  function normalizeCartItem(i) {
    if (!i || typeof i !== "object") {
      return null;
    }

    var qty = clampQty(i.qty);
    var price = Number(i.price);

    if (!Number.isFinite(price) || price < 0) {
      price = 0;
    }

    var id = String(i.id || "");
    var size = String(i.size || "");

    return {
      id: id,
      name: String(i.name || ""),
      size: size,
      price: price,
      qty: qty,
      image: String(i.image || ""),
      sku: String(i.sku || ""),

      // Key must survive save/load round-trip
      key: String(
        i.key || id + "::" + size
      )
    };
  }

  // Merge rows that share a key
  function mergeCartItems(list) {
    var byKey = {};
    var out = [];

    (list || []).forEach(function (i) {
      if (!i) {
        return;
      }

      var found = byKey[i.key];

      if (found) {
        found.qty = Math.max(
          1,
          Math.min(
            MAX_QTY,
            found.qty + i.qty
          )
        );
      } else {
        byKey[i.key] = i;
        out.push(i);
      }
    });

    return out;
  }

  function loadCart() {
    try {
      var raw = JSON.parse(
        localStorage.getItem("nastro-cart") || "[]"
      );

      if (!Array.isArray(raw)) {
        return [];
      }

      return mergeCartItems(
        raw
          .map(normalizeCartItem)
          .filter(Boolean)
      );
    } catch (e) {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(
        "nastro-cart",
        JSON.stringify(state.cart)
      );
    } catch (e) {
      // Private mode / quota
    }

    updateCartCount();
  }

  /* ---------- formatting / utils ---------- */

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeAttr(s) {
    return escapeHtml(s).replace(/`/g, "");
  }

  function inr(n) {
    return (
      "₹" +
      (Number(n) || 0).toLocaleString("en-IN")
    );
  }

  function savePct(price, mrp) {
    price = Number(price);
    mrp = Number(mrp);

    if (!mrp || !price || mrp <= price) {
      return 0;
    }

    return Math.round(
      ((mrp - price) / mrp) * 100
    );
  }

  function hasDiscount(price, mrp) {
    return (
      Number(mrp) > 0 &&
      Number(mrp) > Number(price)
    );
  }

  function productStatus(p) {
    if (!p) {
      return "available";
    }

    if (p.status) {
      return p.status;
    }

    return p.active === false
      ? "unavailable"
      : "available";
  }

  function isUnavailable(p) {
    return productStatus(p) === "unavailable";
  }

  function hasRealReviews(p) {
    return (
      p &&
      Number(p.reviews) > 0 &&
      Number(p.rating) > 0
    );
  }

  function cartCount() {
    return state.cart.reduce(
      function (s, i) {
        return s + (Number(i.qty) || 0);
      },
      0
    );
  }

  function cartTotal() {
    return state.cart.reduce(
      function (s, i) {
        return (
          s +
          (Number(i.price) || 0) *
            (Number(i.qty) || 0)
        );
      },
      0
    );
  }

  function updateCartCount() {
    setText(
      "cartCount",
      String(cartCount())
    );
  }

  function toast(msg) {
    var t = $("toast");

    if (!t) {
      return;
    }

    t.textContent = msg;
    t.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(
      function () {
        t.classList.remove("show");
      },
      2600
    );
  }

  /* ---------- filters & categories ---------- */

  function shopFilters() {
    var cats = (
      catalog.categories || []
    ).slice();

    if (!cats.length) {
      cats = [
        {
          id: "all",
          name: "All Products"
        }
      ];
    }

    var hasUnder = cats.some(
      function (c) {
        return c.id === "under999";
      }
    );

    if (!hasUnder) {
      cats.push({
        id: "under999",
        name: "Under ₹999"
      });
    }

    return cats;
  }

  function filterChipHtml(c) {
    return (
      '<button type="button" class="filter-chip' +
      (state.filter === c.id
        ? " active"
        : "") +
      '" data-filter="' +
      safeAttr(c.id) +
      '">' +
      escapeHtml(c.name) +
      "</button>"
    );
  }

  function renderFilters() {
    var html = shopFilters()
      .map(filterChipHtml)
      .join("");

    var row = $("filterRow");
    var sticky = $("collectionRow");

    if (row) {
      row.innerHTML = html;
    }

    if (sticky) {
      sticky.innerHTML = html;
    }
  }

  function renderCategories() {
    var strip = $("catStrip");

    if (!strip) {
      return;
    }

    strip.innerHTML = shopFilters()
      .filter(function (c) {
        return c.id !== "under999";
      })
      .map(function (c) {
        return (
          '<button type="button" class="cat-card' +
          (state.filter === c.id
            ? " active"
            : "") +
          '" data-filter="' +
          safeAttr(c.id) +
          '"><div class="ic">' +
          escapeHtml(c.icon || "✦") +
          '</div><div class="nm">' +
          escapeHtml(c.name) +
          "</div></button>"
        );
      })
      .join("");
  }

  function categoryProductCount(id) {
    if (id === "all") {
      return (catalog.products || []).length;
    }

    return (catalog.products || []).filter(
      function (p) {
        return matchesFilter(p, id);
      }
    ).length;
  }

  function renderShopCategories() {
    var grid = $("shopCategoryGrid");

    if (!grid) {
      return;
    }

    var cats = shopFilters().filter(
      function (c) {
        return c.id !== "under999";
      }
    );

    grid.innerHTML = cats
      .map(function (c) {
        var count = categoryProductCount(c.id);

        return (
          '<a class="cat-card" href="category.html?cat=' +
          safeAttr(c.id) +
          '" data-filter="' +
          safeAttr(c.id) +
          '"><div class="ic">' +
          escapeHtml(c.icon || "✦") +
          '</div><div class="nm">' +
          escapeHtml(c.name) +
          '</div><div class="ct" style="font-size:.8rem;opacity:.75;margin-top:.2rem">' +
          count +
          (count === 1 ? " product" : " products") +
          "</div></a>"
        );
      })
      .join("");
  }

  function matchesQuery(p, q) {
    if (!q) {
      return true;
    }

    var hay = [
      p.name,
      p.sku,
      p.id,
      p.blurb,
      p.description,
      p.category,
      p.netQuantity,
      p.unit,
      p.tag
    ]
      .concat(p.tags || [])
      .join(" ")
      .toLowerCase();

    return hay.indexOf(q) !== -1;
  }

  function matchesFilter(p, filter) {
    if (filter === "all") {
      return true;
    }

    if (filter === "under999") {
      var price = Number(p.price);

      return (
        price > 0 &&
        price < 999
      );
    }

    if (p.category === filter) {
      return true;
    }

    if (
      Array.isArray(p.categories) &&
      p.categories.indexOf(filter) !== -1
    ) {
      return true;
    }

    return false;
  }

  function categoryName(catId) {
    var found = shopFilters().find(
      function (c) {
        return c.id === catId;
      }
    );

    return (
      (found && found.name) ||
      catId
    );
  }

  // "Naturally Grown Farm Products" is used on rice, dals,
  // flours, jaggery, whole spices, seeds and more all at once.
  // Split it by item type so rice sits with rice, dal with
  // dal, etc., instead of one big alphabetical blob.
  function farmProductSubgroup(p) {
    var n = (p.name || "").toLowerCase();

    if (/\brice\b/.test(n)) {
      return "Rice";
    }

    if (
      /\bdal\b|chola|kabuli|rajma|moong|urad|\bmatar\b/.test(
        n
      )
    ) {
      return "Dals & Pulses";
    }

    if (/aata|\bflour\b|besan/.test(n)) {
      return "Flours (Aata)";
    }

    if (/jaggery|khand|gulkand/.test(n)) {
      return "Jaggery & Natural Sweeteners";
    }

    if (
      /turmeric|chilli powder|\bjeera\b|dhaniya|tamarind/.test(
        n
      )
    ) {
      return "Spices & Masala";
    }

    if (/seed|sesame|chia|flax|sabja/.test(n)) {
      return "Seeds";
    }

    if (/peanut/.test(n)) {
      return "Peanuts";
    }

    return "Other Naturally Grown Products";
  }

  // "Kerala Naturally Grown Product" covers both whole
  // spices and teas - keep teas on their own shelf.
  function keralaSpiceSubgroup(p) {
    var n = (p.name || "").toLowerCase();

    if (/\btea\b/.test(n)) {
      return "Kerala Teas";
    }

    return "Kerala Spices";
  }

  // "Kashmiri Dry Fruits & More" also covers garlic,
  // chillies and saffron - split those out from the nuts.
  function kashmiriDryFruitSubgroup(p) {
    var n = (p.name || "").toLowerCase();

    if (/garlic|mirchi|chilli/.test(n)) {
      return "Kashmiri Specialities";
    }

    if (/saffron/.test(n)) {
      return "Saffron";
    }

    return "Dry Fruits";
  }

  function productGroupLabel(p) {
    var tag =
      Array.isArray(p.tags) &&
      p.tags.length
        ? p.tags[0]
        : null;

    // Trim internal notes like
    // "Sweets (delivery 12-24 Hrs)"
    // down to just "Sweets"
    var trimmedTag = tag
      ? tag
          .replace(
            /\s*\(delivery[^)]*\)\s*$/i,
            ""
          )
          .trim()
      : null;

    if (
      trimmedTag ===
      "Naturally Grown Farm Products"
    ) {
      return farmProductSubgroup(p);
    }

    if (
      trimmedTag ===
      "Kerala Naturally Grown Product"
    ) {
      return keralaSpiceSubgroup(p);
    }

    if (
      trimmedTag ===
      "Kashmiri Dry Fruits & More"
    ) {
      return kashmiriDryFruitSubgroup(
        p
      );
    }

    if (!tag) {
      return categoryName(
        p.category
      );
    }

    return trimmedTag;
  }

  function sortOptions() {
    return [
      { id: "default", name: "Recommended" },
      { id: "price-asc", name: "Price: Low to High" },
      { id: "price-desc", name: "Price: High to Low" },
      { id: "name-asc", name: "Name: A to Z" }
    ];
  }

  function renderSort() {
    var sel = $("sortSelect");

    if (!sel) {
      return;
    }

    if (!sel.options.length) {
      sel.innerHTML = sortOptions()
        .map(function (o) {
          return (
            '<option value="' +
            safeAttr(o.id) +
            '">' +
            escapeHtml(o.name) +
            "</option>"
          );
        })
        .join("");
    }

    sel.value = state.sort;
  }

  function applySort(list) {
    var sorted = list.slice();

    if (state.sort === "price-asc") {
      sorted.sort(function (a, b) {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      });
    } else if (state.sort === "price-desc") {
      sorted.sort(function (a, b) {
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      });
    } else if (state.sort === "name-asc") {
      sorted.sort(function (a, b) {
        var an = (a.name || "").toLowerCase();
        var bn = (b.name || "").toLowerCase();

        return an < bn ? -1 : an > bn ? 1 : 0;
      });
    }

    return sorted;
  }

  function setSort(id) {
    state.sort = id;

    // A new sort starts pagination fresh, same as a
    // category or search change.
    state.visibleCount = PRODUCTS_PER_PAGE;

    renderProducts();
  }

  function categoryOrderIndex(catId) {
    var cats = catalog.categories || [];

    var idx = cats.findIndex(
      function (c) {
        return c.id === catId;
      }
    );

    return idx === -1
      ? cats.length
      : idx;
  }

  function filteredProducts() {
    var q = (state.query || "")
      .trim()
      .toLowerCase();

    var list = (
      catalog.products || []
    ).filter(function (p) {
      return (
        matchesFilter(
          p,
          state.filter
        ) &&
        matchesQuery(p, q)
      );
    });

    // Group products by their shelf - Pickles with pickles,
    // Rice/Dals/Flours together, Sweets together, etc. -
    // rather than pure A-Z, which mixes everything together.
    // Only the broad "All products" / "Under ₹999" views need
    // this: a single category page (e.g.
    // category.html?cat=produce) already shows just one
    // category, so it stays a plain list.
    if (
      state.sort === "default" &&
      (state.filter === "all" ||
        state.filter === "under999")
    ) {
      list = list
        .map(function (p, i) {
          return {
            p: p,
            i: i
          };
        })
        .sort(function (a, b) {
          var ca = categoryOrderIndex(
            a.p.category
          );

          var cb = categoryOrderIndex(
            b.p.category
          );

          if (ca !== cb) {
            return ca - cb;
          }

          // Within the same category, cluster by
          // the more specific group (Pickles,
          // Summer Special Squashes, Sweets, ...)
          // instead of falling back to plain A-Z.
          var la = productGroupLabel(
            a.p
          );

          var lb = productGroupLabel(
            b.p
          );

          if (la !== lb) {
            return la < lb ? -1 : 1;
          }

          // Stable: keep original relative
          // order within the same sub-group
          return a.i - b.i;
        })
        .map(function (entry) {
          return entry.p;
        });
    }

    // An explicit sort (price/name) wins over the
    // default shelf-by-shelf grouping above.
    if (state.sort !== "default") {
      list = applySort(list);
    }

    return list;
  }

  // Same key renderProducts() uses to detect a new
  // group heading - kept in one place so pagination
  // and heading logic never disagree with each other.
  function groupKeyFor(p) {
    return (
      p.category +
      "::" +
      productGroupLabel(p)
    );
  }

  function filterLabel(id) {
    var found = shopFilters().find(
      function (c) {
        return c.id === id;
      }
    );

    if (
      state.query &&
      state.query.trim()
    ) {
      return (
        'Results for "' +
        state.query.trim() +
        '"'
      );
    }

    return (
      (found && found.name) ||
      "All products"
    );
  }

  /* ---------- product cards ---------- */

  function productCardHtml(p) {
    var save = savePct(
      p.price,
      p.mrp
    );

    var unavailable =
      isUnavailable(p);

    var id = safeAttr(p.id);
    var name = escapeHtml(
      p.name
    );

    var actions = unavailable
      ? '<button type="button" class="btn btn--muted" disabled aria-disabled="true">Unavailable</button>' +
        '<a class="btn btn--ghost" href="product.html?id=' +
        id +
        '" style="border-color:var(--wine);color:var(--wine)">Details</a>'
      : '<button type="button" class="btn btn--wine" data-add="' +
        id +
        '">Add to cart</button>' +
        '<a class="btn btn--ghost" href="product.html?id=' +
        id +
        '" style="border-color:var(--wine);color:var(--wine)">Details</a>';

    var skuLine =
      "SKU " +
      escapeHtml(p.sku || "—") +
      (Number(p.mrp) > 0
        ? " · MRP " + inr(p.mrp)
        : "");

    var priceHtml =
      '<div class="pcard__price"><span class="now">' +
      inr(p.price) +
      "</span>" +
      (hasDiscount(
        p.price,
        p.mrp
      )
        ? '<span class="was">' +
          inr(p.mrp) +
          "</span>"
        : "") +
      (p.unit
        ? '<span class="unit">/ ' +
          escapeHtml(p.unit) +
          "</span>"
        : "") +
      "</div>";

    return (
      '<article class="pcard' +
      (unavailable
        ? " pcard--unavailable"
        : "") +
      '">' +
      '<div class="pcard__media">' +
      (unavailable
        ? '<span class="pcard__badge pcard__badge--unavailable">Unavailable</span>'
        : p.tag
        ? '<span class="pcard__badge">' +
          escapeHtml(p.tag) +
          "</span>"
        : "") +
      (!unavailable && save
        ? '<span class="pcard__save">Save ' +
          save +
          "%</span>"
        : "") +
      (unavailable
        ? '<span class="pcard__soldout" aria-hidden="true">Sold out</span>'
        : "") +
      '<a href="product.html?id=' +
      id +
      '">' +
      '<img src="' +
      safeAttr(p.image) +
      '" alt="' +
      safeAttr(p.name) +
      '" loading="lazy" onerror="this.onerror=null;this.src=\'assets/products/grains.jpg\'" />' +
      "</a>" +
      (window.NastroWishlist
        ? window.NastroWishlist.buttonHtml(
            p.id,
            false
          )
        : '<button type="button" class="wish-btn" data-wish="' +
          id +
          '" aria-label="Add to wishlist"><span class="wish-btn__icon" aria-hidden="true">♡</span></button>') +
      "</div>" +
      '<div class="pcard__body">' +
      (hasRealReviews(p)
        ? '<div class="pcard__rating"><b>★ ' +
          Number(p.rating).toFixed(1) +
          "</b> · " +
          p.reviews +
          (Number(p.reviews) === 1
            ? " review"
            : " reviews") +
          "</div>"
        : "") +
      "<h3>" +
      '<a href="product.html?id=' +
      id +
      '">' +
      name +
      "</a>" +
      "</h3>" +
      '<p class="pcard__blurb">' +
      escapeHtml(
        p.blurb || ""
      ) +
      "</p>" +
      '<div class="pcard__sku">' +
      skuLine +
      "</div>" +
      priceHtml +
      (unavailable
        ? '<p class="pcard__stock">Temporarily unavailable — check back soon</p>'
        : "") +
      '<div class="pcard__actions">' +
      actions +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function renderProducts() {
    var grid = $("productGrid");
    var count = $("productCount");
    var title = $("shopTitle");

    var list = filteredProducts();

    if (count) {
      count.textContent =
        list.length +
        (list.length === 1
          ? " product"
          : " products");
    }

    if (title) {
      title.textContent =
        filterLabel(
          state.filter
        );

      if (onCategoryPage()) {
        document.title =
          title.textContent +
          " | Nastro Blu";
      }
    }

    if (!grid) {
      return;
    }

    var wrap = $("productGridMore");

    if (!list.length) {
      grid.innerHTML =
        '<div class="shop-empty"><p>No products match your search. Try another name or clear the search box.</p></div>';

      if (wrap) {
        wrap.innerHTML = "";
      }
    } else {
      // Group headings (and the group-safe "Show more"
      // pagination below) only apply on the broad
      // "All products" / "Under ₹999" views. A single
      // category page shows a plain list.
      var grouped =
        state.sort === "default" &&
        (state.filter === "all" ||
          state.filter === "under999");

      // A plain slice at state.visibleCount can land in the
      // middle of a shelf group (e.g. "Cold Pressed Oil"
      // starts right at item #50), so "Show more" would only
      // reveal one item of that group and need a second click
      // to show the rest. Extend the cut point forward to the
      // end of that group so a shelf is never split across
      // pages.
      var visibleCount =
        state.visibleCount;

      if (grouped) {
        while (
          visibleCount <
            list.length &&
          groupKeyFor(
            list[visibleCount]
          ) ===
            groupKeyFor(
              list[
                visibleCount - 1
              ]
            )
        ) {
          visibleCount++;
        }
      }

      var visible = list.slice(
        0,
        visibleCount
      );

      var lastGroupKey = null;

      grid.innerHTML = visible
        .map(function (p, idx) {
          var heading = "";

          var groupKey = groupKeyFor(
            p
          );

          if (
            grouped &&
            groupKey !== lastGroupKey
          ) {
            lastGroupKey = groupKey;

            heading =
              '<h3 class="shop-group-heading" style="grid-column:1/-1;font-family:\'Fraunces\',serif;font-weight:600;font-size:1.35rem;color:var(--wine);margin:' +
              (idx === 0
                ? "0"
                : "2rem") +
              ' 0 .6rem;padding-top:' +
              (idx === 0
                ? "0"
                : "1.5rem") +
              ";border-top:" +
              (idx === 0
                ? "none"
                : "1px solid rgba(45,67,31,.12)") +
              '">' +
              escapeHtml(
                productGroupLabel(p)
              ) +
              "</h3>";
          }

          return (
            heading +
            productCardHtml(p)
          );
        })
        .join("");

      // Create Show More / Show Less container
      if (!wrap) {
        wrap =
          document.createElement(
            "div"
          );

        wrap.id =
          "productGridMore";

        wrap.style.textAlign =
          "center";

        wrap.style.marginTop =
          "1.5rem";

        grid.insertAdjacentElement(
          "afterend",
          wrap
        );
      }

      // Show More
      if (
        list.length >
        visibleCount
      ) {
        wrap.innerHTML =
          '<div class="show-more-progress" style="margin-bottom:.6rem;font-size:.85rem;opacity:.75">' +
          "Showing " +
          Math.min(
            visibleCount,
            list.length
          ) +
          " of " +
          list.length +
          " products" +
          "</div>" +
          '<button type="button" class="btn btn--ghost" id="showMoreBtn" data-show-more>' +
          "Show more (" +
          (list.length -
            visibleCount) +
          " remaining)" +
          "</button>";

      // Show Less
      } else if (
        state.visibleCount >
        PRODUCTS_PER_PAGE
      ) {
        wrap.innerHTML =
          '<button type="button" class="btn btn--ghost" id="showLessBtn" data-show-less>' +
          "Show less" +
          "</button>";

      // No button needed
      } else {
        wrap.innerHTML = "";
      }
    }

    if (window.NastroWishlist) {
      window.NastroWishlist.paint(
        grid
      );
    }

    document
      .querySelectorAll(
        "#collectionRow .filter-chip, #filterRow .filter-chip"
      )
      .forEach(function (chip) {
        chip.classList.toggle(
          "active",
          chip.dataset.filter ===
            state.filter
        );
      });
  }

  function renderFeatured() {
    var grid = $("featuredGrid");

    if (!grid) {
      return;
    }

    var list = (
      catalog.products || []
    )
      .filter(function (p) {
        return (
          p.tag === "Best Seller" ||
          p.tag === "Trending"
        );
      })
      .slice(0, 4);

    if (!list.length) {
      list = (
        catalog.products || []
      )
        .filter(function (p) {
          return p.price > 0;
        })
        .slice(0, 4);
    }

    grid.innerHTML = list
      .map(productCardHtml)
      .join("");

    if (window.NastroWishlist) {
      window.NastroWishlist.paint(
        grid
      );
    }
  }

  /* ---------- banner ---------- */

  function initBanner() {
    var slides =
      Array.prototype.slice.call(
        document.querySelectorAll(
          ".banner__slide"
        )
      );

    var dotsWrap =
      $("bannerDots");

    if (
      !slides.length ||
      !dotsWrap
    ) {
      return;
    }

    var index = 0;
    var timer;

    dotsWrap.innerHTML = slides
      .map(function (_, i) {
        return (
          '<button type="button" aria-label="Go to slide ' +
          (i + 1) +
          '"' +
          (i === 0
            ? ' class="is-active"'
            : "") +
          ' data-dot="' +
          i +
          '"></button>'
        );
      })
      .join("");

    function go(n) {
      index =
        (n + slides.length) %
        slides.length;

      slides.forEach(
        function (s, i) {
          s.classList.toggle(
            "is-active",
            i === index
          );
        }
      );

      dotsWrap
        .querySelectorAll(
          "button"
        )
        .forEach(
          function (d, i) {
            d.classList.toggle(
              "is-active",
              i === index
            );
          }
        );
    }

    function next() {
      go(index + 1);
    }

    function prev() {
      go(index - 1);
    }

    function restart() {
      clearInterval(timer);

      timer = setInterval(
        next,
        5500
      );
    }

    on(
      "bannerNext",
      "click",
      function () {
        next();
        restart();
      }
    );

    on(
      "bannerPrev",
      "click",
      function () {
        prev();
        restart();
      }
    );

    dotsWrap.addEventListener(
      "click",
      function (e) {
        var btn =
          e.target.closest(
            "[data-dot]"
          );

        if (!btn) {
          return;
        }

        go(
          Number(
            btn.dataset.dot
          )
        );

        restart();
      }
    );

    restart();
  }

  /* ---------- product lookup & modal ---------- */

  function findProduct(id) {
    return (
      catalog.products || []
    ).find(function (p) {
      return p.id === id;
    });
  }

  function metaRow(label, value) {
    if (
      value == null ||
      value === ""
    ) {
      return "";
    }

    return (
      "<div><b>" +
      escapeHtml(label) +
      "</b> " +
      escapeHtml(value) +
      "</div>"
    );
  }

  function syncOverlay() {
    var modal =
      $("productModal");

    var drawer =
      $("cartDrawer");

    var overlay =
      $("overlay");

    var anyOpen =
      (modal &&
        modal.classList.contains(
          "open"
        )) ||
      (drawer &&
        drawer.classList.contains(
          "open"
        ));

    if (!anyOpen) {
      if (overlay) {
        overlay.classList.remove(
          "open"
        );
      }

      document.body.style.overflow =
        "";
    }
  }

  function openModal(id) {
    var p = findProduct(id);
    var modal =
      $("productModal");

    if (!p || !modal) {
      return;
    }

    state.activeProduct = p;
    state.sizeIndex = 0;
    state.qty = 1;

    lastFocus.modal =
      document.activeElement;

    var img = $("modalImg");

    if (img) {
      img.src = p.image || "";
      img.alt = p.name || "";
    }

    setText(
      "modalName",
      p.name || ""
    );

    setText(
      "modalBlurb",
      p.blurb || ""
    );

    var desc =
      $("modalDesc");

    if (desc) {
      desc.innerHTML =
        escapeHtml(
          p.description || ""
        ) +
        '<div class="modal-meta">' +
        metaRow(
          "Brand",
          p.brand || "Nastro Blu"
        ) +
        (Number(p.mrp) > 0
          ? metaRow(
              "MRP",
              inr(p.mrp)
            )
          : "") +
        metaRow(
          "Net qty",
          p.netQuantity
        ) +
        metaRow(
          "SKU",
          p.sku
        ) +
        metaRow(
          "Barcode",
          p.barcode
        ) +
        metaRow(
          "Packed",
          p.packedOn
        ) +
        metaRow(
          "Best before",
          p.bestBefore
        ) +
        "</div>" +
        '<a class="modal-full" href="product.html?id=' +
        safeAttr(p.id) +
        '">Open full packaging specification →</a>';
    }

    setText(
      "modalRating",
      hasRealReviews(p)
        ? "★ " +
            Number(
              p.rating
            ).toFixed(1) +
            " · " +
            p.reviews +
            (Number(p.reviews) === 1
              ? " review"
              : " reviews")
        : "No reviews yet"
    );

    renderSizes();
    updateModalPrice();

    setText(
      "modalQty",
      String(state.qty)
    );

    var addBtn =
      $("modalAdd");

    if (addBtn) {
      var noSizes =
        !Array.isArray(
          p.sizes
        ) ||
        !p.sizes.length;

      if (isUnavailable(p)) {
        addBtn.disabled = true;
        addBtn.textContent =
          "Currently unavailable";

        addBtn.classList.add(
          "btn--muted"
        );
      } else if (noSizes) {
        addBtn.disabled = true;
        addBtn.textContent =
          "No purchase options";

        addBtn.classList.add(
          "btn--muted"
        );
      } else {
        addBtn.disabled = false;
        addBtn.textContent =
          "Add to cart";

        addBtn.classList.remove(
          "btn--muted"
        );
      }
    }

    modal.classList.add("open");

    var overlay = $("overlay");

    if (overlay) {
      overlay.classList.add(
        "open"
      );
    }

    document.body.style.overflow =
      "hidden";

    trapFocus(modal);
  }

  function renderSizes() {
    var p =
      state.activeProduct;

    var box =
      $("modalSizes");

    if (!box) {
      return;
    }

    var sizes =
      p &&
      Array.isArray(p.sizes)
        ? p.sizes
        : [];

    box.innerHTML = sizes
      .map(function (s, i) {
        return (
          '<button type="button" class="size-chip' +
          (i === state.sizeIndex
            ? " active"
            : "") +
          '" data-size="' +
          i +
          '">' +
          escapeHtml(
            s.label
          ) +
          " · " +
          inr(s.price) +
          "</button>"
        );
      })
      .join("");
  }

  function updateModalPrice() {
    var p =
      state.activeProduct;

    var el =
      $("modalPrice");

    if (!el) {
      return;
    }

    if (
      !p ||
      !Array.isArray(p.sizes) ||
      !p.sizes.length
    ) {
      el.textContent = "—";
      return;
    }

    var idx = Math.max(
      0,
      Math.min(
        state.sizeIndex || 0,
        p.sizes.length - 1
      )
    );

    state.sizeIndex = idx;

    var size = p.sizes[idx];

    var html = inr(
      size.price
    );

    if (
      idx === 0 &&
      hasDiscount(
        size.price,
        p.mrp
      )
    ) {
      html +=
        '<span class="was">' +
        inr(p.mrp) +
        "</span>";
    }

    el.innerHTML = html;
  }

  function closeModal() {
    var modal =
      $("productModal");

    if (!modal) {
      return;
    }

    var wasOpen =
      modal.classList.contains(
        "open"
      );

    releaseFocus(modal);

    modal.classList.remove(
      "open"
    );

    syncOverlay();

    if (
      wasOpen &&
      lastFocus.modal &&
      typeof lastFocus.modal.focus ===
        "function"
    ) {
      try {
        lastFocus.modal.focus();
      } catch (e) {}
    }

    lastFocus.modal = null;
  }

  /* ---------- cart logic ---------- */

  function syncCartPrices() {
    if (
      !catalog.products ||
      !catalog.products.length
    ) {
      return;
    }

    var changed = false;
    var removed = [];
    var adjusted = [];
    var next = [];

    (state.cart || []).forEach(
      function (i) {
        var p = findProduct(i.id);

        if (!p) {
          next.push(i);
          return;
        }

        if (isUnavailable(p)) {
          removed.push(p.name);
          changed = true;
          return;
        }

        var sizes = Array.isArray(
          p.sizes
        )
          ? p.sizes
          : [];

        if (!sizes.length) {
          next.push(i);
          return;
        }

        var size = sizes.find(
          function (s) {
            return (
              s.label === i.size
            );
          }
        );

        if (!size) {
          size = sizes[0];
          adjusted.push(p.name);
        }

        var nextPrice =
          Number(size.price);

        if (
          i.price !== nextPrice ||
          i.name !== p.name ||
          i.image !== p.image ||
          i.size !== size.label
        ) {
          changed = true;

          next.push(
            Object.assign({}, i, {
              name: p.name,
              price: nextPrice,
              image: p.image,
              size: size.label,
              key:
                p.id +
                "::" +
                size.label
            })
          );
        } else {
          next.push(i);
        }
      }
    );

    var merged =
      mergeCartItems(next);

    if (
      merged.length !== next.length
    ) {
      changed = true;
    }

    state.cart = merged;

    if (changed) {
      saveCart();
    }

    if (removed.length) {
      toast(
        removed.join(", ") +
          (removed.length === 1
            ? " is"
            : " are") +
          " no longer available and was removed from your cart"
      );
    } else if (adjusted.length) {
      toast(
        "Size or price updated for: " +
          adjusted.join(", ")
      );
    }
  }

  function addToCart(
    id,
    sizeIndex,
    qty
  ) {
    var p = findProduct(id);

    if (!p) {
      return;
    }

    if (isUnavailable(p)) {
      toast(
        "This item is currently unavailable"
      );
      return;
    }

    if (
      !Array.isArray(p.sizes) ||
      !p.sizes.length
    ) {
      toast(
        "This product has no size/price options"
      );
      return;
    }

    var si =
      typeof sizeIndex === "number"
        ? sizeIndex
        : 0;

    var size =
      p.sizes[si] ||
      p.sizes[0];

    if (!size) {
      toast(
        "This product has no size/price options"
      );
      return;
    }

    var q = clampQty(qty);

    var key =
      p.id + "::" + size.label;

    var existing =
      state.cart.find(
        function (i) {
          return i.key === key;
        }
      );

    if (existing) {
      existing.qty = Math.min(
        MAX_QTY,
        existing.qty + q
      );

      existing.price =
        Number(size.price);

      existing.name = p.name;
      existing.image = p.image;
    } else {
      state.cart.push({
        key: key,
        id: p.id,
        name: p.name,
        size: size.label,
        price: Number(
          size.price
        ),
        image: p.image,
        qty: q
      });
    }

    saveCart();
    renderCart();

    toast(
      p.name +
        " added to cart"
    );
  }

  function renderCart() {
    syncCartPrices();

    var body =
      $("cartBody");

    var total =
      $("cartTotal");

    if (!body) {
      return;
    }

    if (!state.cart.length) {
      body.innerHTML =
        '<div class="drawer__empty">Your cart is empty.<br/>Browse the pantry and add something honest.</div>';
    } else {
      body.innerHTML =
        state.cart
          .map(function (i) {
            return (
              '<div class="cart-item">' +
              '<img src="' +
              safeAttr(i.image) +
              '" alt="" onerror="this.onerror=null;this.src=\'assets/products/grains.jpg\'" />' +
              "<div><h4>" +
              escapeHtml(
                i.name
              ) +
              '</h4><div class="meta">' +
              escapeHtml(
                i.size
              ) +
              " × " +
              i.qty +
              '</div><button type="button" class="rm" data-rm="' +
              safeAttr(i.key) +
              '">Remove</button></div>' +
              '<div class="line">' +
              inr(
                (Number(
                  i.price
                ) || 0) *
                  (Number(
                    i.qty
                  ) || 0)
              ) +
              "</div>" +
              "</div>"
            );
          })
          .join("");
    }

    if (total) {
      total.textContent =
        inr(cartTotal());
    }
  }

  /* ---------- focus trap ---------- */

  function trapFocus(container) {
    if (!container) {
      return;
    }

    releaseFocus(container);

    var focusables =
      container.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

    if (!focusables.length) {
      return;
    }

    var first =
      focusables[0];

    var last =
      focusables[
        focusables.length - 1
      ];

    function onKey(e) {
      if (e.key !== "Tab") {
        return;
      }

      if (
        e.shiftKey &&
        document.activeElement ===
          first
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        document.activeElement ===
          last
      ) {
        e.preventDefault();
        first.focus();
      }
    }

    container.__focusTrap =
      onKey;

    container.addEventListener(
      "keydown",
      onKey
    );

    try {
      first.focus();
    } catch (e) {}
  }

  function releaseFocus(container) {
    if (
      container &&
      container.__focusTrap
    ) {
      container.removeEventListener(
        "keydown",
        container.__focusTrap
      );

      container.__focusTrap = null;
    }
  }

  /* ---------- cart drawer ---------- */

  function openCart() {
    var drawer =
      $("cartDrawer");

    if (!drawer) {
      return;
    }

    lastFocus.cart =
      document.activeElement;

    drawer.classList.add(
      "open"
    );

    var overlay =
      $("overlay");

    if (overlay) {
      overlay.classList.add(
        "open"
      );
    }

    document.body.style.overflow =
      "hidden";

    renderCart();
    trapFocus(drawer);
  }

  function closeCart() {
    var drawer =
      $("cartDrawer");

    if (!drawer) {
      return;
    }

    var wasOpen =
      drawer.classList.contains(
        "open"
      );

    releaseFocus(drawer);

    drawer.classList.remove(
      "open"
    );

    syncOverlay();

    if (
      wasOpen &&
      lastFocus.cart &&
      typeof lastFocus.cart.focus ===
        "function"
    ) {
      try {
        lastFocus.cart.focus();
      } catch (e) {}
    }

    lastFocus.cart = null;
  }

  /* ---------- customer session & checkout ---------- */

  function customerAuthHeaders() {
    var h = {
      "Content-Type":
        "application/json"
    };

    try {
      var token =
        localStorage.getItem(
          "nb-customer-token"
        ) || "";

      if (token) {
        h.Authorization =
          "Bearer " + token;
      }
    } catch (e) {}

    return h;
  }

  async function ensureCustomerSession() {
    try {
      var res = await fetch(
        "/api/customer/me",
        {
          credentials: "include",
          headers:
            customerAuthHeaders()
        }
      );

      if (!res.ok) {
        return null;
      }

      var data =
        await res.json();

      window.__NASTRO_CUSTOMER =
        data.customer || null;

      return (
        data.customer || null
      );
    } catch (e) {
      window.__NASTRO_CUSTOMER =
        null;

      return null;
    }
  }

  async function placeOrderAndCheckout() {
    if (!state.cart.length) {
      toast(
        "Add something to your cart first"
      );
      return;
    }

    var customer =
      await ensureCustomerSession();

    if (!customer) {
      toast(
        "Please sign in to checkout"
      );

      window.location.href =
        "account.html?next=checkout";

      return;
    }

    var btn =
      $("checkoutWa");

    if (btn) {
      btn.disabled = true;
      btn.textContent =
        "Saving order…";
    }

    try {
      var res = await fetch(
        "/api/orders",
        {
          method: "POST",
          credentials: "include",
          headers:
            customerAuthHeaders(),

          body: JSON.stringify({
            items:
              state.cart.map(
                function (i) {
                  return {
                    productId:
                      i.id,
                    size:
                      i.size,
                    qty:
                      i.qty
                  };
                }
              ),

            shippingAddress:
              customer.address ||
              {},

            notes: ""
          })
        }
      );

      var data = {};

      try {
        data =
          await res.json();
      } catch (e) {}

      if (res.status === 401) {
        toast(
          "Please sign in to checkout"
        );

        window.location.href =
          "account.html?next=checkout";

        return;
      }

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Could not place order"
        );
      }

      state.cart = [];

      saveCart();
      renderCart();

      toast(
        "Order " +
          (data.order &&
          data.order.orderNumber
            ? data.order.orderNumber
            : "") +
          " saved"
      );

      closeCart();

      if (data.whatsappUrl) {
        var w =
          window.open(
            data.whatsappUrl,
            "_blank"
          );

        if (w) {
          try {
            w.opener = null;
          } catch (e) {}
        } else {
          window.location.href =
            data.whatsappUrl;
        }
      }
    } catch (err) {
      toast(
        err.message ||
          "Checkout failed"
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent =
          "Checkout";
      }
    }
  }

  /* ---------- filter / search ---------- */

  function onCategoryPage() {
    return /category\.html/i.test(
      window.location.pathname
    );
  }

  function setFilter(id) {
    if (!onCategoryPage()) {
      // From the homepage, clicking a category
      // takes the shopper to its own listing page.
      window.location.href =
        "category.html?cat=" +
        encodeURIComponent(id);

      return;
    }

    state.filter = id;

    // A category click starts fresh
    // and resets pagination.
    state.query = "";

    var searchEl =
      $("productSearch");

    if (searchEl) {
      searchEl.value = "";
    }

    state.visibleCount =
      PRODUCTS_PER_PAGE;

    try {
      var url = new URL(
        window.location.href
      );

      url.searchParams.set(
        "cat",
        id
      );

      history.replaceState(
        null,
        "",
        url.toString()
      );
    } catch (e) {}

    renderFilters();
    renderCategories();
    renderProducts();

    var shop = $("shop");

    if (shop) {
      shop.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  function setSearch(q) {
    state.query = q || "";

    // Search starts from the first page of products
    state.visibleCount =
      PRODUCTS_PER_PAGE;

    renderProducts();
  }

  /* ---------- delegated clicks ---------- */

  function onClick(e) {
    var t =
      e.target.closest(
        "[data-filter],[data-add],[data-view],[data-size],[data-rm],[data-show-more],[data-show-less]"
      );

    if (!t) {
      return;
    }

    // SHOW LESS
    if (
      t.dataset.showLess !==
      undefined
    ) {
      state.visibleCount =
        PRODUCTS_PER_PAGE;

      renderProducts();

      return;
    }

    // SHOW MORE
    if (
      t.dataset.showMore !==
      undefined
    ) {
      state.visibleCount +=
        PRODUCTS_PER_PAGE;

      renderProducts();

      return;
    }

    if (t.dataset.filter) {
      // Category cards on the shop grid are real
      // <a> links (so ctrl/cmd-click still works);
      // don't double-navigate on top of that.
      if (
        t.tagName === "A" &&
        t.getAttribute("href")
      ) {
        return;
      }

      e.preventDefault();

      setFilter(
        t.dataset.filter
      );

      return;
    }

    if (t.dataset.add) {
      addToCart(
        t.dataset.add,
        0,
        1
      );

      return;
    }

    if (t.dataset.view) {
      openModal(
        t.dataset.view
      );

      return;
    }

    if (t.dataset.size != null) {
      state.sizeIndex =
        Number(
          t.dataset.size
        );

      renderSizes();
      updateModalPrice();

      return;
    }

    if (t.dataset.rm) {
      state.cart =
        state.cart.filter(
          function (i) {
            return (
              (i.key ||
                i.id +
                  "::" +
                  i.size) !==
              t.dataset.rm
            );
          }
        );

      saveCart();
      renderCart();
    }
  }

  /* ---------- account nav ---------- */

  async function refreshAccountNav() {
    var labels =
      document.querySelectorAll(
        "[data-account-label]"
      );

    if (!labels.length) {
      return;
    }

    try {
      var token =
        localStorage.getItem(
          "nb-customer-token"
        ) || "";

      var headers = token
        ? {
            Authorization:
              "Bearer " +
              token
          }
        : {};

      var res = await fetch(
        "/api/customer/me",
        {
          credentials:
            "include",
          headers: headers
        }
      );

      if (!res.ok) {
        throw new Error(
          "guest"
        );
      }

      var data =
        await res.json();

      window.__NASTRO_CUSTOMER =
        data.customer || null;

      labels.forEach(
        function (el) {
          el.textContent =
            "Account";
        }
      );
    } catch (e) {
      window.__NASTRO_CUSTOMER =
        null;

      labels.forEach(
        function (el) {
          el.textContent =
            "Login";
        }
      );
    }
  }

  /* ---------- init ---------- */

  document.addEventListener(
    "DOMContentLoaded",
    async function () {
      await loadCatalogFromApi();

      // SEO / SearchAction:
      // ?q=term opens shop filtered
      // ?cat=id opens a specific category (category.html)
      try {
        var urlParams =
          new URLSearchParams(
            window.location.search
          );

        var qParam =
          urlParams.get("q");

        var catParam =
          urlParams.get("cat");

        if (catParam) {
          state.filter =
            catParam;
        }

        if (qParam) {
          state.query =
            qParam;

          var searchEl =
            $("productSearch");

          if (searchEl) {
            searchEl.value =
              qParam;
          }
        }
      } catch (e) {}

      renderFilters();
      renderCategories();
      renderShopCategories();
      renderSort();
      renderProducts();
      renderFeatured();
      initBanner();
      updateCartCount();
      renderCart();
      refreshAccountNav();

      on(
        "sortSelect",
        "change",
        function () {
          setSort(this.value);
        }
      );

      document.body.addEventListener(
        "click",
        onClick
      );

      var search =
        $("productSearch");

      if (search) {
        var searchTimer =
          null;

        search.addEventListener(
          "input",
          function () {
            var value =
              search.value;

            clearTimeout(
              searchTimer
            );

            searchTimer =
              setTimeout(
                function () {
                  setSearch(
                    value
                  );
                },
                160
              );
          }
        );

        search.addEventListener(
          "keydown",
          function (e) {
            if (
              e.key ===
              "Escape"
            ) {
              search.value = "";
              setSearch("");
            }
          }
        );
      }

      // Homepage-only search box: it has no product
      // grid to filter, so it redirects into the
      // category listing page instead.
      var shopSearch =
        $("shopSearch");

      if (shopSearch) {
        var goShopSearch =
          function () {
            var value =
              shopSearch.value.trim();

            if (!value) {
              return;
            }

            window.location.href =
              "category.html?cat=all&q=" +
              encodeURIComponent(
                value
              );
          };

        shopSearch.addEventListener(
          "keydown",
          function (e) {
            if (
              e.key === "Enter"
            ) {
              e.preventDefault();
              goShopSearch();
            }
          }
        );

        // Navigate once the shopper is done typing
        // (leaves the field), not mid-word on every
        // keystroke pause.
        shopSearch.addEventListener(
          "blur",
          goShopSearch
        );
      }

      var nav = $("nav");
      var scrollCue = document.querySelector(".scrollcue");
      var toTop = $("toTop");

      var onScroll =
        function () {
          if (nav) {
            nav.classList.toggle(
              "scrolled",
              window.scrollY > 40
            );
          }

          // Hero "SCROLL" cue fades out once the user scrolls
          if (scrollCue) {
            scrollCue.classList.toggle(
              "is-hidden",
              window.scrollY > 40
            );
          }

          // Back-to-top button appears once the shopper has
          // scrolled a meaningful distance, not just near the
          // very bottom of a long (150+ product) page.
          if (toTop) {
            toTop.classList.toggle(
              "is-visible",
              window.scrollY > 600
            );
          }
        };

      if (toTop) {
        toTop.addEventListener(
          "click",
          function () {
            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });
          }
        );
      }

      window.addEventListener(
        "scroll",
        onScroll,
        {
          passive: true
        }
      );

      onScroll();

      var toggle =
        $("navToggle");

      var links =
        $("navLinks");

      if (toggle && links) {
        toggle.addEventListener(
          "click",
          function () {
            links.classList.toggle(
              "open"
            );
          }
        );

        links
          .querySelectorAll("a")
          .forEach(
            function (a) {
              a.addEventListener(
                "click",
                function () {
                  links.classList.remove(
                    "open"
                  );
                }
              );
            }
          );
      }

      on(
        "cartBtn",
        "click",
        openCart
      );

      on(
        "closeCart",
        "click",
        closeCart
      );

      on(
        "overlay",
        "click",
        function () {
          closeModal();
          closeCart();
        }
      );

      on(
        "closeModal",
        "click",
        closeModal
      );

      on(
        "qtyMinus",
        "click",
        function () {
          state.qty =
            Math.max(
              1,
              state.qty - 1
            );

          setText(
            "modalQty",
            String(
              state.qty
            )
          );
        }
      );

      on(
        "qtyPlus",
        "click",
        function () {
          state.qty =
            Math.min(
              MAX_QTY,
              state.qty + 1
            );

          setText(
            "modalQty",
            String(
              state.qty
            )
          );
        }
      );

      on(
        "modalAdd",
        "click",
        function () {
          if (
            !state.activeProduct ||
            isUnavailable(
              state.activeProduct
            )
          ) {
            return;
          }

          addToCart(
            state.activeProduct.id,
            state.sizeIndex,
            state.qty
          );

          closeModal();
          openCart();
        }
      );

      on(
        "checkoutWa",
        "click",
        function (e) {
          e.preventDefault();
          placeOrderAndCheckout();
        }
      );

      // Escape closes whichever panel is open
      // Modal first, then cart
      document.addEventListener(
        "keydown",
        function (e) {
          if (
            e.key !==
            "Escape"
          ) {
            return;
          }

          var modal =
            $("productModal");

          var drawer =
            $("cartDrawer");

          if (
            modal &&
            modal.classList.contains(
              "open"
            )
          ) {
            closeModal();
          } else if (
            drawer &&
            drawer.classList.contains(
              "open"
            )
          ) {
            closeCart();
          }
        }
      );

      // Used by Today's Special popup
      // on the homepage
      window.__nastroAddToCart =
        function (id) {
          addToCart(
            id,
            0,
            1
          );

          openCart();
        };

      // After login redirect back
      // to cart checkout
      try {
        if (
          new URLSearchParams(
            window.location.search
          ).get(
            "checkout"
          ) === "1"
        ) {
          openCart();
        }
      } catch (e) {}

      var reveals =
        document.querySelectorAll(
          ".reveal"
        );

      if (
        "IntersectionObserver" in
        window
      ) {
        var io =
          new IntersectionObserver(
            function (entries) {
              entries.forEach(
                function (
                  entry
                ) {
                  if (
                    entry.isIntersecting
                  ) {
                    entry.target.classList.add(
                      "in"
                    );

                    io.unobserve(
                      entry.target
                    );
                  }
                }
              );
            },
            {
              threshold: 0.12,
              rootMargin:
                "0px 0px -6% 0px"
            }
          );

        reveals.forEach(
          function (el) {
            io.observe(el);
          }
        );
      } else {
        reveals.forEach(
          function (el) {
            el.classList.add(
              "in"
            );
          }
        );
      }
    }
  );
})();