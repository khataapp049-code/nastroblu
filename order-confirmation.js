/* Order page. Honest status: "Almost done" until the order is set to Confirmed in the admin panel. */
(function () {
  var WA = "919063048255";

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

  /* ---------- UPI payment (YouPI-PG) ---------- */
  var payCfg = null;

  async function loadPayCfg() {
    if (payCfg) return payCfg;
    try {
      var res = await fetch("/api/payments/youpi/config", { cache: "no-store" });
      if (res.ok) payCfg = await res.json();
    } catch (e) {}
    return payCfg;
  }

  function pollSoon() {
    // The webhook is the real proof of payment; just re-check the order a few times.
    var n = 0;
    var t = setInterval(function () {
      refresh(true);
      if (++n >= 12 || (liveOrder && liveOrder.paymentStatus === "paid")) clearInterval(t);
    }, 3000);
  }

  function showPayError(msg) {
    var card = $("confirmCard");
    if (!card) return;
    var hint = card.querySelector(".form-hint") || card.querySelector("#payError");
    if (!hint) {
      hint = document.createElement("p");
      hint.id = "payError";
      hint.className = "form-hint";
      card.insertBefore(hint, card.querySelector("h1") ? card.querySelector("h1").nextSibling : card.firstChild);
    }
    hint.style.color = "#9b1c1c";
    hint.textContent = msg;
    var btn = $("confirmPay");
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.getAttribute("data-label") || "Pay with UPI";
    }
  }

  async function startUpiPayment(o) {
    var btn = $("confirmPay");
    if (btn) {
      if (!btn.getAttribute("data-label")) btn.setAttribute("data-label", btn.textContent);
      btn.disabled = true;
      btn.textContent = "Opening UPI…";
    }
    try {
      var cfg = await loadPayCfg();
      if (!cfg || !cfg.enabled) {
        throw new Error("Online payment isn’t available right now. Message us on WhatsApp to pay.");
      }
      var res = await fetch("/api/payments/youpi/start", {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify({ orderNumber: o.orderNumber }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (data.alreadyPaid) {
        window.location.reload();
        return;
      }
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Could not start UPI checkout");
      }
      window.location.href = data.checkoutUrl;
    } catch (e) {
      var msg = (e && e.message) || "Could not open UPI.";
      if (msg === "Failed to fetch" || (e && e.name === "TypeError")) {
        msg = "Could not reach the shop API. Keep Nastro Blu running on port 4000, then tap Pay again.";
      }
      showPayError(msg);
    }
  }

  function orderNumberFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("order") || "";
    } catch (e) {
      return "";
    }
  }

  function confirmedFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("confirmed") === "1";
    } catch (e) {
      return false;
    }
  }

  function cachedOrder(num) {
    try {
      var data = JSON.parse(sessionStorage.getItem("nb_last_order") || "null");
      var o = data && data.order;
      if (o && (!num || o.orderNumber === num)) return o;
    } catch (e) {}
    return null;
  }

  async function fetchOrder(num) {
    var res = await fetch("/api/orders/" + encodeURIComponent(num), {
      credentials: "include",
      cache: "no-store",
      headers: headers(),
    });
    if (res.status === 401) return { unauthorized: true };
    if (!res.ok) return null;
    var data = await res.json();
    return data.order || null;
  }

  function addressLine(a) {
    a = a || {};
    return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ");
  }

  // Internal hamper marker added by checkout; customers should only see their own note.
  function cleanNote(n) {
    n = String(n || "");
    if (/^Gift hamper — separate from shop cart$/.test(n)) return "";
    return n.replace(/^Gift hamper\.\s*/, "").trim();
  }

  function isHamperOrder(o) {
    return /^Gift hamper/.test(String((o && o.notes) || ""));
  }

  function whatsappUrl(o) {
    try {
      var saved = JSON.parse(sessionStorage.getItem("nb_last_order") || "null");
      if (saved && saved.whatsappUrl && saved.order && saved.order.orderNumber === o.orderNumber) {
        return saved.whatsappUrl;
      }
    } catch (e) {}
    var a = o.shippingAddress || {};
    var lines = [
      "Hi Nastro Blu! I've placed " + (isHamperOrder(o) ? "gift hamper order " : "order ") + o.orderNumber + ":",
      "",
    ];
    (o.items || []).forEach(function (i) {
      lines.push("• " + i.name + " (" + (i.size || "1 pack") + ") × " + i.qty + " - " + inr(i.lineTotal));
    });
    lines.push("");
    lines.push("Total: " + inr(o.total));
    lines.push("Delivery charges applicable — please confirm the amount.");
    lines.push("");
    var who = [a.name, a.phone].filter(Boolean).join(" · ");
    if (who) lines.push("Deliver to: " + who);
    var addr = addressLine(a);
    if (addr) lines.push("Address: " + addr);
    if (cleanNote(o.notes)) lines.push("Note: " + cleanNote(o.notes));
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  var STATUS_TEXT = {
    pending: "Waiting",
    confirmed: "Confirmed",
    packed: "Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  var WA_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2zm5.79 14.13c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.83-.11-.42-.13-.97-.32-1.67-.62-2.94-1.27-4.86-4.23-5.01-4.43-.15-.2-1.22-1.62-1.22-3.09 0-1.47.77-2.19 1.04-2.49.27-.3.6-.37.8-.37h.57c.18 0 .43-.07.67.51.24.6.82 2.07.89 2.22.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.53-.15.15-.3.31-.13.61.18.3.8 1.32 1.72 2.14 1.18 1.05 2.18 1.38 2.48 1.53.3.15.48.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.34.08.13.08.75-.16 1.43z"/></svg>';

  function rememberOrder(o) {
    try {
      var saved = JSON.parse(sessionStorage.getItem("nb_last_order") || "null") || {};
      saved.order = o;
      sessionStorage.setItem("nb_last_order", JSON.stringify(saved));
    } catch (e) {}
  }

  function render(o) {
    var a = o.shippingAddress || {};
    var items = (o.items || [])
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

    // Honest status: clicking WhatsApp does not confirm the order.
    // Confirmed only when the admin panel sets the order to Confirmed (or later).
    var st = o.status || "pending";
    var cancelled = st === "cancelled";
    var confirmed = (st !== "pending" && !cancelled) || confirmedFromUrl();
    var isUpi = o.paymentMethod === "upi_youpi";
    var paid = o.paymentStatus === "paid";
    if (isUpi) confirmed = !cancelled && (paid || st !== "pending");
    var label = STATUS_TEXT[st] || st;
    var kind = isHamperOrder(o) ? "Hamper order " : "Order ";

    var badge, badgeClass, title, intro;
    if (cancelled) {
      badge = "Order cancelled";
      badgeClass = "confirm-badge--cancelled";
      title = kind + o.orderNumber + " cancelled";
      intro = "This order was cancelled. Message us on WhatsApp if you think this is a mistake.";
    } else if (confirmed) {
      badge = "✓ Confirmed";
      badgeClass = "confirm-badge--done";
      title = kind + o.orderNumber + " " + (st === "confirmed" ? "confirmed" : label.toLowerCase());
      intro =
        "We’ve received your message and confirmed your order. We’ll share the delivery charges on WhatsApp.";
    } else {
      badge = "Almost done: send your message on WhatsApp";
      badgeClass = "confirm-badge--pending";
      title = kind + o.orderNumber + " saved";
      intro =
        "Your order isn’t confirmed yet. Tap the button below and press send in WhatsApp so we get it.";
    }

    if (isUpi && !cancelled) {
      if (paid) {
        badge = "✓ Payment received";
        intro =
          "We’ve received your UPI payment of " + inr(o.total) +
          " and confirmed your order. We’ll share the delivery charges on WhatsApp.";
      } else if (!confirmed) {
        badge = "Almost done: complete your UPI payment";
        intro =
          "Your order is saved. It’s confirmed automatically once your payment is verified, usually within a minute.";
      }
    }

    var card = $("confirmCard");
    card.className =
      "confirm-card" +
      (cancelled
        ? " confirm-card--cancelled"
        : confirmed
          ? " confirm-card--confirmed"
          : " confirm-card--pending");

    var steps = "";
    if (!cancelled) {
      steps =
        '<ul class="confirm-steps">' +
        "<li><span>Order saved</span><span>Done</span></li>" +
        "<li><span>Message sent on WhatsApp</span>" +
        (confirmed
          ? "<span>Done</span>"
          : '<span class="confirm-step--next">Next step</span>') +
        "</li>" +
        "<li><span>Confirmed by Nastro Blu</span>" +
        (confirmed
          ? "<span>Done</span>"
          : '<span class="confirm-step--wait">Waiting</span>') +
        "</li></ul>";
    }

    if (isUpi && !cancelled) {
      steps =
        '<ul class="confirm-steps">' +
        "<li><span>Order saved</span><span>Done</span></li>" +
        "<li><span>UPI payment verified</span>" +
        (paid ? "<span>Done</span>" : '<span class="confirm-step--next">Next step</span>') +
        "</li><li><span>Confirmed by Nastro Blu</span>" +
        (confirmed ? "<span>Done</span>" : '<span class="confirm-step--wait">Waiting</span>') +
        "</li></ul>";
    }
    var payBtn =
      isUpi && !paid && !cancelled
        ? '<button type="button" class="btn btn--gold btn--block" id="confirmPay">Pay ' + inr(o.total) + " with UPI</button>"
        : "";

    var quietWa = confirmed || cancelled || isUpi;
    var waClass = (quietWa ? "btn btn--ghost btn--block" : "btn btn--gold btn--block") + " confirm-wa";
    var waText = quietWa ? "Message us on WhatsApp" : "Send on WhatsApp";

    card.innerHTML =
      '<span class="confirm-badge ' + badgeClass + '">' + esc(badge) + "</span>" +
      "<h1>" + esc(title) + "</h1>" +
      '<p class="confirm-intro">' + esc(intro) + "</p>" +
      '<div class="confirm-actions confirm-actions--top">' +
      payBtn +
      '<a class="' + waClass + '" id="confirmWa" href="' +
      esc(whatsappUrl(o)) + '" target="_blank" rel="noopener">' +
      (quietWa ? "" : WA_ICON) +
      waText + "</a>" +
      "</div>" +
      steps +
      (confirmed || cancelled
        ? ""
        : '<p class="form-hint">This page updates by itself once we confirm. ' +
          '<button type="button" id="confirmRefresh" style="background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">Check now</button></p>') +
      '<ul class="confirm-list">' + items + "</ul>" +
      '<div class="confirm-total"><span>Total</span><span>' + inr(o.total) + "</span></div>" +
      '<p class="delivery-fee-note">Delivery charges applicable. We’ll confirm the amount on WhatsApp. ' +
      '<a href="shipping.html">Shipping policy</a></p>' +
      '<div class="confirm-addr"><p class="co-label">Delivering to</p>' +
      (who ? "<p><strong>" + esc(who) + "</strong></p>" : "") +
      "<p>" + esc(addressLine(a)) + "</p>" +
      (cleanNote(o.notes) ? '<p class="co-label" style="margin-top:.7rem">Note</p><p>' + esc(cleanNote(o.notes)) + "</p>" : "") +
      "</div>" +
      '<div class="confirm-actions">' +
      '<a class="btn btn--ghost btn--block" href="account.html#orders">View in Account → Orders</a>' +
      '<a class="btn btn--ghost btn--block" href="index.html#categories">Continue shopping</a>' +
      "</div>";
  }

  function fail(msg, loginLink) {
    $("confirmCard").innerHTML =
      "<h1>Order</h1><p>" +
      esc(msg) +
      "</p>" +
      (loginLink
        ? '<div class="confirm-actions"><a class="btn btn--gold btn--block" href="account.html?next=' +
          encodeURIComponent("order-confirmation.html?order=" + orderNumberFromUrl()) +
          '">Sign in</a></div>'
        : '<div class="confirm-actions"><a class="btn btn--ghost btn--block" href="account.html#orders">Go to Account → Orders</a></div>');
  }

  var currentNum = "";
  var lastStatus = "";
  var liveOrder = null;
  var timer = null;
  var sending = false;

  function isFinal(st) {
    return st && st !== "pending";
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Fetch the latest order from the server and redraw if anything changed.
  async function refresh(showErrors) {
    try {
      var o = await fetchOrder(currentNum);
      if (o && o.unauthorized) {
        if (showErrors) {
          var hint = $("confirmCard").querySelector(".form-hint");
          if (hint) hint.textContent = "Please sign in again to see the latest status.";
        }
        return;
      }
      if (!o) return;
      rememberOrder(o);
      liveOrder = o;
      var next = o.status || "pending";
      if (next !== lastStatus || showErrors) {
        lastStatus = next;
        render(o);
        wireActions();
      }
      if (isFinal(lastStatus)) stopPolling();
    } catch (e) {}
  }

  function applyConfirmed(o) {
    if (!o) return;
    if (!o.status || o.status === "pending") o.status = "confirmed";
    liveOrder = o;
    lastStatus = o.status;
    rememberOrder(o);
    render(o);
    wireActions();
    stopPolling();
  }

  async function markWhatsappSent() {
    try {
      var res = await fetch("/api/orders/" + encodeURIComponent(currentNum) + "/whatsapp-sent", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: headers(),
      });
      if (res.ok) {
        var data = await res.json();
        if (data.order) return data.order;
      }
    } catch (e) {}
    if (liveOrder) {
      liveOrder.status = "confirmed";
      return liveOrder;
    }
    return null;
  }

  function openWhatsApp(url) {
    // Never send this tab to WhatsApp — keep the shop on the confirmation page.
    var link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function goToConfirmedPage(o) {
    var num = (o && o.orderNumber) || currentNum || "";
    window.location.replace(
      "order-confirmation.html?order=" + encodeURIComponent(num) + "&confirmed=1"
    );
  }

  function wireActions() {
    var b = $("confirmRefresh");
    if (b) {
      b.addEventListener("click", function () {
        b.textContent = "Checking…";
        refresh(true).then(function () {
          var again = $("confirmRefresh");
          if (again) again.textContent = "Check now";
        });
      });
    }
    var pay = $("confirmPay");
    if (pay && liveOrder) {
      pay.addEventListener("click", function () {
        startUpiPayment(liveOrder);
      });
    }
    var a = $("confirmWa");
    if (!a || !liveOrder) return;
    if (liveOrder.paymentMethod === "upi_youpi") return; // plain link: WhatsApp never confirms a UPI order
    if ((liveOrder.status || "pending") !== "pending") return;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (sending) return;
      sending = true;
      var url = a.getAttribute("href");
      a.textContent = "Opening WhatsApp…";
      openWhatsApp(url);
      markWhatsappSent().then(function (o) {
        applyConfirmed(o);
        setTimeout(function () {
          goToConfirmedPage(o);
          sending = false;
        }, 300);
      });
    });
  }

  async function init() {
    var num = orderNumberFromUrl();
    var cached = cachedOrder(num);
    currentNum = num || (cached && cached.orderNumber) || "";
    if (cached) {
      liveOrder = cached;
      lastStatus = cached.status || "pending";
      render(cached);
      wireActions();
    }
    if (!currentNum) {
      fail("We couldn’t find an order to show.");
      return;
    }
    try {
      var o = await fetchOrder(currentNum);
      if (o && o.unauthorized) {
        if (!cached) fail("Please sign in to see this order.", true);
        return;
      }
      if (o) {
        rememberOrder(o);
        liveOrder = o;
        lastStatus = o.status || "pending";
        render(o);
        wireActions();
      } else if (!cached) {
        fail("We couldn’t find that order in your account.");
        return;
      }
    } catch (e) {
      if (!cached) {
        fail("Could not load your order. Please check Account → Orders.");
        return;
      }
    }

    if (!isFinal(lastStatus)) {
      timer = setInterval(function () {
        if (!document.hidden) refresh(false);
      }, 8000);
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refresh(true);
    });
    window.addEventListener("pageshow", function () {
      if (currentNum) refresh(true);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();