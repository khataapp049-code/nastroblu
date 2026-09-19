/* Storefront wishlist — heart buttons + toggle (login required) */
(function (global) {
  var TOKEN_KEY = "nb-customer-token";
  var API = "/api/wishlist";
  var ids = {};
  var loaded = false;

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function headers() {
    var h = { "Content-Type": "application/json" };
    var t = getToken();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  function loginUrl(slug) {
    var next = slug ? "product.html?id=" + encodeURIComponent(slug) : "account.html#wishlist";
    return "account.html?next=" + encodeURIComponent(next);
  }

  function has(slug) {
    return !!ids[slug];
  }

  function paint(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-wish]").forEach(function (btn) {
      var slug = btn.getAttribute("data-wish");
      var on = has(slug);
      btn.classList.toggle("is-wished", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Remove from wishlist" : "Add to wishlist");
      var icon = btn.querySelector(".wish-btn__icon");
      if (icon) icon.textContent = on ? "♥" : "♡";
      var label = btn.querySelector("[data-wish-label]");
      if (label) label.textContent = on ? "Saved" : "Wishlist";
    });
  }

  async function refresh() {
    if (!getToken()) {
      ids = {};
      loaded = true;
      paint();
      return [];
    }
    try {
      var res = await fetch(API + "/ids", {
        credentials: "include",
        headers: headers(),
      });
      if (res.status === 401) {
        ids = {};
        loaded = true;
        paint();
        return [];
      }
      var data = await res.json();
      ids = {};
      (data.ids || []).forEach(function (s) {
        ids[s] = true;
      });
      loaded = true;
      paint();
      return data.ids || [];
    } catch (e) {
      loaded = true;
      return [];
    }
  }

  async function toggle(slug) {
    if (!slug) return null;
    if (!getToken()) {
      window.location.href = loginUrl(slug);
      return null;
    }
    var res = await fetch(API + "/toggle/" + encodeURIComponent(slug), {
      method: "POST",
      credentials: "include",
      headers: headers(),
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {}
    if (res.status === 401) {
      window.location.href = loginUrl(slug);
      return null;
    }
    if (!res.ok) throw new Error(data.error || "Could not update wishlist");
    if (data.wished) ids[slug] = true;
    else delete ids[slug];
    paint();
    return data;
  }

  function bind(root) {
    var scope = root || document;
    if (scope.__wishBound) return;
    scope.__wishBound = true;
    scope.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-wish]");
      if (!btn || !scope.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      var slug = btn.getAttribute("data-wish");
      btn.disabled = true;
      toggle(slug)
        .then(function (data) {
          if (!data) return;
          if (global.Nastro && typeof global.Nastro.toast === "function") {
            global.Nastro.toast(data.wished ? "Saved to wishlist" : "Removed from wishlist");
          } else if (typeof global.toast === "function") {
            /* no-op */
          } else {
            var t = document.getElementById("toast");
            if (t) {
              t.textContent = data.wished ? "Saved to wishlist" : "Removed from wishlist";
              t.classList.add("show");
              clearTimeout(bind._t);
              bind._t = setTimeout(function () {
                t.classList.remove("show");
              }, 2000);
            }
          }
        })
        .catch(function (err) {
          alert(err.message || "Wishlist update failed");
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  function buttonHtml(slug, withLabel) {
    var s = String(slug || "").replace(/"/g, "");
    return (
      '<button type="button" class="wish-btn" data-wish="' +
      s +
      '" aria-pressed="false" aria-label="Add to wishlist">' +
      '<span class="wish-btn__icon" aria-hidden="true">♡</span>' +
      (withLabel ? '<span data-wish-label>Wishlist</span>' : "") +
      "</button>"
    );
  }

  var api = {
    refresh: refresh,
    toggle: toggle,
    paint: paint,
    bind: bind,
    has: has,
    buttonHtml: buttonHtml,
    isLoaded: function () {
      return loaded;
    },
  };

  global.NastroWishlist = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bind(document);
      refresh();
    });
  } else {
    bind(document);
    refresh();
  }
})(window);
