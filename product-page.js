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

 function row(label, value) {
 var raw = value == null || value === "" ? " - " : value;
 // Allow intentional HTML only for our own <code> wrappers
 var safe =
 typeof raw === "string" && raw.indexOf("<code>") === 0
 ? raw
 : escapeHtml(raw);
 return (
 '<div class="spec-row"><dt>' +
 escapeHtml(label) +
 "</dt><dd>" +
 safe +
 "</dd></div>"
 );
 }

 function render() {
 var id = qs("id");
 var p = Nastro.findProduct(id);
 var root = document.getElementById("productPage");
 if (!p) {
 root.innerHTML =
 '<div class="product-missing"><h1 class="display">Product not found</h1><p class="lede">This SKU is not in the catalog.</p><a class="btn btn--wine" href="index.html#shop">Back to shop</a></div>';
 return;
 }
 state.product = p;
 state.sizeIndex = 0;
 state.qty = 1;
 document.title = p.name + " - Nastro Blu";

 var cat =
 (window.NASTRO_CATALOG.categories.find(function (c) {
 return c.id === p.category;
 }) || {}).name || p.category;

 var unavailable =
 (p.status || (p.active === false ? "unavailable" : "available")) === "unavailable";

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
 '" onerror="this.onerror=null;this.src=\'assets/products/grains.jpg\'" />' +
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
 '<p class="pdp__desc">' +
 escapeHtml(p.description || "") +
 "</p>" +
 '<div class="pdp__price-block">' +
 '<div><span class="pdp__price">' +
 Nastro.inr(p.price) +
 '</span><span class="pdp__mrp">MRP ' +
 Nastro.inr(p.mrp) +
 "</span></div>" +
 '<div class="pdp__qty-label">Net quantity: <strong>' +
 escapeHtml(p.netQuantity || "") +
 "</strong></div>" +
 "</div>" +
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
 (window.NastroWishlist
 ? window.NastroWishlist.buttonHtml(p.id, true)
 : "") +
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
 row("MRP", Nastro.inr(p.mrp)) +
 row("Selling price (catalog)", Nastro.inr(p.price)) +
 row("Quantity / net weight", p.netQuantity) +
 row("SKU", "<code>" + escapeHtml(p.sku || "") + "</code>") +
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
 bindPdp();
 loadReviews();
 if (window.NastroWishlist) {
 window.NastroWishlist.paint(document.getElementById("productPage"));
 window.NastroWishlist.refresh();
 }
 }

 async function loadReviews() {
 var list = document.getElementById("reviewList");
 var compose = document.getElementById("reviewCompose");
 var summary = document.getElementById("reviewSummary");
 if (!list || !state.product) return;
 try {
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

 renderReviewForm(compose, data.mine || null);
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

 function renderReviewForm(compose, mine) {
 if (!compose) return;
 var loggedIn = Boolean(window.__NASTRO_CUSTOMER) || Boolean(localStorage.getItem("nb-customer-token"));
 // Probe session if needed
 fetch("/api/customer/me", { credentials: "include", headers: customerHeaders() })
 .then(function (res) {
 return res.ok ? res.json() : null;
 })
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

 function renderSizes() {
 var p = state.product;
 var box = document.getElementById("pdpSizes");
 if (!box) return;
 if (!Array.isArray(p.sizes) || !p.sizes.length) {
 box.innerHTML = '<p class="lede">No size options available.</p>';
 return;
 }
 box.innerHTML = p.sizes
 .map(function (s, i) {
 return (
 '<button type="button" class="size-chip' +
 (i === state.sizeIndex ? " active" : "") +
 '" data-size="' +
 i +
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
 var size = p.sizes[state.sizeIndex];
 if (!size) return;
 document.querySelector(".pdp__price").textContent = Nastro.inr(size.price);
 document.querySelector(".pdp__qty-label strong").textContent = size.label;
 });
 document.getElementById("qtyMinus").addEventListener("click", function () {
 state.qty = Math.max(1, state.qty - 1);
 document.getElementById("pdpQty").textContent = String(state.qty);
 });
 document.getElementById("qtyPlus").addEventListener("click", function () {
 state.qty = Math.min(99, state.qty + 1);
 document.getElementById("pdpQty").textContent = String(state.qty);
 });
 document.getElementById("pdpAdd").addEventListener("click", function () {
 var st = p.status || (p.active === false ? "unavailable" : "available");
 if (st === "unavailable") {
 toast("This item is currently unavailable");
 return;
 }
 if (!Array.isArray(p.sizes) || !p.sizes.length) {
 toast("This product has no size/price options");
 return;
 }
 Nastro.addToCart(p.id, state.sizeIndex, state.qty);
 toast(p.name + " added");
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
 var unavailable =
 (p.status || (p.active === false ? "unavailable" : "available")) === "unavailable";
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
 Nastro.inr(p.mrp) +
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

 document.addEventListener("DOMContentLoaded", async function () {
 if (window.Nastro && Nastro.loadCatalogFromApi) {
 await Nastro.loadCatalogFromApi();
 }
 render();
 Nastro.updateCartBadges();
 renderCart();

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