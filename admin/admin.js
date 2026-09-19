(function () {
 var API = "/api";
 var token = localStorage.getItem("nb-admin-token") || "";
 var products = [];
 var selectedId = null;
 var orders = [];
 var selectedOrderId = null;
 var customers = [];
 var selectedCustomerId = null;
 var customerDetailCache = null;
 var customerSearchTimer = null;

 function $(id) {
 return document.getElementById(id);
 }

 function escapeHtml(s) {
 return String(s == null ? "" : s)
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#39;");
 }

 async function api(path, options) {
 options = options || {};
 var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
 if (token) headers.Authorization = "Bearer " + token;
 var res = await fetch(API + path, Object.assign({}, options, { headers: headers }));
 var data = await res.json().catch(function () {
 return {};
 });
 if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
 return data;
 }

 function showApp(show) {
 // Use class toggle (reliable) + hidden attribute
 $("loginView").classList.toggle("is-hidden", !!show);
 $("appView").classList.toggle("is-hidden", !show);
 $("loginView").hidden = !!show;
 $("appView").hidden = !show;
 }

 function statusLabel(status) {
 if (status === "unavailable") return "Temp unavailable";
 if (status === "archived") return "Archived";
 return "Available";
 }

 function fillForm(p) {
 selectedId = p ? p.id : null;
 $("formTitle").textContent = p ? "Edit product" : "Add product";
 $("docId").value = p && p._id ? p._id : "";
 $("name").value = (p && p.name) || "";
 $("brand").value = (p && p.brand) || "Nastro Blu";
 $("category").value = (p && p.category) || "produce";
 $("tag").value = (p && p.tag) || "";
 var tags = (p && p.tags) || [];
 $("tags").value = tags
 .filter(function (t) {
 return t && t !== (p && p.tag);
 })
 .join(", ");
 $("sortOrder").value = p && p.sortOrder != null ? p.sortOrder : 100;
 $("price").value = p ? p.price : "";
 $("mrp").value = p ? p.mrp : "";
 $("cost").value = p && p.cost != null ? p.cost : 0;
 $("status").value = (p && p.status) || (p && p.active === false ? "unavailable" : "available");
 $("netQuantity").value = (p && p.netQuantity) || "";
 $("unit").value = (p && p.unit) || "";
 $("sku").value = (p && p.sku) || "";
 $("barcode").value = (p && p.barcode) || "";
 $("packedOn").value = (p && p.packedOn) || "";
 $("bestBefore").value = (p && p.bestBefore) || "";
 $("image").value = (p && p.image) || "assets/products/grains.jpg";
 if ($("imageFile")) $("imageFile").value = "";
 updateImagePreview($("image").value);
 $("slug").value = (p && p.id) || "";
 $("blurb").value = (p && p.blurb) || "";
 $("description").value = (p && p.description) || "";
 $("ingredients").value = (p && p.ingredients) || "";
 $("specifications").value = ((p && p.specifications) || []).join("\n");
 $("packagingText").value = ((p && p.packagingText) || []).join("\n");
 $("storage").value = (p && p.storage) || "";
 $("origin").value = (p && p.origin) || "";
 $("formMsg").classList.add("is-hidden");
 $("formMsg").hidden = true;
 $("formMsg").style.color = "";
 renderList();
 }

 function renderList() {
 var q = ($("search").value || "").toLowerCase();
 var statusFilter = $("statusFilter").value;
 var list = products
 .filter(function (p) {
 var st = p.status || (p.active === false ? "unavailable" : "available");
 if (statusFilter !== "all" && st !== statusFilter) return false;
 if (!q) return true;
 var hay = [p.name, p.sku, p.id, p.tag]
 .concat(p.tags || [])
 .join(" ")
 .toLowerCase();
 return hay.indexOf(q) >= 0;
 })
 .slice()
 .sort(function (a, b) {
 var ao = a.sortOrder != null ? a.sortOrder : 100;
 var bo = b.sortOrder != null ? b.sortOrder : 100;
 if (ao !== bo) return ao - bo;
 return (a.name || "").localeCompare(b.name || "");
 });

 $("productList").innerHTML = list
 .map(function (p) {
 var st = p.status || (p.active === false ? "unavailable" : "available");
 var margin =
 p.cost > 0 && p.price != null ? " · margin ₹" + Math.round(Number(p.price) - Number(p.cost)) : "";
 return (
 '<button type="button" data-id="' +
 escapeHtml(p.id) +
 '" class="' +
 (selectedId === p.id ? "active" : "") +
 " status-" +
 st +
 '">' +
 '<span class="name">' +
 escapeHtml(p.name) +
 ' <em class="badge">' +
 statusLabel(st) +
 "</em></span>" +
 '<span class="meta">#' +
 (p.sortOrder != null ? p.sortOrder : 100) +
 " · MRP ₹" +
 p.mrp +
 " · Sell ₹" +
 p.price +
 (p.cost ? " · Cost ₹" + p.cost : "") +
 margin +
 " · " +
 escapeHtml(p.sku || p.id) +
 (p.tag ? " · " + p.tag : "") +
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
 else if (products[0]) fillForm(products[0]);
 }
 fillSpecialProductSelect();
 }

 function formPayload() {
 var tagsRaw = ($("tags").value || "")
 .split(",")
 .map(function (t) {
 return t.trim();
 })
 .filter(Boolean);
 var primary = $("tag").value.trim();
 return {
 name: $("name").value.trim(),
 brand: $("brand").value.trim(),
 category: $("category").value,
 tag: primary || null,
 tags: tagsRaw,
 sortOrder: Number($("sortOrder").value || 100),
 price: Number($("price").value),
 mrp: Number($("mrp").value),
 cost: Number($("cost").value || 0),
 status: $("status").value,
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
 };
 }

 function showMsg(text, isError) {
 $("formMsg").textContent = text;
 $("formMsg").classList.remove("is-hidden");
 $("formMsg").hidden = false;
 $("formMsg").style.color = isError ? "#9b1c1c" : "";
 }

 function showUploadMsg(text, isError) {
 var el = $("uploadMsg");
 if (!el) return;
 el.textContent = text;
 el.classList.toggle("is-hidden", !text);
 el.hidden = !text;
 el.style.color = isError ? "#9b1c1c" : "";
 }

 function updateImagePreview(path) {
 var img = $("imagePreview");
 if (!img) return;
 var src = (path || "").trim();
 if (!src) {
 img.classList.add("is-hidden");
 img.removeAttribute("src");
 return;
 }
 if (src.indexOf("http") !== 0 && src.charAt(0) !== "/") src = "/" + src;
 img.src = src;
 img.classList.remove("is-hidden");
 img.hidden = false;
 }

 async function uploadImageFile(file) {
 if (!file) throw new Error("Choose an image file first");
 if (!token) throw new Error("Please sign in first");
 var body = new FormData();
 body.append("image", file);
 var res = await fetch(API + "/uploads/image", {
 method: "POST",
 headers: { Authorization: "Bearer " + token },
 body: body,
 });
 var data = await res.json().catch(function () {
 return {};
 });
 if (!res.ok) throw new Error(data.error || "Upload failed (" + res.status + ")");
 return data;
 }

 $("loginForm").addEventListener("submit", async function (e) {
 e.preventDefault();
 $("loginError").classList.add("is-hidden");
 $("loginError").hidden = true;
 var btn = $("btnLogin") || $("loginForm").querySelector('button[type="submit"]');
 var prev = btn.textContent;
 btn.disabled = true;
 btn.textContent = "Signing in…";
 try {
 var data = await api("/auth/login", {
 method: "POST",
 body: JSON.stringify({
 email: $("email").value.trim(),
 password: $("password").value,
 }),
 });
 if (!data.token) throw new Error("Login succeeded but no token returned");
 token = data.token;
 localStorage.setItem("nb-admin-token", token);
 $("adminEmail").textContent = (data.admin && data.admin.email) || "";
 showApp(true);
 await loadProducts();
 fillSpecialProductSelect();
 if (!products.length) {
 $("productList").innerHTML = '<p class="meta">Signed in. No products yet - click + Add product.</p>';
 }
 } catch (err) {
 $("loginError").textContent = err.message || "Login failed";
 $("loginError").classList.remove("is-hidden");
 $("loginError").hidden = false;
 showApp(false);
 } finally {
 btn.disabled = false;
 btn.textContent = prev;
 }
 });

 $("btnLogout").addEventListener("click", function () {
 token = "";
 localStorage.removeItem("nb-admin-token");
 showApp(false);
 });

 if ($("image")) {
 $("image").addEventListener("input", function () {
 updateImagePreview($("image").value);
 });
 }

 if ($("imageFile")) {
 $("imageFile").addEventListener("change", function () {
 var file = $("imageFile").files && $("imageFile").files[0];
 if (!file) return;
 var url = URL.createObjectURL(file);
 var img = $("imagePreview");
 img.src = url;
 img.classList.remove("is-hidden");
 img.hidden = false;
 showUploadMsg("Selected: " + file.name + " - click Upload image", false);
 });
 }

 if ($("btnUploadImage")) {
 $("btnUploadImage").addEventListener("click", async function () {
 var file = $("imageFile").files && $("imageFile").files[0];
 var btn = $("btnUploadImage");
 var prev = btn.textContent;
 btn.disabled = true;
 btn.textContent = "Uploading…";
 showUploadMsg("", false);
 try {
 var data = await uploadImageFile(file);
 $("image").value = data.path;
 updateImagePreview(data.path);
 showUploadMsg("Uploaded. Remember to Save product.", false);
 $("imageFile").value = "";
 } catch (err) {
 showUploadMsg(err.message || "Upload failed", true);
 } finally {
 btn.disabled = false;
 btn.textContent = prev;
 }
 });
 }

 $("btnNew").addEventListener("click", function () {
 fillForm(null);
 });

 $("search").addEventListener("input", renderList);
 $("statusFilter").addEventListener("change", renderList);

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
 showMsg("Saved", false);
 await loadProducts();
 } catch (err) {
 showMsg(err.message, true);
 }
 });

 $("btnUnavailable").addEventListener("click", async function () {
 if (!selectedId) return;
 $("status").value = "unavailable";
 try {
 await api("/products/" + encodeURIComponent(selectedId), {
 method: "PUT",
 body: JSON.stringify(Object.assign(formPayload(), { status: "unavailable" })),
 });
 showMsg("Marked temporarily unavailable", false);
 await loadProducts();
 } catch (err) {
 showMsg(err.message, true);
 }
 });

 $("btnArchive").addEventListener("click", async function () {
 if (!selectedId) return;
 if (!confirm("Archive this product? It will be hidden from the storefront.")) return;
 try {
 await api("/products/" + encodeURIComponent(selectedId), { method: "DELETE" });
 selectedId = null;
 showMsg("Archived", false);
 await loadProducts();
 } catch (err) {
 showMsg(err.message, true);
 }
 });

 $("btnDelete").addEventListener("click", async function () {
 if (!selectedId) return;
 if (!confirm("Delete this product forever? This cannot be undone.")) return;
 try {
 await api("/products/" + encodeURIComponent(selectedId) + "?hard=1", { method: "DELETE" });
 selectedId = null;
 showMsg("Deleted permanently", false);
 await loadProducts();
 } catch (err) {
 showMsg(err.message, true);
 }
 });

 function switchTab(tab) {
 document.querySelectorAll(".admin-tab").forEach(function (btn) {
 btn.classList.toggle("active", btn.dataset.tab === tab);
 });
 document.querySelectorAll("[data-panel]").forEach(function (panel) {
 var on = panel.dataset.panel === tab;
 panel.classList.toggle("is-hidden", !on);
 panel.hidden = !on;
 });
 if ($("btnNew")) $("btnNew").classList.toggle("is-hidden", tab !== "products");
 if (tab === "orders") loadOrders();
 if (tab === "customers") loadCustomers();
 if (tab === "special") {
 fillSpecialProductSelect();
 loadSpecial();
 }
 }

 async function loadCustomers() {
 if (!$("customersBody")) return;
 try {
 var parts = [];
 var q = $("customerSearch") && $("customerSearch").value.trim();
 var active = $("customerActiveFilter") && $("customerActiveFilter").value;
 if (q) parts.push("q=" + encodeURIComponent(q));
 if (active !== "" && active != null) parts.push("active=" + encodeURIComponent(active));
 var path = "/customer/admin/all" + (parts.length ? "?" + parts.join("&") : "");
 var data = await api(path);
 customers = data.customers || [];
 var meta = data.meta || {};
 if ($("customersMeta")) {
 $("customersMeta").textContent =
 (meta.total || customers.length) +
 " customers · " +
 (meta.active || 0) +
 " active · " +
 (meta.withOrders || 0) +
 " with orders. Click a row for full profile.";
 }
 renderCustomers();
 if (selectedCustomerId) {
 await loadCustomerDetail(selectedCustomerId);
 }
 } catch (err) {
 $("customersBody").innerHTML =
 '<tr><td colspan="7" class="meta">' + (err.message || "Could not load customers") + "</td></tr>";
 }
 }

 function renderCustomers() {
 var body = $("customersBody");
 var empty = $("customersEmpty");
 if (!body) return;
 if (!customers.length) {
 body.innerHTML = "";
 if (empty) {
 empty.classList.remove("is-hidden");
 empty.hidden = false;
 }
 renderCustomerDetail(null);
 return;
 }
 if (empty) {
 empty.classList.add("is-hidden");
 empty.hidden = true;
 }
 body.innerHTML = customers
 .map(function (c) {
 var active = selectedCustomerId === c.id ? " active" : "";
 return (
 '<tr class="order-row' +
 active +
 '" data-customer-id="' +
 escapeHtml(c.id) +
 '">' +
 "<td><strong>" +
 escapeHtml(c.name || "—") +
 '</strong><br/><span class="meta">' +
 escapeHtml(c.email || "") +
 "</span></td>" +
 "<td>" +
 escapeHtml(c.phone || "—") +
 "</td>" +
 "<td><strong>" +
 Number(c.orderCount || 0) +
 "</strong></td>" +
 "<td>₹" +
 Number(c.orderTotal || 0).toLocaleString("en-IN") +
 "</td>" +
 "<td>" +
 Number(c.wishlistCount || 0) +
 "</td>" +
 '<td><span class="status-pill ' +
 (c.isActive ? "active-ok" : "active-off") +
 '">' +
 (c.isActive ? "Active" : "Off") +
 "</span></td>" +
 "<td>" +
 formatDate(c.createdAt) +
 "</td>" +
 "</tr>"
 );
 })
 .join("");
 }

 async function loadCustomerDetail(id) {
 if (!id) {
 renderCustomerDetail(null);
 return;
 }
 try {
 var data = await api("/customer/admin/" + encodeURIComponent(id));
 customerDetailCache = data;
 renderCustomerDetail(data);
 } catch (err) {
 customerDetailCache = null;
 var box = $("customerDetail");
 var empty = $("customerDetailEmpty");
 if (empty) {
 empty.classList.add("is-hidden");
 empty.hidden = true;
 }
 if (box) {
 box.classList.remove("is-hidden");
 box.hidden = false;
 box.innerHTML = '<p class="meta">' + escapeHtml(err.message || "Could not load") + "</p>";
 }
 }
 }

 function renderCustomerDetail(data) {
 var box = $("customerDetail");
 var empty = $("customerDetailEmpty");
 if (!box) return;
 if (!data || !data.customer) {
 box.innerHTML = "";
 box.classList.add("is-hidden");
 box.hidden = true;
 if (empty) {
 empty.classList.remove("is-hidden");
 empty.hidden = false;
 }
 return;
 }
 if (empty) {
 empty.classList.add("is-hidden");
 empty.hidden = true;
 }
 box.classList.remove("is-hidden");
 box.hidden = false;
 var c = data.customer;
 var ordersHtml = (data.orders || [])
 .slice(0, 8)
 .map(function (o) {
 return (
 '<div class="order-item" style="grid-template-columns:1fr auto">' +
 "<div><strong>" +
 escapeHtml(o.orderNumber || o.id) +
 '</strong><br/><span class="meta">' +
 formatDate(o.createdAt) +
 " · " +
 escapeHtml(o.status || "") +
 "</span></div>" +
 "<div><strong>₹" +
 Number(o.total || 0).toLocaleString("en-IN") +
 "</strong></div></div>"
 );
 })
 .join("");
 var wishHtml = (data.wishlist || [])
 .map(function (w) {
 return (
 '<div class="order-item">' +
 '<img src="/' +
 escapeHtml(String(w.image || "").replace(/^\//, "")) +
 '" alt="" onerror="this.style.visibility=\'hidden\'" />' +
 "<div><strong>" +
 escapeHtml(w.name || w.productSlug) +
 '</strong><br/><span class="meta">' +
 escapeHtml(w.productSlug) +
 (w.price != null ? " · ₹" + Number(w.price).toLocaleString("en-IN") : "") +
 "</span></div>" +
 '<span class="meta">' +
 escapeHtml(w.status || "") +
 "</span></div>"
 );
 })
 .join("");
 box.innerHTML =
 '<div class="customer-stat-row">' +
 '<div class="customer-stat"><b>' +
 Number(c.orderCount || 0) +
 "</b>Orders</div>" +
 '<div class="customer-stat"><b>₹' +
 Number(c.orderTotal || 0).toLocaleString("en-IN") +
 "</b>Total spent</div>" +
 '<div class="customer-stat"><b>' +
 Number(c.wishlistCount || 0) +
 "</b>Wishlist</div>" +
 "</div>" +
 "<h3>" +
 escapeHtml(c.name) +
 "</h3>" +
 '<div class="kv">' +
 "<div><span>Email</span><strong>" +
 escapeHtml(c.email) +
 "</strong></div>" +
 "<div><span>Phone</span><strong>" +
 escapeHtml(c.phone || "—") +
 "</strong></div>" +
 "<div><span>Status</span><strong>" +
 (c.isActive ? "Active" : "Deactivated") +
 "</strong></div>" +
 "<div><span>Joined</span><strong>" +
 formatDate(c.createdAt) +
 "</strong></div>" +
 "<div><span>Last login</span><strong>" +
 formatDate(c.lastLoginAt) +
 "</strong></div>" +
 "<div><span>Address</span><strong style=\"text-align:right;max-width:60%\">" +
 escapeHtml(formatAddr(c.address)) +
 "</strong></div>" +
 "</div>" +
 '<div class="order-actions">' +
 '<button type="button" class="primary" id="btnToggleCustomerActive" data-active="' +
 (c.isActive ? "1" : "0") +
 '">' +
 (c.isActive ? "Deactivate account" : "Reactivate account") +
 "</button>" +
 "</div>" +
 "<h3>Recent orders</h3>" +
 (ordersHtml || '<p class="meta">No orders yet.</p>') +
 "<h3>Wishlist</h3>" +
 '<div class="customer-wish-list">' +
 (wishHtml || '<p class="meta">Wishlist is empty.</p>') +
 "</div>";
 }

 function formatAddr(a) {
 if (!a) return "—";
 var parts = [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean);
 return parts.length ? parts.join(", ") : "—";
 }

 function formatDate(d) {
 if (!d) return "—";
 try {
 return new Date(d).toLocaleString("en-IN", {
 day: "2-digit",
 month: "short",
 year: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 });
 } catch (e) {
 return String(d);
 }
 }

 async function loadOrders() {
 if (!$("ordersBody")) return;
 try {
 var q = $("orderStatusFilter") && $("orderStatusFilter").value;
 var path = "/orders/admin/all" + (q ? "?status=" + encodeURIComponent(q) : "");
 var data = await api(path);
 orders = data.orders || [];
 renderOrders();
 if (selectedOrderId) {
 var still = orders.find(function (o) {
 return o.id === selectedOrderId || o.orderNumber === selectedOrderId;
 });
 if (still) renderOrderDetail(still);
 else {
 selectedOrderId = null;
 renderOrderDetail(null);
 }
 }
 } catch (err) {
 $("ordersBody").innerHTML =
 '<tr><td colspan="7" class="meta">' + (err.message || "Could not load orders") + "</td></tr>";
 }
 }

 function renderOrders() {
 var body = $("ordersBody");
 var empty = $("ordersEmpty");
 if (!body) return;
 if (!orders.length) {
 body.innerHTML = "";
 if (empty) {
 empty.classList.remove("is-hidden");
 empty.hidden = false;
 }
 return;
 }
 if (empty) {
 empty.classList.add("is-hidden");
 empty.hidden = true;
 }
 body.innerHTML = orders
 .map(function (o) {
 var c = o.customerDetails || o.customer || {};
 var active = selectedOrderId === o.id || selectedOrderId === o.orderNumber ? " active" : "";
 return (
 '<tr class="order-row' +
 active +
 '" data-order-id="' +
 escapeHtml(o.id) +
 '">' +
 '<td><span class="ord-num">' +
 escapeHtml(o.orderNumber || o.id) +
 '</span><br/><span class="meta">' +
 (o.items || []).length +
 " item(s)</span></td>" +
 "<td><strong>" +
 escapeHtml(c.name || "—") +
 '</strong><br/><span class="meta">' +
 escapeHtml(c.email || "") +
 "</span></td>" +
 "<td>" +
 escapeHtml(c.phone || "—") +
 "</td>" +
 "<td><strong>₹" +
 Number(o.total || 0).toLocaleString("en-IN") +
 "</strong></td>" +
 '<td><span class="status-pill ' +
 escapeHtml(o.status || "") +
 '">' +
 escapeHtml(o.status || "pending") +
 "</span></td>" +
 "<td>" +
 escapeHtml(o.paymentStatus || "unpaid") +
 "</td>" +
 "<td>" +
 escapeHtml(formatDate(o.createdAt)) +
 "</td>" +
 "</tr>"
 );
 })
 .join("");
 }

 function renderOrderDetail(o) {
 var empty = $("orderDetailEmpty");
 var box = $("orderDetail");
 if (!box) return;
 if (!o) {
 if (empty) {
 empty.classList.remove("is-hidden");
 empty.hidden = false;
 }
 box.classList.add("is-hidden");
 box.hidden = true;
 box.innerHTML = "";
 return;
 }
 if (empty) {
 empty.classList.add("is-hidden");
 empty.hidden = true;
 }
 box.classList.remove("is-hidden");
 box.hidden = false;
 var c = o.customerDetails || {};
 var ship = o.shippingAddress || (c.address || {});
 var itemsHtml = (o.items || [])
 .map(function (it) {
 var img = it.image ? "/" + String(it.image).replace(/^\//, "") : "/assets/logo.png";
 return (
 '<div class="order-item">' +
 '<img src="' +
 escapeHtml(img) +
 '" alt="" />' +
 "<div><strong>" +
 escapeHtml(it.name || it.productId) +
 '</strong><br/><span class="meta">' +
 escapeHtml(it.size || "") +
 " × " +
 it.qty +
 "</span></div>" +
 "<div>₹" +
 Number(it.lineTotal != null ? it.lineTotal : it.unitPrice * it.qty).toLocaleString("en-IN") +
 "</div></div>"
 );
 })
 .join("");

 box.innerHTML =
 "<h3>" +
 escapeHtml(o.orderNumber || o.id) +
 "</h3>" +
 '<div class="kv">' +
 "<div><span>Placed</span><b>" +
 escapeHtml(formatDate(o.createdAt)) +
 "</b></div>" +
 "<div><span>Channel</span><b>" +
 escapeHtml(o.channel || "—") +
 "</b></div>" +
 "<div><span>Total</span><b>₹" +
 Number(o.total || 0).toLocaleString("en-IN") +
 "</b></div>" +
 "</div>" +
 "<h3>Customer</h3>" +
 '<div class="kv">' +
 "<div><span>Name</span><b>" +
 escapeHtml(c.name || "—") +
 "</b></div>" +
 "<div><span>Email</span><b>" +
 escapeHtml(c.email || "—") +
 "</b></div>" +
 "<div><span>Phone</span><b>" +
 escapeHtml(c.phone || "—") +
 "</b></div>" +
 "<div><span>Ship to</span><b>" +
 escapeHtml(formatAddr(ship)) +
 "</b></div>" +
 (c.lastLoginAt
 ? "<div><span>Last login</span><b>" + escapeHtml(formatDate(c.lastLoginAt)) + "</b></div>"
 : "") +
 "</div>" +
 "<h3>Items</h3>" +
 '<div class="order-items">' +
 (itemsHtml || '<p class="meta">No items</p>') +
 "</div>" +
 (o.notes ? "<h3>Notes</h3><p>" + escapeHtml(o.notes) + "</p>" : "") +
 "<h3>Update status</h3>" +
 '<div class="order-actions">' +
 '<select id="orderStatusSelect">' +
 ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"]
 .map(function (s) {
 return (
 '<option value="' +
 s +
 '"' +
 (o.status === s ? " selected" : "") +
 ">" +
 s +
 "</option>"
 );
 })
 .join("") +
 "</select>" +
 '<select id="orderPaySelect">' +
 ["unpaid", "paid", "refunded"]
 .map(function (s) {
 return (
 '<option value="' +
 s +
 '"' +
 (o.paymentStatus === s ? " selected" : "") +
 ">" +
 s +
 "</option>"
 );
 })
 .join("") +
 "</select>" +
 '<button type="button" class="primary" id="btnSaveOrderStatus">Save</button>' +
 "</div>" +
 '<p id="orderUpdateMsg" class="msg is-hidden"></p>';

 var saveBtn = $("btnSaveOrderStatus");
 if (saveBtn) {
 saveBtn.addEventListener("click", async function () {
 var msg = $("orderUpdateMsg");
 try {
 await api("/orders/admin/" + encodeURIComponent(o.orderNumber || o.id), {
 method: "PATCH",
 body: JSON.stringify({
 status: $("orderStatusSelect").value,
 paymentStatus: $("orderPaySelect").value,
 }),
 });
 if (msg) {
 msg.textContent = "Updated";
 msg.classList.remove("is-hidden");
 msg.hidden = false;
 }
 await loadOrders();
 } catch (err) {
 if (msg) {
 msg.textContent = err.message || "Update failed";
 msg.style.color = "#9b1c1c";
 msg.classList.remove("is-hidden");
 msg.hidden = false;
 }
 }
 });
 }
 }

 function fillSpecialProductSelect() {
 var sel = $("specialProductId");
 if (!sel) return;
 var current = sel.value;
 var opts =
 '<option value="">Select a product…</option>' +
 products
 .filter(function (p) {
 var st = p.status || (p.active === false ? "unavailable" : "available");
 return st !== "archived";
 })
 .slice()
 .sort(function (a, b) {
 return (a.name || "").localeCompare(b.name || "");
 })
 .map(function (p) {
 return (
 '<option value="' +
 p.id +
 '">' +
 p.name +
 " — ₹" +
 p.price +
 " (" +
 p.id +
 ")</option>"
 );
 })
 .join("");
 sel.innerHTML = opts;
 if (current) sel.value = current;
 }

 function updateSpecialPreview() {
 var badge = ($("specialBadge") && $("specialBadge").value) || "Today's Special";
 var title = ($("specialTitle") && $("specialTitle").value) || "Your title";
 var desc = ($("specialDescription") && $("specialDescription").value) || "Description appears here.";
 var img = ($("specialImage") && $("specialImage").value) || "";
 var badgeEl = document.querySelector(".special-preview-badge");
 if (badgeEl) badgeEl.textContent = badge;
 if ($("specialPreviewTitle")) $("specialPreviewTitle").textContent = title;
 if ($("specialPreviewDesc")) $("specialPreviewDesc").textContent = desc;
 var prev = $("specialPreviewImg");
 var formPrev = $("specialImagePreview");
 if (prev) {
 if (img) {
 prev.src = img.charAt(0) === "/" ? img : "/" + img;
 prev.style.display = "block";
 } else {
 prev.removeAttribute("src");
 prev.style.display = "none";
 }
 }
 if (formPrev) {
 if (img) {
 formPrev.src = img.charAt(0) === "/" ? img : "/" + img;
 formPrev.classList.remove("is-hidden");
 formPrev.hidden = false;
 } else {
 formPrev.classList.add("is-hidden");
 formPrev.hidden = true;
 }
 }
 }

 async function loadSpecial() {
 if (!$("specialForm")) return;
 try {
 var data = await api("/special/admin/today");
 var s = data.special || {};
 $("specialEnabled").checked = !!s.enabled;
 $("specialOncePerDay").checked = s.showOncePerDay !== false;
 $("specialBadge").value = s.badge || "Today's Special";
 $("specialCta").value = s.ctaLabel || "Add to cart";
 $("specialTitle").value = s.title || "";
 $("specialDescription").value = s.description || "";
 $("specialImage").value = s.image || "";
 fillSpecialProductSelect();
 $("specialProductId").value = s.productId || "";
 updateSpecialPreview();
 $("specialMsg").classList.add("is-hidden");
 } catch (err) {
 $("specialMsg").textContent = err.message || "Could not load special";
 $("specialMsg").style.color = "#9b1c1c";
 $("specialMsg").classList.remove("is-hidden");
 }
 }

 document.querySelectorAll(".admin-tab").forEach(function (btn) {
 btn.addEventListener("click", function () {
 switchTab(btn.dataset.tab);
 });
 });

 if ($("btnRefreshOrders")) {
 $("btnRefreshOrders").addEventListener("click", loadOrders);
 }
 if ($("orderStatusFilter")) {
 $("orderStatusFilter").addEventListener("change", loadOrders);
 }
 if ($("ordersBody")) {
 $("ordersBody").addEventListener("click", function (e) {
 var row = e.target.closest("[data-order-id]");
 if (!row) return;
 selectedOrderId = row.dataset.orderId;
 var o = orders.find(function (x) {
 return x.id === selectedOrderId;
 });
 renderOrders();
 renderOrderDetail(o || null);
 });
 }

 if ($("btnRefreshCustomers")) {
 $("btnRefreshCustomers").addEventListener("click", loadCustomers);
 }
 if ($("customerActiveFilter")) {
 $("customerActiveFilter").addEventListener("change", loadCustomers);
 }
 if ($("customerSearch")) {
 $("customerSearch").addEventListener("input", function () {
 clearTimeout(customerSearchTimer);
 customerSearchTimer = setTimeout(loadCustomers, 280);
 });
 }
 if ($("customersBody")) {
 $("customersBody").addEventListener("click", function (e) {
 var row = e.target.closest("[data-customer-id]");
 if (!row) return;
 selectedCustomerId = row.dataset.customerId;
 renderCustomers();
 loadCustomerDetail(selectedCustomerId);
 });
 }
 if ($("customerDetail")) {
 $("customerDetail").addEventListener("click", async function (e) {
 var btn = e.target.closest("#btnToggleCustomerActive");
 if (!btn || !selectedCustomerId) return;
 var currentlyActive = btn.getAttribute("data-active") === "1";
 var next = !currentlyActive;
 var label = next ? "reactivate" : "deactivate";
 if (!confirm("Are you sure you want to " + label + " this customer account?")) return;
 try {
 await api("/customer/admin/" + encodeURIComponent(selectedCustomerId), {
 method: "PATCH",
 body: JSON.stringify({ isActive: next }),
 });
 await loadCustomers();
 await loadCustomerDetail(selectedCustomerId);
 } catch (err) {
 alert(err.message || "Could not update customer");
 }
 });
 }

 ["specialBadge", "specialTitle", "specialDescription", "specialImage"].forEach(function (id) {
 if ($(id)) {
 $(id).addEventListener("input", updateSpecialPreview);
 }
 });

 if ($("specialImageFile")) {
 $("specialImageFile").addEventListener("change", function () {
 var file = $("specialImageFile").files && $("specialImageFile").files[0];
 if (!file) return;
 var url = URL.createObjectURL(file);
 var img = $("specialImagePreview");
 img.src = url;
 img.classList.remove("is-hidden");
 img.hidden = false;
 });
 }

 if ($("btnUploadSpecialImage")) {
 $("btnUploadSpecialImage").addEventListener("click", async function () {
 var file = $("specialImageFile").files && $("specialImageFile").files[0];
 var btn = $("btnUploadSpecialImage");
 var prev = btn.textContent;
 var msg = $("specialUploadMsg");
 btn.disabled = true;
 btn.textContent = "Uploading…";
 try {
 var data = await uploadImageFile(file);
 $("specialImage").value = data.path;
 updateSpecialPreview();
 if (msg) {
 msg.textContent = "Photo uploaded. Click Save Today's Special.";
 msg.style.color = "";
 msg.classList.remove("is-hidden");
 msg.hidden = false;
 }
 $("specialImageFile").value = "";
 } catch (err) {
 if (msg) {
 msg.textContent = err.message || "Upload failed";
 msg.style.color = "#9b1c1c";
 msg.classList.remove("is-hidden");
 msg.hidden = false;
 }
 } finally {
 btn.disabled = false;
 btn.textContent = prev;
 }
 });
 }

 if ($("specialForm")) {
 $("specialForm").addEventListener("submit", async function (e) {
 e.preventDefault();
 var msg = $("specialMsg");
 try {
 await api("/special/admin/today", {
 method: "PUT",
 body: JSON.stringify({
 enabled: $("specialEnabled").checked,
 showOncePerDay: $("specialOncePerDay").checked,
 badge: $("specialBadge").value,
 ctaLabel: $("specialCta").value,
 title: $("specialTitle").value,
 description: $("specialDescription").value,
 image: $("specialImage").value,
 productId: $("specialProductId").value,
 }),
 });
 if (msg) {
 msg.textContent = "Today's Special saved";
 msg.style.color = "";
 msg.classList.remove("is-hidden");
 msg.hidden = false;
 }
 } catch (err) {
 if (msg) {
 msg.textContent = err.message || "Save failed";
 msg.style.color = "#9b1c1c";
 msg.classList.remove("is-hidden");
 msg.hidden = false;
 }
 }
 });
 }

 (async function boot() {
 if (!token) return;
 try {
 var me = await api("/auth/me");
 $("adminEmail").textContent = me.admin.email;
 showApp(true);
 await loadProducts();
 fillSpecialProductSelect();
 } catch (err) {
 token = "";
 localStorage.removeItem("nb-admin-token");
 }
 })();
})();
