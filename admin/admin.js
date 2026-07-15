(function () {
  var API = "/api";
  var token = localStorage.getItem("nb-admin-token") || "";
  var products = [];
  var selectedId = null;

  function $(id) {
    return document.getElementById(id);
  }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    if (token) headers.Authorization = "Bearer " + token;
    var res = await fetch(API + path, Object.assign({}, options, { headers: headers }));
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function showApp(show) {
    $("loginView").hidden = show;
    $("appView").hidden = !show;
  }

  function fillForm(p) {
    selectedId = p ? p.id : null;
    $("formTitle").textContent = p ? "Edit product" : "Add product";
    $("docId").value = p && p._id ? p._id : "";
    $("name").value = (p && p.name) || "";
    $("brand").value = (p && p.brand) || "Nastro Blu";
    $("category").value = (p && p.category) || "produce";
    $("tag").value = (p && p.tag) || "";
    $("price").value = p ? p.price : "";
    $("mrp").value = p ? p.mrp : "";
    $("netQuantity").value = (p && p.netQuantity) || "";
    $("unit").value = (p && p.unit) || "";
    $("sku").value = (p && p.sku) || "";
    $("barcode").value = (p && p.barcode) || "";
    $("packedOn").value = (p && p.packedOn) || "";
    $("bestBefore").value = (p && p.bestBefore) || "";
    $("image").value = (p && p.image) || "assets/products/grains.jpg";
    $("slug").value = (p && p.id) || "";
    $("blurb").value = (p && p.blurb) || "";
    $("description").value = (p && p.description) || "";
    $("ingredients").value = (p && p.ingredients) || "";
    $("specifications").value = ((p && p.specifications) || []).join("\n");
    $("packagingText").value = ((p && p.packagingText) || []).join("\n");
    $("storage").value = (p && p.storage) || "";
    $("origin").value = (p && p.origin) || "";
    $("active").checked = !p || p.active !== false;
    $("formMsg").hidden = true;
    renderList();
  }

  function renderList() {
    var q = ($("search").value || "").toLowerCase();
    var list = products.filter(function (p) {
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().indexOf(q) >= 0 ||
        (p.sku || "").toLowerCase().indexOf(q) >= 0 ||
        (p.id || "").toLowerCase().indexOf(q) >= 0
      );
    });
    $("productList").innerHTML = list
      .map(function (p) {
        return (
          '<button type="button" data-id="' +
          p.id +
          '" class="' +
          (selectedId === p.id ? "active" : "") +
          '">' +
          '<span class="name">' +
          p.name +
          (p.active === false ? " (archived)" : "") +
          "</span>" +
          '<span class="meta">MRP ₹' +
          p.mrp +
          " · Sell ₹" +
          p.price +
          " · " +
          (p.sku || p.id) +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  async function loadProducts() {
    var data = await api("/products?all=1");
    products = data.products || [];
    renderList();
    if (!selectedId && products[0]) fillForm(products[0]);
    else if (selectedId) {
      var current = products.find(function (p) {
        return p.id === selectedId;
      });
      if (current) fillForm(current);
    }
  }

  function formPayload() {
    return {
      name: $("name").value.trim(),
      brand: $("brand").value.trim(),
      category: $("category").value,
      tag: $("tag").value.trim() || null,
      price: Number($("price").value),
      mrp: Number($("mrp").value),
      netQuantity: $("netQuantity").value.trim(),
      unit: $("unit").value.trim() || $("netQuantity").value.trim(),
      sku: $("sku").value.trim(),
      barcode: $("barcode").value.trim(),
      packedOn: $("packedOn").value.trim(),
      bestBefore: $("bestBefore").value.trim(),
      image: $("image").value.trim(),
      slug: $("slug").value.trim(),
      blurb: $("blurb").value.trim(),
      description: $("description").value.trim(),
      ingredients: $("ingredients").value.trim(),
      specifications: $("specifications").value,
      packagingText: $("packagingText").value,
      storage: $("storage").value.trim(),
      origin: $("origin").value.trim(),
      active: $("active").checked,
      sizes: [
        {
          label: $("unit").value.trim() || $("netQuantity").value.trim() || "1 unit",
          price: Number($("price").value),
          sku: $("sku").value.trim(),
        },
      ],
    };
  }

  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    $("loginError").hidden = true;
    try {
      var data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("email").value.trim(),
          password: $("password").value,
        }),
      });
      token = data.token;
      localStorage.setItem("nb-admin-token", token);
      $("adminEmail").textContent = data.admin.email;
      showApp(true);
      await loadProducts();
    } catch (err) {
      $("loginError").textContent = err.message;
      $("loginError").hidden = false;
    }
  });

  $("btnLogout").addEventListener("click", function () {
    token = "";
    localStorage.removeItem("nb-admin-token");
    showApp(false);
  });

  $("btnNew").addEventListener("click", function () {
    fillForm(null);
  });

  $("search").addEventListener("input", renderList);

  $("productList").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-id]");
    if (!btn) return;
    var p = products.find(function (x) {
      return x.id === btn.dataset.id;
    });
    if (p) fillForm(p);
  });

  $("productForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var payload = formPayload();
    try {
      if (selectedId) {
        await api("/products/" + encodeURIComponent(selectedId), {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        var created = await api("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        selectedId = created.product.id;
      }
      $("formMsg").textContent = "Saved";
      $("formMsg").hidden = false;
      await loadProducts();
    } catch (err) {
      $("formMsg").textContent = err.message;
      $("formMsg").hidden = false;
      $("formMsg").style.color = "#9b1c1c";
    }
  });

  $("btnArchive").addEventListener("click", async function () {
    if (!selectedId) return;
    if (!confirm("Archive this product from the storefront?")) return;
    await api("/products/" + encodeURIComponent(selectedId), { method: "DELETE" });
    selectedId = null;
    await loadProducts();
  });

  (async function boot() {
    if (!token) return;
    try {
      var me = await api("/auth/me");
      $("adminEmail").textContent = me.admin.email;
      showApp(true);
      await loadProducts();
    } catch (err) {
      token = "";
      localStorage.removeItem("nb-admin-token");
    }
  })();
})();
