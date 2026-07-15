/* Shared cart + helpers for Nastro Blu internal storefront */
(function (global) {
  var WA = (global.NASTRO_BRAND && global.NASTRO_BRAND.whatsapp) || "919063048255";

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem("nastro-cart") || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem("nastro-cart", JSON.stringify(cart));
  }

  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }

  function cartCount(cart) {
    return (cart || loadCart()).reduce(function (s, i) {
      return s + i.qty;
    }, 0);
  }

  function cartTotal(cart) {
    return (cart || loadCart()).reduce(function (s, i) {
      return s + i.price * i.qty;
    }, 0);
  }

  function findProduct(id) {
    var catalog = global.NASTRO_CATALOG;
    if (!catalog) return null;
    return catalog.products.find(function (p) {
      return p.id === id;
    });
  }

  async function loadCatalogFromApi() {
    try {
      var res = await fetch("/api/products");
      if (!res.ok) throw new Error("api");
      var data = await res.json();
      if (data && Array.isArray(data.products) && data.products.length) {
        global.NASTRO_CATALOG = {
          categories: data.categories || (global.NASTRO_CATALOG && global.NASTRO_CATALOG.categories) || [],
          products: data.products,
        };
      }
    } catch (err) {
      console.warn("Using local catalog fallback", err);
    }
  }

  function addToCart(id, sizeIndex, qty) {
    var p = findProduct(id);
    if (!p) return;
    var si = typeof sizeIndex === "number" ? sizeIndex : 0;
    var size = p.sizes[si] || p.sizes[0];
    var q = qty || 1;
    var key = p.id + "::" + size.label;
    var cart = loadCart();
    var existing = cart.find(function (i) {
      return i.key === key;
    });
    if (existing) existing.qty += q;
    else {
      cart.push({
        key: key,
        id: p.id,
        name: p.name,
        size: size.label,
        price: size.price,
        sku: size.sku || p.sku,
        image: p.image,
        qty: q,
      });
    }
    saveCart(cart);
    return cart;
  }

  function waOrderUrl(cart) {
    cart = cart || loadCart();
    var lines = ["Hi Nastro Blu! I'd like to order:"];
    cart.forEach(function (i) {
      lines.push(
        "• " +
          i.name +
          " (" +
          i.size +
          ")" +
          (i.sku ? " [" + i.sku + "]" : "") +
          " × " +
          i.qty +
          " — " +
          inr(i.price * i.qty)
      );
    });
    lines.push("");
    lines.push("Total: " + inr(cartTotal(cart)));
    lines.push("Please confirm availability & delivery.");
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  function updateCartBadges() {
    var n = String(cartCount());
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = n;
    });
  }

  global.Nastro = {
    loadCart: loadCart,
    saveCart: saveCart,
    inr: inr,
    cartCount: cartCount,
    cartTotal: cartTotal,
    findProduct: findProduct,
    addToCart: addToCart,
    waOrderUrl: waOrderUrl,
    updateCartBadges: updateCartBadges,
    loadCatalogFromApi: loadCatalogFromApi,
    WA: WA,
  };
})(window);
