/* Review page: shows the items, total and address, then saves the order and opens WhatsApp. */
(function () {
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

  function inr(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN");
  }

  function headers() {
    var h = { "Content-Type": "application/json" };
    try {
      var t = localStorage.getItem("nb-customer-token") || "";
      if (t) h.Authorization = "Bearer " + t;
    } catch (e) {}
    return h;
  }

  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem("nb_checkout_draft") || "null");
    } catch (e) {
      return null;
    }
  }

  function clearCart(source) {
    try {
      if (source === "hamper") {
        localStorage.removeItem("nb_hamper_basket");
        sessionStorage.removeItem("nb_hamper_draft");
        sessionStorage.removeItem("nb_hamper_basket");
      } else {
        localStorage.setItem("nastro-cart", "[]");
      }
    } catch (e) {}
  }

  function addressLine(a) {
    return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ");
  }

  // Internal hamper marker added by checkout; customers should only see their own note.
  function cleanNote(n) {
    n = String(n || "");
    if (/^Gift hamper — separate from shop cart$/.test(n)) return "";
    return n.replace(/^Gift hamper\.\s*/, "").trim();
  }

  function showError(msg) {
    var el = $("reviewErr");
    if (el) el.textContent = msg || "";
  }

  function render(d) {
    var p = d.preview || {};
    var a = p.shippingAddress || d.shippingAddress || {};
    var items = (p.items || [])
      .map(function (i) {
        return (
          "<li><span>" +
          esc(i.name) +
          " (" +
          esc(i.size || "1 pack") +
          ") × " +
          esc(i.qty) +
          "</span><strong>" +
          inr(i.lineTotal) +
          "</strong></li>"
        );
      })
      .join("");
    var who = [a.name, a.phone].filter(Boolean).join(" · ");
    var isHamper = d.source === "hamper";
    var notes = cleanNote(p.notes || d.notes || "");
    var payOn = !!(window.__nbPay && window.__nbPay.enabled);
    var payBlock = payOn
      ? '<div class="co-pay" id="reviewPay"><p class="co-label">Payment</p>' +
        '<label class="co-pay__opt"><input type="radio" name="payMethod" value="upi" checked />' +
        "<span><strong>Pay now with UPI</strong><small>Scan the QR or pay with GPay, PhonePe, Paytm, BHIM</small></span></label>" +
        '<label class="co-pay__opt"><input type="radio" name="payMethod" value="whatsapp" />' +
        "<span><strong>Order on WhatsApp</strong><small>Pay on delivery · we confirm on WhatsApp</small></span></label></div>"
      : "";

    $("reviewCard").innerHTML =
      "<h1>" + (isHamper ? "Review your hamper order" : "Review your order") + "</h1>" +
      (isHamper ? '<p class="form-hint">Gift hamper · packed as its own order, separate from your shop cart.</p>' : "") +
      '<p class="form-hint">Check everything below. ' +
      (payOn
        ? "Next, you pay by UPI or send the order to us on WhatsApp."
        : "On the next page you send the order to us on WhatsApp.") +
      "</p>" +
      '<ul class="confirm-list">' +
      items +
      "</ul>" +
      '<div class="confirm-sub"><span>Subtotal</span><span>' +
      inr(p.subtotal) +
      "</span></div>" +
      '<p class="delivery-fee-note">Delivery charges applicable. We’ll confirm the amount on WhatsApp. ' +
      '<a href="shipping.html">Shipping policy</a></p>' +
      '<div class="confirm-total"><span>Total</span><span>' +
      inr(p.total) +
      "</span></div>" +
      '<div class="confirm-addr"><p class="co-label">Deliver to</p>' +
      (who ? "<p><strong>" +
        esc(who) +
        "</strong></p>" : "") +
      "<p>" +
      esc(addressLine(a)) +
      "</p>" +
      (notes ? '<p class="co-label" style="margin-top:.7rem">Note</p><p>' + esc(notes) + "</p>" : "") +
      "</div>" +
      payBlock +
      '<p class="co-err" id="reviewErr" role="alert"></p>' +
      '<div class="confirm-actions">' +
      '<button type="button" class="btn btn--gold btn--block" id="reviewSend">' + (isHamper ? "Save hamper order and continue" : "Save order and continue") + '</button>' +
      '<a class="btn btn--ghost btn--block" id="reviewEdit" href="' +
      esc(d.returnTo || "index.html") +
      '">Edit details</a>' +
      "</div>" +
      '<p class="form-hint" style="margin-top:.8rem">Your order is saved when you tap the button. It is confirmed once we have seen your WhatsApp message, which you send on the next page.</p>';

    $("reviewSend").addEventListener("click", function () {
      send(d);
    });
    if (payOn) {
      var base = $("reviewSend").textContent;
      var sync = function () {
        var m = document.querySelector('input[name="payMethod"]:checked');
        $("reviewSend").textContent =
          m && m.value === "upi" ? "Save order, then pay with UPI" : base;
      };
      Array.prototype.forEach.call(document.querySelectorAll('input[name="payMethod"]'), function (r) {
        r.addEventListener("change", sync);
      });
      sync();
    }
  }

  var sending = false;

  async function send(d) {
    if (sending) return;
    sending = true;
    showError("");
    var btn = $("reviewSend");
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving your order…";

    function fail(msg) {
      sending = false;
      btn.disabled = false;
      btn.textContent = label;
      showError(msg);
    }

    var pm = document.querySelector('input[name="payMethod"]:checked');
    var payMethod = pm ? pm.value : "whatsapp";

    try {
      var res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify({
          items: d.items,
          shippingAddress: d.shippingAddress,
          notes: d.notes,
          saveAddress: d.saveAddress,
          paymentMethod: payMethod,
        }),
      });
      var data = {};
      try {
        data = await res.json();
      } catch (e) {}
      if (res.status === 401) {
        window.location.href = "account.html?next=checkout";
        return;
      }
      if (!res.ok) {
        fail((data.error || "Could not save your order") + (data.fields ? " Use Edit details to fix it." : ""));
        return;
      }

      clearCart(d.source);
      try {
        sessionStorage.removeItem("nb_checkout_draft");
        sessionStorage.setItem("nb_last_order", JSON.stringify(data));
      } catch (e) {}

      var num = data.order && data.order.orderNumber;
      window.location.href =
        "order-confirmation.html?order=" + encodeURIComponent(num || "");
    } catch (e) {
      fail("Could not reach the server. Check your connection and try again.");
    }
  }

  async function init() {
    var d = readDraft();
    if (!d || !d.preview || !d.items || !d.items.length) {
      window.location.href = "index.html";
      return;
    }
    try {
      var r = await fetch("/api/payments/youpi/config", { cache: "no-store" });
      if (r.ok) window.__nbPay = await r.json();
    } catch (e) {}
    render(d);
  }

  document.addEventListener("DOMContentLoaded", init);
})();