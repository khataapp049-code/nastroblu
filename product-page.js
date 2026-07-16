(function () {
 var state = { sizeIndex: 0, qty: 1, product: null };

 function qs(name) {
 return new URLSearchParams(window.location.search).get(name);
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
 i.image +
 '" alt="" />' +
 "<div><h4>" +
 i.name +
 '</h4><div class="meta">' +
 i.size +
 (i.sku ? " · " + i.sku : "") +
 " × " +
 i.qty +
 '</div><button type="button" class="rm" data-rm="' +
 i.key +
 '">Remove</button></div>' +
 '<div class="line">' +
 Nastro.inr(i.price * i.qty) +
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
 return (
 '<div class="spec-row"><dt>' +
 label +
 "</dt><dd>" +
 (value || " - ") +
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

 root.innerHTML =
 '<nav class="breadcrumb"><a href="index.html">Home</a> / <a href="index.html#shop">Catalog</a> / <span>' +
 p.name +
 "</span></nav>" +
 '<div class="pdp">' +
 '<div class="pdp__media">' +
 (p.tag ? '<span class="pcard__badge">' + p.tag + "</span>" : "") +
 '<img src="' +
 p.image +
 '" alt="' +
 p.name +
 '" />' +
 "</div>" +
 '<div class="pdp__info">' +
 '<p class="pdp__brand">' +
 (p.brand || "Nastro Blu") +
 " · " +
 cat +
 "</p>" +
 "<h1 class=\"display\">" +
 p.name +
 "</h1>" +
 '<p class="pdp__blurb">' +
 p.blurb +
 "</p>" +
 '<p class="pdp__desc">' +
 p.description +
 "</p>" +
 '<div class="pdp__price-block">' +
 '<div><span class="pdp__price">' +
 Nastro.inr(p.price) +
 '</span><span class="pdp__mrp">MRP ' +
 Nastro.inr(p.mrp) +
 "</span></div>" +
 '<div class="pdp__qty-label">Net quantity: <strong>' +
 p.netQuantity +
 "</strong></div>" +
 "</div>" +
 '<div class="sizes" id="pdpSizes"></div>' +
 '<div class="qty"><button type="button" id="qtyMinus">−</button><span id="pdpQty">1</span><button type="button" id="qtyPlus">+</button></div>' +
 '<div class="pdp__actions">' +
 '<button type="button" class="btn btn--wine" id="pdpAdd">Add to cart</button>' +
 '<a class="btn btn--ghost" style="border-color:var(--wine);color:var(--wine)" id="pdpWa" target="_blank" rel="noopener">Order on WhatsApp</a>' +
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
 row("SKU", '<code>' + p.sku + "</code>") +
 row("Barcode (EAN)", '<code>' + p.barcode + "</code>") +
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
 return "<li>" + s + "</li>";
 })
 .join("") +
 "</ul>"
 : "") +
 (p.packagingText && p.packagingText.length
 ? "<h3>Other text shown on packaging</h3><ul class=\"pack-list pack-list--claims\">" +
 p.packagingText
 .map(function (s) {
 return "<li>“" + s + "”</li>";
 })
 .join("") +
 "</ul>"
 : "") +
 "</section>";

 renderSizes();
 bindPdp();
 }

 function renderSizes() {
 var p = state.product;
 var box = document.getElementById("pdpSizes");
 if (!box) return;
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
 Nastro.inr(s.price) +
 (s.sku ? '<span class="size-sku">' + s.sku + "</span>" : "") +
 "</button>"
 );
 })
 .join("");
 }

 function bindPdp() {
 var p = state.product;
 document.getElementById("pdpSizes").addEventListener("click", function (e) {
 var btn = e.target.closest("[data-size]");
 if (!btn) return;
 state.sizeIndex = Number(btn.dataset.size);
 renderSizes();
 var size = p.sizes[state.sizeIndex];
 document.querySelector(".pdp__price").textContent = Nastro.inr(size.price);
 document.querySelector(".pdp__qty-label strong").textContent = size.label;
 });
 document.getElementById("qtyMinus").addEventListener("click", function () {
 state.qty = Math.max(1, state.qty - 1);
 document.getElementById("pdpQty").textContent = String(state.qty);
 });
 document.getElementById("qtyPlus").addEventListener("click", function () {
 state.qty += 1;
 document.getElementById("pdpQty").textContent = String(state.qty);
 });
 document.getElementById("pdpAdd").addEventListener("click", function () {
 Nastro.addToCart(p.id, state.sizeIndex, state.qty);
 toast(p.name + " added");
 renderCart();
 openCart();
 });
 document.getElementById("pdpWa").addEventListener("click", function (e) {
 var size = p.sizes[state.sizeIndex];
 var msg =
 "Hi Nastro Blu! I'd like to order:\n• " +
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
 e.currentTarget.href =
 "https://wa.me/" + Nastro.WA + "?text=" + encodeURIComponent(msg);
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
 return i.key !== btn.dataset.rm;
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
