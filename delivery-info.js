/**
 * Delivery info popup (from Our Story document).
 * Shown first on visit; after dismiss (or if already seen), signals Today's Special to open.
 * Re-shows after 7 days.
 */
(function () {
  var KEY = "nastroblu_delivery_info_dismissed";
  var DAYS = 7;
  var done = false;

  function dismissedRecently() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var t = Number(raw);
      if (!t) return false;
      return Date.now() - t < DAYS * 24 * 60 * 60 * 1000;
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch (e) {}
  }

  function signalDone() {
    if (done) return;
    done = true;
    window.__nastroDeliveryDone = true;
    try {
      window.dispatchEvent(new CustomEvent("nastroblu:delivery-done"));
    } catch (e) {}
  }

  function close(root) {
    root.classList.remove("open");
    markDismissed();
    setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
      signalDone();
    }, 280);
  }

  function open() {
    if (document.getElementById("deliveryInfo")) return;

    var root = document.createElement("div");
    root.id = "deliveryInfo";
    root.className = "delivery-info";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "deliveryInfoTitle");
    root.innerHTML =
      '<div class="delivery-info__panel">' +
      '<button type="button" class="delivery-info__close" aria-label="Close">×</button>' +
      '<h2 id="deliveryInfoTitle">Delivery information</h2>' +
      "<ul>" +
      "<li><strong>Sweets &amp; snacks — Hyderabad:</strong> order before 4 pm, delivery next day before 4 pm.</li>" +
      "<li><strong>Sweets &amp; snacks — Outside Hyderabad:</strong> order before 4 pm, dispatch next day before 4 pm.</li>" +
      "<li><strong>Naturally grown essentials</strong> (Hyderabad &amp; within India): same day, subject to availability.</li>" +
      "</ul>" +
      '<div class="delivery-info__actions">' +
      '<button type="button" class="btn btn--wine" data-delivery-ok>Got it</button>' +
      '<a class="delivery-info__link" href="shipping.html">Full shipping policy</a>' +
      "</div>" +
      "</div>";

    document.body.appendChild(root);
    requestAnimationFrame(function () {
      root.classList.add("open");
    });

    root.querySelector(".delivery-info__close").addEventListener("click", function () {
      close(root);
    });
    root.querySelector("[data-delivery-ok]").addEventListener("click", function () {
      close(root);
    });
    root.addEventListener("click", function (e) {
      if (e.target === root) close(root);
    });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape" && root.classList.contains("open")) {
        document.removeEventListener("keydown", onEsc);
        close(root);
      }
    });
  }

  function schedule() {
    if (dismissedRecently()) {
      // Already seen — let Today's Special run as usual
      signalDone();
      return;
    }
    setTimeout(open, 600);
  }

  // Expose for Today's Special (and debugging)
  window.NastroDeliveryInfo = {
    whenDone: function (fn) {
      if (typeof fn !== "function") return;
      if (window.__nastroDeliveryDone) {
        fn();
        return;
      }
      window.addEventListener("nastroblu:delivery-done", fn, { once: true });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }
})();
