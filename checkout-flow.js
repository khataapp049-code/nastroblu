/* Delivery details step (cart drawer). After this step the customer reviews the order
   on review-order.html, then sends it on WhatsApp. Used on shop cart and hamper checkout. */
(function () {
  var pinInfo = {}; // pin -> "loading" | lookup result from /api/orders/pincode/:pin

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function digits(s) {
    return String(s == null ? "" : s).replace(/\D/g, "");
  }

  function headers() {
    var h = { "Content-Type": "application/json" };
    try {
      var t = localStorage.getItem("nb-customer-token") || "";
      if (t) h.Authorization = "Bearer " + t;
    } catch (e) {}
    return h;
  }

  function validateName(raw) {
    var v = String(raw || "").trim().replace(/\s+/g, " ");
    if (!v) return "Name is required";
    if (v.length < 3 || v.length > 60) return "Name must be between 3 and 60 characters";
    return "";
  }

  function validatePhone(raw) {
    var d = digits(raw);
    if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    if (!/^[6-9]\d{9}$/.test(d) || /^(\d)\1{9}$/.test(d)) return "Enter a valid 10-digit mobile number";
    return "";
  }

  function pinFormatError(raw) {
    var p = digits(raw);
    if (!/^[1-9]\d{5}$/.test(p)) return "Enter a valid 6-digit PIN code";
    return "";
  }

  function requiredLine(raw, label, min) {
    var v = String(raw || "").trim();
    if (!v) return label + " is required";
    if (min && v.length < min) return label + " is too short";
    return "";
  }

  /* ---------- PIN code lookup (server asks India Post) ---------- */

  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cityMatches(city, info) {
    var c = norm(city);
    if (!c) return false;
    return (info.areas || []).some(function (a) {
      var n = norm(a);
      if (!n) return false;
      if (n === c) return true;
      return Math.min(n.length, c.length) >= 4 && (n.indexOf(c) !== -1 || c.indexOf(n) !== -1);
    });
  }

  function stateMatches(state, info) {
    var a = norm(state);
    var b = norm(info.state);
    return !!a && (a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
  }

  // Full PIN check for one form: "" means fine.
  function pinError(pinRaw, cityRaw, stateRaw) {
    var fmt = pinFormatError(pinRaw);
    if (fmt) return fmt;
    var info = pinInfo[digits(pinRaw)];
    if (!info || info === "loading") return "Checking PIN code…";
    if (info.ok === false) return info.error || "We couldn’t find this PIN code. Check it and try again.";
    if (!info.verified) return ""; // lookup service unavailable: the server re-checks when you continue
    if (String(stateRaw || "").trim() && !stateMatches(stateRaw, info)) {
      return "This PIN code belongs to " + info.state + ". Check your state or PIN code.";
    }
    if (String(cityRaw || "").trim() && !cityMatches(cityRaw, info)) {
      return "This PIN code doesn’t match " + String(cityRaw).trim() + ". It belongs to " + info.district + ", " + info.state + ".";
    }
    return "";
  }

  async function lookupPin(pin, p) {
    if (pinInfo[pin]) return;
    pinInfo[pin] = "loading";
    var result;
    try {
      var res = await fetch("/api/orders/pincode/" + pin, { credentials: "include" });
      result = await res.json();
    } catch (e) {
      result = { ok: true, verified: false };
    }
    pinInfo[pin] = result;
    autofill(pin, p);
    refresh();
  }

  function autofill(pin, p) {
    var info = pinInfo[pin];
    var pinEl = $(p + "Pin");
    if (!info || !info.ok || !info.verified || !pinEl || digits(pinEl.value) !== pin) return;
    var st = $(p + "State");
    var ct = $(p + "City");
    if (st && info.state) st.value = info.state;
    if (ct && !String(ct.value || "").trim()) ct.value = info.district || (info.places && info.places[0]) || "";
  }

  function showPinOk(p, text) {
    var el = $(p + "Pin-ok");
    if (el) el.textContent = text || "";
  }

  /* ---------- helpers for saved address ---------- */

  function addressComplete(c) {
    if (!c) return false;
    var a = c.address || {};
    return (
      !validateName(c.name) &&
      !validatePhone(c.phone) &&
      !requiredLine(a.line1, "Address", 5) &&
      !requiredLine(a.city, "City", 2) &&
      !requiredLine(a.state, "State", 2) &&
      !pinFormatError(a.pincode)
    );
  }

  function formatAddr(c) {
    var a = (c && c.address) || {};
    return [c.name, c.phone, a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ");
  }

  function deliveryNoteHtml() {
    return (
      '<p class="delivery-fee-note">Delivery charges applicable. We’ll confirm the amount on WhatsApp. ' +
      '<a href="shipping.html">Shipping policy</a></p>'
    );
  }

  function ensureFeeNote() {
    var foot = document.querySelector("#cartDrawer .drawer__foot");
    if (!foot || $("deliveryFeeNote")) return;
    var total = foot.querySelector(".drawer__total");
    var p = document.createElement("p");
    p.id = "deliveryFeeNote";
    p.className = "delivery-fee-note";
    p.innerHTML =
      'Delivery charges applicable. We’ll confirm the amount on WhatsApp. <a href="shipping.html">Shipping policy</a>';
    if (total && total.nextSibling) foot.insertBefore(p, total.nextSibling);
    else foot.insertBefore(p, foot.firstChild);
  }

  function showErr(id, msg) {
    var input = $(id);
    var err = $(id + "-err");
    if (input) input.classList.toggle("is-invalid", !!msg);
    if (err) err.textContent = msg || "";
  }

  function field(id, label, value, extra) {
    extra = extra || {};
    return (
      '<label class="co-field">' +
      esc(label) +
      (extra.required ? " *" : "") +
      '<input id="' +
      id +
      '" type="' +
      (extra.type || "text") +
      '" value="' +
      esc(value || "") +
      '" autocomplete="' +
      esc(extra.auto || "on") +
      '"' +
      (extra.inputmode ? ' inputmode="' + extra.inputmode + '"' : "") +
      (extra.maxlength ? ' maxlength="' + extra.maxlength + '"' : "") +
      " />" +
      (extra.hint ? '<span class="co-ok" id="' + id + '-ok"></span>' : "") +
      '<span class="co-err" id="' +
      id +
      '-err"></span></label>'
    );
  }

  function savedShipping() {
    var c = session.customer || {};
    var a = c.address || {};
    return {
      name: String(c.name || "").trim(),
      phone: digits(c.phone),
      line1: String(a.line1 || "").trim(),
      line2: String(a.line2 || "").trim(),
      city: String(a.city || "").trim(),
      state: String(a.state || "").trim(),
      pincode: digits(a.pincode),
    };
  }

  function readForm() {
    var gift = $("coGift") && $("coGift").checked;
    var p = gift ? "coGift" : "co";
    function v(suffix) {
      return $(p + suffix) ? $(p + suffix).value : "";
    }
    var fromFields = {
      name: String(v("Name")).trim(),
      phone: digits(v("Phone")),
      line1: String(v("Line1")).trim(),
      line2: String(v("Line2")).trim(),
      city: String(v("City")).trim(),
      state: String(v("State")).trim(),
      pincode: digits(v("Pin")),
    };
    var shippingAddress =
      !gift && session.savedView && !fromFields.line1 ? savedShipping() : fromFields;
    return {
      gift: !!gift,
      saveAddress: !!(!gift && $("coSave") && $("coSave").checked),
      notes: $("coNotes") ? $("coNotes").value.trim() : "",
      shippingAddress: shippingAddress,
    };
  }

  // Validates the visible form and shows red messages. Returns true only when everything is fine.
  function validateVisible() {
    var gift = $("coGift") && $("coGift").checked;
    var p = gift ? "coGift" : "co";
    function v(suffix) {
      return $(p + suffix) ? $(p + suffix).value : "";
    }
    var pin = digits(v("Pin"));
    if (pin.length === 6 && !pinInfo[pin]) lookupPin(pin, p);
    var map = {
      name: validateName(v("Name")),
      phone: validatePhone(v("Phone")),
      line1: requiredLine(v("Line1"), "Address line 1", 5),
      city: requiredLine(v("City"), "City", 2),
      state: requiredLine(v("State"), "State", 2),
      pincode: pinError(v("Pin"), v("City"), v("State")),
    };
    var checking = map.pincode === "Checking PIN code…";
    showErr(p + "Name", map.name);
    showErr(p + "Phone", map.phone);
    showErr(p + "Line1", map.line1);
    showErr(p + "City", map.city);
    showErr(p + "State", map.state);
    showErr(p + "Pin", checking ? "" : map.pincode);
    var info = pinInfo[pin];
    if (checking) showPinOk(p, pin.length === 6 ? "Checking PIN code…" : "");
    else if (!map.pincode && info && info.verified) showPinOk(p, "PIN found: " + info.district + ", " + info.state);
    else showPinOk(p, "");
    return !map.name && !map.phone && !map.line1 && !map.city && !map.state && !map.pincode;
  }

  function setPlaceEnabled(ok) {
    var btn = $("checkoutWa");
    if (!btn) return;
    btn.disabled = !ok;
    btn.setAttribute("aria-disabled", ok ? "false" : "true");
  }

  function refresh() {
    if (session.step !== "delivery" || !$("coForm")) return;
    if (session.savedView) {
      setPlaceEnabled(true);
      return;
    }
    setPlaceEnabled(validateVisible());
  }

  function formFields(idPrefix, c, editing) {
    var a = (c && c.address) || {};
    var name = editing ? c && c.name : "";
    var phone = editing ? c && c.phone : "";
    return (
      '<div class="co-grid" data-co-form="' +
      idPrefix +
      '">' +
      field(idPrefix + "Name", "Name", name, { required: true, auto: "name" }) +
      field(idPrefix + "Phone", "Phone", phone, {
        required: true,
        type: "tel",
        inputmode: "numeric",
        maxlength: 10,
        auto: "tel",
      }) +
      field(idPrefix + "Pin", "PIN code", editing ? a.pincode : "", {
        required: true,
        inputmode: "numeric",
        maxlength: 6,
        auto: "postal-code",
        hint: true,
      }) +
      field(idPrefix + "City", "City", editing ? a.city : "", { required: true, auto: "address-level2" }) +
      field(idPrefix + "State", "State", editing ? a.state : "", { required: true, auto: "address-level1" }) +
      field(idPrefix + "Line1", "Address line 1", editing ? a.line1 : "", {
        required: true,
        auto: "address-line1",
      }) +
      field(idPrefix + "Line2", "Address line 2", editing ? a.line2 : "", { auto: "address-line2" }) +
      "</div>"
    );
  }

  var session = {
    step: "cart",
    customer: null,
    editing: false,
    savedView: false,
    prefill: null,
    opts: null,
  };

  function renderDelivery() {
    var body = $("cartBody");
    var head = document.querySelector("#cartDrawer .drawer__head h3");
    var btn = $("checkoutWa");
    var note = $("checkoutNote");
    var c = session.prefill || session.customer || {};
    var saved = !session.prefill && addressComplete(session.customer);
    var showSaved = saved && !session.editing;
    session.savedView = showSaved;
    if (head) head.textContent = "Delivery details";
    if (note) note.textContent = "Next you’ll review your order, then send it to us on WhatsApp.";
    if (btn) {
      btn.textContent = "Review order";
      btn.disabled = true;
    }

    var html = "";
    if (showSaved) {
      html +=
        '<div class="co-summary"><p class="co-label">Deliver to</p><p>' +
        esc(formatAddr(c)) +
        '</p><button type="button" class="btn btn--ghost co-edit" id="coEdit">Edit</button></div>';
      html += formFields("co", c, true).replace('class="co-grid"', 'class="co-grid is-hidden" id="coOwnForm"');
    } else {
      html += '<p class="co-lead">Where should we send this order? We deliver all over India.</p>';
      html += formFields("co", c, true);
    }

    html +=
      '<label class="co-check"><input type="checkbox" id="coGift" /> Deliver to a different address <span>(gift)</span></label>';
    html +=
      '<div id="coGiftWrap" class="is-hidden"><p class="co-lead">Recipient details</p>' +
      formFields("coGift", {}, false) +
      "</div>";
    html +=
      '<label class="co-field">Note (optional)<textarea id="coNotes" rows="2" placeholder="e.g. gift, please call before delivery"></textarea></label>';
    if (!showSaved) {
      var checked = session.prefill && session.prefill.saveAddress === false ? "" : " checked";
      html +=
        '<label class="co-check"><input type="checkbox" id="coSave"' +
        checked +
        " /> Save this address to my profile</label>";
    } else {
      html +=
        '<label class="co-check is-hidden" id="coSaveWrap"><input type="checkbox" id="coSave" /> Save this address to my profile</label>';
    }
    html += '<button type="button" class="btn btn--ghost co-back" id="coBack">← Back to cart</button>';

    body.innerHTML = '<form class="co-form" id="coForm" novalidate>' + html + "</form>";
    session.step = "delivery";
    if (session.prefill && session.prefill.notes && $("coNotes")) $("coNotes").value = session.prefill.notes;
    bindDelivery();
    if (showSaved) setPlaceEnabled(true);
    else setPlaceEnabled(validateVisible());
  }

  function bindDelivery() {
    var form = $("coForm");
    if (!form) return;

    form.addEventListener("input", function (e) {
      var t = e.target;
      if (t && t.id && /Pin$/.test(t.id)) {
        t.value = digits(t.value).slice(0, 6);
        if (t.value.length === 6) lookupPin(t.value, t.id.replace(/Pin$/, ""));
      }
      if (t && t.id && /Phone$/.test(t.id)) t.value = digits(t.value).slice(0, 10);
      setPlaceEnabled(validateVisible());
    });

    if ($("coEdit")) {
      $("coEdit").addEventListener("click", function () {
        session.editing = true;
        renderDelivery();
        var wrap = $("coSaveWrap");
        if (wrap) wrap.classList.remove("is-hidden");
      });
    }

    if ($("coGift")) {
      $("coGift").addEventListener("change", function () {
        var w = $("coGiftWrap");
        if (w) w.classList.toggle("is-hidden", !$("coGift").checked);
        if ($("coSave")) $("coSave").closest("label").classList.toggle("is-hidden", $("coGift").checked);
        session.savedView = false;
        setPlaceEnabled(validateVisible());
      });
    }

    if ($("coBack")) {
      $("coBack").addEventListener("click", function () {
        backToCart();
      });
    }
  }

  function backToCart() {
    session.step = "cart";
    session.editing = false;
    session.prefill = null;
    var head = document.querySelector("#cartDrawer .drawer__head h3");
    var btn = $("checkoutWa");
    var note = $("checkoutNote");
    if (head) head.textContent = "Your cart";
    if (btn) {
      btn.textContent = "Checkout";
      btn.disabled = false;
    }
    if (note) {
      note.textContent = "Sign in required to place an order. Your order is saved to your account, then confirmed on WhatsApp.";
    }
    if (session.opts && typeof session.opts.renderItems === "function") session.opts.renderItems();
  }

  async function loadMe() {
    var res = await fetch("/api/customer/me", { credentials: "include", headers: headers() });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    var data = await res.json();
    return data.customer || null;
  }

  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem("nb_checkout_draft") || "null");
    } catch (e) {
      return null;
    }
  }

  async function start(opts) {
    opts = opts || {};
    session.opts = opts;
    var items = typeof opts.getItems === "function" ? opts.getItems() : [];
    if (!items || !items.length) {
      if (window.Nastro && opts.onEmpty) opts.onEmpty();
      else alert("Add something to your cart first");
      return;
    }
    var customer = await loadMe();
    if (!customer) {
      window.location.href = "account.html?next=checkout";
      return;
    }
    session.customer = customer;

    // Coming back from the review page with "Edit details": restore what was typed.
    session.prefill = null;
    var draft = readDraft();
    if (draft && draft.shippingAddress && !draft.gift) {
      var s = draft.shippingAddress;
      session.prefill = {
        name: s.name,
        phone: s.phone,
        notes: draft.notes || "",
        saveAddress: draft.saveAddress,
        address: { line1: s.line1, line2: s.line2, city: s.city, state: s.state, pincode: s.pincode },
      };
    }
    try {
      sessionStorage.removeItem("nb_checkout_draft");
    } catch (e) {}

    session.editing = !!session.prefill || !addressComplete(customer);
    if (opts.total != null && $("cartTotal")) {
      $("cartTotal").textContent = "₹" + Math.round(Number(opts.total) || 0).toLocaleString("en-IN");
    }
    var drawer = $("cartDrawer");
    if (drawer && !drawer.classList.contains("open")) {
      drawer.classList.add("open");
      var overlay = $("overlay");
      if (overlay) overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    renderDelivery();
  }

  function returnToUrl() {
    if (session.opts && session.opts.source === "hamper") return session.opts.next || "hamper-builder.html";
    var file = location.pathname.split("/").pop() || "index.html";
    var q = location.search || "";
    if (q.indexOf("checkout=1") === -1) q += (q ? "&" : "?") + "checkout=1";
    return file + q;
  }

  // "Review order": check everything with the server, then open the review page.
  async function reviewOrder() {
    if (session.step !== "delivery") return;
    // A saved address is verified by the server in the next step; typed addresses are checked here first.
    if (!session.savedView && !validateVisible()) {
      setPlaceEnabled(false);
      return;
    }
    var payload = readForm();
    var items = session.opts.getItems();
    if (!items.length) return;
    var btn = $("checkoutWa");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking…";
    }
    var notes = payload.notes;
    if (session.opts.source === "hamper") {
      notes = notes ? "Gift hamper. " + notes : "Gift hamper — separate from shop cart";
    }
    var body = {
      items: items.map(function (i) {
        return { productId: i.id || i.productId, size: i.size || i.unit || "", qty: i.qty || 1 };
      }),
      shippingAddress: payload.shippingAddress,
      notes: notes,
      saveAddress: payload.saveAddress,
    };
    function localPreview() {
      var rows = session.opts.getItems() || [];
      var items = rows.map(function (i) {
        var qty = Number(i.qty) || 1;
        var price = Number(i.price) || 0;
        return {
          productId: i.id || i.productId,
          name: i.name || "",
          size: i.size || i.unit || "",
          qty: qty,
          unitPrice: price,
          lineTotal: Math.round(price * qty),
          image: i.image || i.img || "",
        };
      });
      var subtotal = items.reduce(function (s, i) {
        return s + i.lineTotal;
      }, 0);
      return {
        items: items,
        subtotal: subtotal,
        total: subtotal,
        shippingAddress: payload.shippingAddress,
        notes: body.notes,
      };
    }

    function goReview(preview) {
      try {
        sessionStorage.setItem(
          "nb_checkout_draft",
          JSON.stringify({
            source: session.opts.source || "cart",
            returnTo: returnToUrl(),
            gift: payload.gift,
            saveAddress: payload.saveAddress,
            notes: body.notes,
            shippingAddress: payload.shippingAddress,
            items: body.items,
            preview: preview,
          })
        );
      } catch (e) {}
      window.location.href = "review-order.html";
    }

    try {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl
        ? setTimeout(function () {
            ctrl.abort();
          }, 10000)
        : null;
      var res = await fetch("/api/orders/preview", {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      var data = {};
      try {
        data = await res.json();
      } catch (e) {}
      if (res.status === 401) {
        window.location.href = "account.html?next=checkout";
        return;
      }
      if (!res.ok) {
        if (res.status === 404 || res.status === 405) {
          goReview(localPreview());
          return;
        }
        if (data.fields) {
          var p = payload.gift ? "coGift" : "co";
          var ids = { name: p + "Name", phone: p + "Phone", line1: p + "Line1", city: p + "City", state: p + "State", pincode: p + "Pin" };
          Object.keys(data.fields).forEach(function (k) {
            if (ids[k]) showErr(ids[k], data.fields[k]);
          });
        }
        throw new Error(data.error || "Could not review your order");
      }
      goReview(data);
    } catch (err) {
      var msg = String((err && err.message) || "");
      var network = err && (err.name === "AbortError" || /fetch|network|abort/i.test(msg));
      if (network) {
        goReview(localPreview());
        return;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Review order";
      }
      var toast = $("toast");
      var text = network
        ? "Could not reach the server. Check that the site is running, then try again."
        : msg || "Checkout failed";
      if (toast) {
        toast.textContent = text;
        toast.classList.add("show");
        setTimeout(function () {
          toast.classList.remove("show");
        }, 3200);
      } else {
        alert(text);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureFeeNote();
    var btn = $("checkoutWa");
    if (btn) {
      btn.addEventListener(
        "click",
        function (e) {
          if (session.step === "delivery") {
            e.preventDefault();
            e.stopImmediatePropagation();
            reviewOrder();
          }
        },
        true
      );
    }
    var close = $("closeCart");
    if (close) {
      close.addEventListener("click", function () {
        session.step = "cart";
        session.editing = false;
        session.prefill = null;
        var head = document.querySelector("#cartDrawer .drawer__head h3");
        if (head) head.textContent = "Your cart";
        if (btn) {
          btn.textContent = "Checkout";
          btn.disabled = false;
        }
      });
    }
  });

  window.NastroCheckout = {
    start: start,
    backToCart: backToCart,
    isDeliveryStep: function () {
      return session.step === "delivery";
    },
    placeOrder: reviewOrder,
    validatePhone: validatePhone,
    deliveryNoteHtml: deliveryNoteHtml,
  };
})();