/* Shared cart + helpers for Nastro Blu internal storefront */
(function (global) {
 var WA = (global.NASTRO_BRAND && global.NASTRO_BRAND.whatsapp) || "919063048255";

 function normalizeCartItem(i) {
 if (!i || typeof i !== "object") return null;
 var qty = Math.max(1, Math.min(99, Math.floor(Number(i.qty)) || 1));
 var price = Number(i.price);
 if (!Number.isFinite(price) || price < 0) price = 0;
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
 // key must survive the save/load round-trip, otherwise Remove has nothing
 // to match on and repeat adds create duplicate rows.
 key: String(i.key || id + "::" + size),
 };
 }

 // Merge rows that share a key (heals carts saved before key was persisted)
 function mergeCartItems(list) {
 var byKey = {};
 var out = [];
 (list || []).forEach(function (i) {
 if (!i) return;
 var found = byKey[i.key];
 if (found) {
 found.qty = Math.max(1, Math.min(99, found.qty + i.qty));
 } else {
 byKey[i.key] = i;
 out.push(i);
 }
 });
 return out;
 }

 function loadCart() {
 try {
 var raw = JSON.parse(localStorage.getItem("nastro-cart") || "[]");
 if (!Array.isArray(raw)) return [];
 return mergeCartItems(raw.map(normalizeCartItem).filter(Boolean));
 } catch (e) {
 return [];
 }
 }

 function saveCart(cart) {
 try {
 localStorage.setItem("nastro-cart", JSON.stringify(cart || []));
 } catch (e) {
 /* private mode / quota */
 }
 }

 function inr(n) {
 return "₹" + Number(n).toLocaleString("en-IN");
 }

 function cartCount(cart) {
 return (cart || loadCart()).reduce(function (s, i) {
 return s + (Number(i.qty) || 0);
 }, 0);
 }

 function cartTotal(cart) {
 return (cart || loadCart()).reduce(function (s, i) {
 return s + (Number(i.price) || 0) * (Number(i.qty) || 0);
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

 function isUnavailable(p) {
 if (!p) return true;
 var st = p.status || (p.active === false ? "unavailable" : "available");
 return st === "unavailable";
 }

 function syncCartPrices(cart) {
 cart = cart || loadCart();
 var catalog = global.NASTRO_CATALOG || { products: [] };
 var list = catalog.products || [];
 var changed = false;
 var next = cart
 .map(function (i) {
 var p = list.find(function (x) {
 return x.id === i.id;
 });
 if (!p) return i;
 if (isUnavailable(p)) {
 changed = true;
 return null;
 }
 var size =
 (p.sizes || []).find(function (s) {
 return s.label === i.size;
 }) || (p.sizes && p.sizes[0]);
 if (!size) return i;
 if (i.price !== size.price || i.name !== p.name) {
 changed = true;
 return Object.assign({}, i, {
 name: p.name,
 price: size.price,
 image: p.image,
 size: size.label,
 key: p.id + "::" + size.label,
 sku: size.sku || p.sku,
 });
 }
 return i;
 })
 .filter(Boolean);
 if (changed) saveCart(next);
 return next;
 }

 function addToCart(id, sizeIndex, qty) {
 var p = findProduct(id);
 if (!p) return;
 if (isUnavailable(p)) return;
 if (!Array.isArray(p.sizes) || !p.sizes.length) return;
 var si = typeof sizeIndex === "number" ? sizeIndex : 0;
 var size = p.sizes[si] || p.sizes[0];
 if (!size) return;
 var q = Math.max(1, Math.min(99, Number(qty) || 1));
 var key = p.id + "::" + size.label;
 var cart = syncCartPrices(loadCart());
 var existing = cart.find(function (i) {
 return i.key === key;
 });
 if (existing) {
 existing.qty = Math.min(99, (Number(existing.qty) || 0) + q);
 existing.price = size.price;
 existing.name = p.name;
 existing.image = p.image;
 } else {
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

 function customerAuthHeaders() {
 var h = { "Content-Type": "application/json" };
 try {
 var token = localStorage.getItem("nb-customer-token") || "";
 if (token) h.Authorization = "Bearer " + token;
 } catch (e) {}
 return h;
 }

 async function ensureCustomerSession() {
 try {
 var res = await fetch("/api/customer/me", {
 credentials: "include",
 headers: customerAuthHeaders(),
 });
 if (!res.ok) return null;
 var data = await res.json();
 global.__NASTRO_CUSTOMER = data.customer || null;
 return data.customer || null;
 } catch (e) {
 global.__NASTRO_CUSTOMER = null;
 return null;
 }
 }

 async function placeOrderAndCheckout(opts) {
 opts = opts || {};
 var cart = loadCart();
 if (!cart.length) {
 if (opts.onEmpty) opts.onEmpty();
 return null;
 }
 var customer = await ensureCustomerSession();
 if (!customer) {
 window.location.href = "account.html?next=checkout";
 return null;
 }
 var res = await fetch("/api/orders", {
 method: "POST",
 credentials: "include",
 headers: customerAuthHeaders(),
 body: JSON.stringify({
 items: cart.map(function (i) {
 return { productId: i.id, size: i.size, qty: i.qty };
 }),
 shippingAddress: customer.address || {},
 notes: "",
 }),
 });
 var data = {};
 try {
 data = await res.json();
 } catch (e) {}
 if (res.status === 401) {
 window.location.href = "account.html?next=checkout";
 return null;
 }
 if (!res.ok) throw new Error(data.error || "Could not place order");
 saveCart([]);
 updateCartBadges();
 if (data.whatsappUrl) {
 window.open(data.whatsappUrl, "_blank", "noopener");
 }
 return data;
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
 syncCartPrices: syncCartPrices,
 inr: inr,
 cartCount: cartCount,
 cartTotal: cartTotal,
 findProduct: findProduct,
 addToCart: addToCart,
 placeOrderAndCheckout: placeOrderAndCheckout,
 ensureCustomerSession: ensureCustomerSession,
 updateCartBadges: updateCartBadges,
 loadCatalogFromApi: loadCatalogFromApi,
 WA: WA,
 };
})(window);