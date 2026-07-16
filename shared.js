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
