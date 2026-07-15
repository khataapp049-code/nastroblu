(function () {
  var WA = "919063048255";
  var catalog = window.NASTRO_CATALOG || { categories: [], products: [] };
  var state = {
    filter: "all",
    cart: loadCart(),
    activeProduct: null,
    sizeIndex: 0,
    qty: 1,
  };

  function setCatalog(data) {
    if (!data) return;
    catalog = data;
    window.NASTRO_CATALOG = data;
  }

  async function loadCatalogFromApi() {
    try {
      var res = await fetch("/api/products");
      if (!res.ok) throw new Error("api");
      var data = await res.json();
      if (data && Array.isArray(data.products) && data.products.length) {
        setCatalog({
          categories: data.categories || catalog.categories,
          products: data.products,
        });
      }
    } catch (err) {
      console.warn("Using local catalog fallback", err);
    }
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem("nastro-cart") || "[]");
    } catch (e) {
      return [];
    }
  }
  function saveCart() {
    localStorage.setItem("nastro-cart", JSON.stringify(state.cart));
    updateCartCount();
  }
  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }
  function savePct(price, mrp) {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  }
  function cartCount() {
    return state.cart.reduce(function (s, i) {
      return s + i.qty;
    }, 0);
  }
  function cartTotal() {
    return state.cart.reduce(function (s, i) {
      return s + i.price * i.qty;
    }, 0);
  }
  function updateCartCount() {
    var el = document.getElementById("cartCount");
    if (el) el.textContent = String(cartCount());
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      t.classList.remove("show");
    }, 2200);
  }

  function renderFilters() {
    var row = document.getElementById("filterRow");
    if (!row) return;
    row.innerHTML = catalog.categories
      .map(function (c) {
        return (
          '<button type="button" class="filter-chip' +
          (state.filter === c.id ? " active" : "") +
          '" data-filter="' +
          c.id +
          '">' +
          c.name +
          "</button>"
        );
      })
      .join("");
  }

  function renderCategories() {
    var strip = document.getElementById("catStrip");
    if (!strip) return;
    strip.innerHTML = catalog.categories
      .filter(function (c) {
        return c.id !== "all";
      })
      .map(function (c) {
        return (
          '<button type="button" class="cat-card' +
          (state.filter === c.id ? " active" : "") +
          '" data-filter="' +
          c.id +
          '"><div class="ic">' +
          c.icon +
          '</div><div class="nm">' +
          c.name +
          "</div></button>"
        );
      })
      .join("");
  }

  function filteredProducts() {
    var f = state.filter;
    if (f === "all") return catalog.products;
    if (f === "bestsellers") {
      return catalog.products.filter(function (p) {
        return p.tag === "Best Seller" || p.tag === "Trending";
      });
    }
    if (f === "new") {
      return catalog.products.filter(function (p) {
        return p.tag === "New" || p.tag === "Must Try";
      });
    }
    if (f === "under999") {
      return catalog.products.filter(function (p) {
        return p.price < 999;
      });
    }
    return catalog.products.filter(function (p) {
      return p.category === f;
    });
  }

  function filterLabel(id) {
    var map = {
      all: "All products",
      bestsellers: "Best sellers",
      new: "New launches",
      under999: "Under ₹999",
      honey: "Honey",
      produce: "Naturally Grown Produce",
      oils: "Cold Pressed Oils",
      spices: "Kerala Spices",
      dryfruits: "Kashmiri Dry Fruits",
      sweets: "Traditional Sweets & Snacks",
      ghee: "Dairy & Ghee",
    };
    return map[id] || "All products";
  }

  function productCardHtml(p) {
    var save = savePct(p.price, p.mrp);
    return (
      '<article class="pcard">' +
      '<div class="pcard__media">' +
      (p.tag ? '<span class="pcard__badge">' + p.tag + "</span>" : "") +
      (save ? '<span class="pcard__save">Save ' + save + "%</span>" : "") +
      '<a href="product.html?id=' +
      p.id +
      '"><img src="' +
      p.image +
      '" alt="' +
      p.name +
      '" loading="lazy" /></a>' +
      "</div>" +
      '<div class="pcard__body">' +
      '<div class="pcard__rating"><b>★ ' +
      p.rating.toFixed(1) +
      "</b> · " +
      p.reviews +
      " reviews</div>" +
      "<h3>" +
      '<a href="product.html?id=' +
      p.id +
      '">' +
      p.name +
      "</a>" +
      "</h3>" +
      '<p class="pcard__blurb">' +
      p.blurb +
      "</p>" +
      '<div class="pcard__sku">SKU ' +
      p.sku +
      " · MRP " +
      inr(p.mrp) +
      "</div>" +
      '<div class="pcard__price"><span class="now">' +
      inr(p.price) +
      '</span><span class="was">' +
      inr(p.mrp) +
      '</span><span class="unit">/ ' +
      p.unit +
      "</span></div>" +
      '<div class="pcard__actions">' +
      '<button type="button" class="btn btn--wine" data-add="' +
      p.id +
      '">Add to cart</button>' +
      '<a class="btn btn--ghost" href="product.html?id=' +
      p.id +
      '" style="border-color:var(--wine);color:var(--wine)">Details</a>' +
      "</div></div></article>"
    );
  }

  function renderProducts() {
    var grid = document.getElementById("productGrid");
    var count = document.getElementById("productCount");
    var title = document.getElementById("shopTitle");
    var list = filteredProducts();
    if (count) count.textContent = list.length + " products";
    if (title) title.textContent = filterLabel(state.filter);
    if (!grid) return;
    grid.innerHTML = list.map(productCardHtml).join("");
    document.querySelectorAll(".collection-chip").forEach(function (chip) {
      chip.classList.toggle("active", chip.dataset.filter === state.filter);
    });
  }

  function renderFeatured() {
    var grid = document.getElementById("featuredGrid");
    if (!grid) return;
    var list = catalog.products
      .filter(function (p) {
        return p.tag === "Best Seller" || p.tag === "Trending";
      })
      .slice(0, 4);
    grid.innerHTML = list.map(productCardHtml).join("");
  }

  function initBanner() {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".banner__slide"));
    var dotsWrap = document.getElementById("bannerDots");
    if (!slides.length || !dotsWrap) return;
    var index = 0;
    var timer;

    dotsWrap.innerHTML = slides
      .map(function (_, i) {
        return '<button type="button" aria-label="Go to slide ' + (i + 1) + '"' + (i === 0 ? ' class="is-active"' : "") + ' data-dot="' + i + '"></button>';
      })
      .join("");

    function go(n) {
      index = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        s.classList.toggle("is-active", i === index);
      });
      dotsWrap.querySelectorAll("button").forEach(function (d, i) {
        d.classList.toggle("is-active", i === index);
      });
    }

    function next() {
      go(index + 1);
    }
    function prev() {
      go(index - 1);
    }
    function restart() {
      clearInterval(timer);
      timer = setInterval(next, 5500);
    }

    document.getElementById("bannerNext").addEventListener("click", function () {
      next();
      restart();
    });
    document.getElementById("bannerPrev").addEventListener("click", function () {
      prev();
      restart();
    });
    dotsWrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-dot]");
      if (!btn) return;
      go(Number(btn.dataset.dot));
      restart();
    });
    restart();
  }

  function findProduct(id) {
    return catalog.products.find(function (p) {
      return p.id === id;
    });
  }

  function openModal(id) {
    var p = findProduct(id);
    if (!p) return;
    state.activeProduct = p;
    state.sizeIndex = 0;
    state.qty = 1;
    var modal = document.getElementById("productModal");
    document.getElementById("modalImg").src = p.image;
    document.getElementById("modalImg").alt = p.name;
    document.getElementById("modalName").textContent = p.name;
    document.getElementById("modalBlurb").textContent = p.blurb;
    document.getElementById("modalDesc").innerHTML =
      p.description +
      '<div class="modal-meta">' +
      "<div><b>Brand</b> " +
      (p.brand || "Nastro Blu") +
      "</div>" +
      "<div><b>MRP</b> " +
      inr(p.mrp) +
      "</div>" +
      "<div><b>Net qty</b> " +
      p.netQuantity +
      "</div>" +
      "<div><b>SKU</b> " +
      p.sku +
      "</div>" +
      "<div><b>Barcode</b> " +
      p.barcode +
      "</div>" +
      "<div><b>Packed</b> " +
      p.packedOn +
      "</div>" +
      "<div><b>Best before</b> " +
      p.bestBefore +
      "</div>" +
      "</div>" +
      '<a class="modal-full" href="product.html?id=' +
      p.id +
      '">Open full packaging specification →</a>';
    document.getElementById("modalRating").textContent =
      "★ " + p.rating.toFixed(1) + " · " + p.reviews + " reviews";
    renderSizes();
    updateModalPrice();
    document.getElementById("modalQty").textContent = String(state.qty);
    modal.classList.add("open");
    document.getElementById("overlay").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function renderSizes() {
    var p = state.activeProduct;
    var box = document.getElementById("modalSizes");
    box.innerHTML = p.sizes
      .map(function (s, i) {
        return (
          '<button type="button" class="size-chip' +
          (i === state.sizeIndex ? " active" : "") +
          '" data-size="' +
          i +
          '">' +
          s.label +
          " · " +
          inr(s.price) +
          "</button>"
        );
      })
      .join("");
  }

  function updateModalPrice() {
    var p = state.activeProduct;
    var size = p.sizes[state.sizeIndex];
    var html = inr(size.price);
    if (p.mrp && state.sizeIndex === 0) {
      html += '<span class="was">' + inr(p.mrp) + "</span>";
    }
    document.getElementById("modalPrice").innerHTML = html;
  }

  function closeModal() {
    document.getElementById("productModal").classList.remove("open");
    if (!document.getElementById("cartDrawer").classList.contains("open")) {
      document.getElementById("overlay").classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  function addToCart(id, sizeIndex, qty) {
    var p = findProduct(id);
    if (!p) return;
    var si = typeof sizeIndex === "number" ? sizeIndex : 0;
    var size = p.sizes[si] || p.sizes[0];
    var q = qty || 1;
    var key = p.id + "::" + size.label;
    var existing = state.cart.find(function (i) {
      return i.key === key;
    });
    if (existing) {
      existing.qty += q;
    } else {
      state.cart.push({
        key: key,
        id: p.id,
        name: p.name,
        size: size.label,
        price: size.price,
        image: p.image,
        qty: q,
      });
    }
    saveCart();
    renderCart();
    toast(p.name + " added to cart");
  }

  function renderCart() {
    var body = document.getElementById("cartBody");
    var total = document.getElementById("cartTotal");
    if (!body) return;
    if (!state.cart.length) {
      body.innerHTML =
        '<div class="drawer__empty">Your cart is empty.<br/>Browse the pantry and add something honest.</div>';
    } else {
      body.innerHTML = state.cart
        .map(function (i) {
          return (
            '<div class="cart-item">' +
            '<img src="' +
            i.image +
            '" alt="" />' +
            "<div><h4>" +
            i.name +
            '</h4><div class="meta">' +
            i.size +
            " × " +
            i.qty +
            '</div><button type="button" class="rm" data-rm="' +
            i.key +
            '">Remove</button></div>' +
            '<div class="line">' +
            inr(i.price * i.qty) +
            "</div></div>"
          );
        })
        .join("");
    }
    if (total) total.textContent = inr(cartTotal());
  }

  function openCart() {
    document.getElementById("cartDrawer").classList.add("open");
    document.getElementById("overlay").classList.add("open");
    document.body.style.overflow = "hidden";
    renderCart();
  }
  function closeCart() {
    document.getElementById("cartDrawer").classList.remove("open");
    if (!document.getElementById("productModal").classList.contains("open")) {
      document.getElementById("overlay").classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  function waOrderUrl() {
    var lines = ["Hi Nastro Blu! I'd like to order:"];
    state.cart.forEach(function (i) {
      lines.push("• " + i.name + " (" + i.size + ") × " + i.qty + " — " + inr(i.price * i.qty));
    });
    lines.push("");
    lines.push("Total: " + inr(cartTotal()));
    lines.push("Please confirm availability & delivery.");
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  function setFilter(id) {
    state.filter = id;
    renderFilters();
    renderCategories();
    renderProducts();
    var shop = document.getElementById("shop");
    if (shop) shop.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onClick(e) {
    var t = e.target.closest("[data-filter],[data-add],[data-view],[data-size],[data-rm]");
    if (!t) return;
    if (t.dataset.filter) {
      setFilter(t.dataset.filter);
      return;
    }
    if (t.dataset.add) {
      addToCart(t.dataset.add, 0, 1);
      return;
    }
    if (t.dataset.view) {
      openModal(t.dataset.view);
      return;
    }
    if (t.dataset.size != null) {
      state.sizeIndex = Number(t.dataset.size);
      renderSizes();
      updateModalPrice();
      return;
    }
    if (t.dataset.rm) {
      state.cart = state.cart.filter(function (i) {
        return i.key !== t.dataset.rm;
      });
      saveCart();
      renderCart();
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    await loadCatalogFromApi();
    renderFilters();
    renderCategories();
    renderProducts();
    renderFeatured();
    initBanner();
    updateCartCount();
    renderCart();

    document.body.addEventListener("click", onClick);

    var nav = document.getElementById("nav");
    var onScroll = function () {
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var toggle = document.getElementById("navToggle");
    var links = document.getElementById("navLinks");
    if (toggle && links) {
      toggle.addEventListener("click", function () {
        links.classList.toggle("open");
      });
      links.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          links.classList.remove("open");
        });
      });
    }

    document.getElementById("cartBtn").addEventListener("click", openCart);
    document.getElementById("closeCart").addEventListener("click", closeCart);
    document.getElementById("overlay").addEventListener("click", function () {
      closeModal();
      closeCart();
    });
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("qtyMinus").addEventListener("click", function () {
      state.qty = Math.max(1, state.qty - 1);
      document.getElementById("modalQty").textContent = String(state.qty);
    });
    document.getElementById("qtyPlus").addEventListener("click", function () {
      state.qty += 1;
      document.getElementById("modalQty").textContent = String(state.qty);
    });
    document.getElementById("modalAdd").addEventListener("click", function () {
      if (!state.activeProduct) return;
      addToCart(state.activeProduct.id, state.sizeIndex, state.qty);
      closeModal();
      openCart();
    });
    document.getElementById("checkoutWa").addEventListener("click", function (e) {
      if (!state.cart.length) {
        e.preventDefault();
        toast("Add something to your cart first");
        return;
      }
      e.currentTarget.href = waOrderUrl();
    });

    var reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (es) {
          es.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
      reveals.forEach(function (el) {
        io.observe(el);
      });
    } else {
      reveals.forEach(function (el) {
        el.classList.add("in");
      });
    }
  });
})();
