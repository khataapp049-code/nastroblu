(function () {
  var API = "/api/customer";
  var TOKEN_KEY = "nb-customer-token";
  var state = { customer: null, tab: "login" };

  /* =========================================================
   * Basic helpers
   * ======================================================= */
  function $(id) {
    return document.getElementById(id);
  }

  function val(id) {
    var el = $(id);
    return el ? el.value : "";
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    var t = getToken();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  async function api(path, opts) {
    opts = opts || {};
    var res;
    try {
      res = await fetch(API + path, {
        method: opts.method || "GET",
        headers: authHeaders(),
        credentials: "include",
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      var netErr = new Error("Network error. Please check your connection and try again.");
      netErr.status = 0;
      throw netErr;
    }
    var data = {};
    try {
      data = await res.json();
    } catch (e) {}
    if (!res.ok) {
      var err = new Error(data.error || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function showMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", !!isError);
    el.classList.toggle("is-ok", !isError && !!text);
    el.hidden = !text;
  }

  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso || "";
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* =========================================================
   * Validation engine
   * Every validator returns { value: normalizedValue, error: "" }
   * ======================================================= */
  function ok(v) {
    return { value: v, error: "" };
  }
  function fail(msg) {
    return { value: "", error: msg };
  }
  // trim + collapse repeated whitespace
  function clean(raw) {
    return String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
  }

  var EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/;
  var NAME_RE = /^[\p{L}][\p{L}\p{M}\s.'\-]*$/u;
  var PLACE_RE = /^[\p{L}][\p{L}\p{M}\s.'\-&]*$/u;
  var ADDRESS_RE = /^[\p{L}\p{N}\p{M}\s,.\/#\-()'&]+$/u;
  var WEAK_PASSWORDS = ["password", "12345678", "123456789", "qwerty", "admin123", "welcome", "letmein", "iloveyou", "abc12345"];

  var V = {
    name: function (raw) {
      var v = clean(raw);
      if (!v) return fail("Full name is required");
      if (!/^\p{L}/u.test(v)) return fail("Name must start with a letter (no numbers or special characters)");
      if (v.length < 3) return fail("Name must be at least 3 characters");
      if (v.length > 60) return fail("Name must be 60 characters or fewer");
      if (!NAME_RE.test(v)) return fail("Name can contain only letters, spaces, . ' and -");
      return ok(v);
    },

    // requireGmail = true on signup: only @gmail.com addresses are accepted
    email: function (raw, requireGmail) {
      var v = String(raw == null ? "" : raw).trim().toLowerCase();
      if (!v) return fail("Email is required");
      if (v.length > 254) return fail("Email is too long");
      var local = v.split("@")[0] || "";
      if (
        !EMAIL_RE.test(v) ||
        v.indexOf("..") !== -1 ||
        local.length > 64 ||
        local.charAt(0) === "." ||
        local.charAt(local.length - 1) === "."
      ) {
        return fail(
          requireGmail
            ? "Enter a valid Gmail address, e.g. name@gmail.com"
            : "Enter a valid email address, e.g. name@example.com"
        );
      }
      if (requireGmail && v.slice(-10) !== "@gmail.com") {
        return fail("Only @gmail.com email addresses are allowed");
      }
      return ok(v);
    },

    // Indian mobile number. required = true/false
    phone: function (raw, required) {
      var digits = String(raw == null ? "" : raw).replace(/[\s\-()]/g, "");
      if (!digits) return required ? fail("Mobile number is required") : ok("");
      // strip +91 / 91 / 0 prefix when exactly 10 digits follow
      digits = digits.replace(/^(\+91|91|0)(?=\d{10}$)/, "");
      if (!/^[6-9]\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) {
        return fail("Enter a valid 10-digit Indian mobile number");
      }
      return ok(digits);
    },

    // Used for signup + change password
    newPassword: function (raw, ctx) {
      ctx = ctx || {};
      var v = String(raw == null ? "" : raw);
      if (!v) return fail("Password is required");
      if (v.length < 8) return fail("Password must be at least 8 characters");
      if (v.length > 64) return fail("Password must be 64 characters or fewer");
      if (/\s/.test(v)) return fail("Password cannot contain spaces");

      var missing = [];
      if (!/[a-z]/.test(v)) missing.push("a lowercase letter");
      if (!/[A-Z]/.test(v)) missing.push("an uppercase letter");
      if (!/\d/.test(v)) missing.push("a number");
      if (!/[^A-Za-z0-9]/.test(v)) missing.push("a special character");
      if (missing.length) return fail("Password must include " + missing.join(", "));

      var lower = v.toLowerCase();
      var weak = WEAK_PASSWORDS.some(function (w) {
        return lower.indexOf(w) !== -1;
      });
      if (weak) return fail("This password is too common. Choose something harder to guess");

      var local = String(ctx.email || "").toLowerCase().split("@")[0];
      if (local.length >= 4 && lower.indexOf(local) !== -1) {
        return fail("Password must not contain your email name");
      }
      return ok(v);
    },

    // Login only checks presence (no strength rules, so older accounts still work)
    loginPassword: function (raw) {
      var v = String(raw == null ? "" : raw);
      if (!v) return fail("Password is required");
      if (v.length > 128) return fail("Password is too long");
      return ok(v);
    },

    currentPassword: function (raw) {
      var v = String(raw == null ? "" : raw);
      if (!v) return fail("Enter your current password");
      return ok(v);
    },

    confirm: function (raw, other) {
      var v = String(raw == null ? "" : raw);
      if (!v) return fail("Please confirm your password");
      if (v !== String(other == null ? "" : other)) return fail("Passwords do not match");
      return ok(v);
    },

    addrLine1: function (raw) {
      var v = clean(raw);
      if (!v) return fail("Address line 1 is required");
      if (v.length < 5) return fail("Address is too short");
      if (v.length > 100) return fail("Address must be 100 characters or fewer");
      if (!ADDRESS_RE.test(v)) return fail("Address contains unsupported characters");
      return ok(v);
    },

    addrLine2: function (raw) {
      var v = clean(raw);
      if (!v) return ok("");
      if (v.length > 100) return fail("Address must be 100 characters or fewer");
      if (!ADDRESS_RE.test(v)) return fail("Address contains unsupported characters");
      return ok(v);
    },

    city: function (raw) {
      var v = clean(raw);
      if (!v) return fail("City is required");
      if (v.length < 2) return fail("City name is too short");
      if (v.length > 50) return fail("City must be 50 characters or fewer");
      if (!PLACE_RE.test(v)) return fail("City can contain only letters and spaces");
      return ok(v);
    },

    state: function (raw) {
      var v = clean(raw);
      if (!v) return fail("State is required");
      if (v.length < 2) return fail("State name is too short");
      if (v.length > 50) return fail("State must be 50 characters or fewer");
      if (!PLACE_RE.test(v)) return fail("State can contain only letters and spaces");
      return ok(v);
    },

    pincode: function (raw) {
      var v = String(raw == null ? "" : raw).replace(/\s/g, "");
      if (!v) return fail("PIN code is required");
      if (!/^[1-9]\d{5}$/.test(v)) return fail("Enter a valid 6-digit PIN code");
      return ok(v);
    },
  };

  /* ---------- inline error UI ---------- */
  function injectValidationStyles() {
    if (document.getElementById("nb-validation-styles")) return;
    var s = document.createElement("style");
    s.id = "nb-validation-styles";
    s.textContent =
      ".field-error{display:block;margin-top:4px;color:#b3261e;font-size:.8125rem;line-height:1.3}" +
      "input.is-invalid,select.is-invalid,textarea.is-invalid{border-color:#b3261e!important}";
    document.head.appendChild(s);
  }

  function setFieldError(input, message) {
    if (!input) return;
    var errId = input.id + "-error";
    var el = document.getElementById(errId);
    if (message) {
      if (!el) {
        el = document.createElement("small");
        el.id = errId;
        el.className = "field-error";
        el.setAttribute("role", "alert");
        input.insertAdjacentElement("afterend", el);
      }
      el.textContent = message;
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", errId);
    } else {
      if (el) el.remove();
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  }

  function clearFormErrors(form) {
    if (!form) return;
    form.querySelectorAll(".is-invalid").forEach(function (el) {
      setFieldError(el, "");
    });
  }

  // pairs: [[inputElement, validatorResult], ...]  -> true when all valid
  function applyResults(pairs) {
    var first = null;
    pairs.forEach(function (p) {
      if (!p[0]) return;
      setFieldError(p[0], p[1].error);
      if (p[1].error && !first) first = p[0];
    });
    if (first) first.focus();
    return !first;
  }

  // Live validation: on blur, then on every keystroke once a field has an error
  function bindLive(id, validate) {
    var el = $(id);
    if (!el) return;
    el.addEventListener("input", function () {
      el.dataset.touched = "1";
      if (el.classList.contains("is-invalid")) setFieldError(el, validate(el.value).error);
    });
    el.addEventListener("blur", function () {
      if (el.dataset.touched || el.value !== "") setFieldError(el, validate(el.value).error);
    });
  }

  function setAttrs(id, attrs) {
    var el = $(id);
    if (!el) return;
    Object.keys(attrs).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
  }

  function isBusy(form) {
    var btn = form && form.querySelector('[type="submit"]');
    return !!(btn && btn.disabled);
  }

  // Prevents double submits while a request is in flight
  function setBusy(form, busy) {
    var btn = form && form.querySelector('[type="submit"]');
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = "Please wait…";
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.disabled = false;
    }
  }

  function friendlyError(err, fallback) {
    if (err.status === 0) return err.message;
    if (err.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
    if (err.status >= 500) return "Something went wrong on our side. Please try again shortly.";
    return err.message || fallback;
  }

  // Address is all-or-nothing: if any field is filled, the required ones must be valid
  function validateAddress() {
    var ids = { line1: "addrLine1", line2: "addrLine2", city: "addrCity", state: "addrState", pincode: "addrPin" };
    var anyFilled = Object.keys(ids).some(function (k) {
      return val(ids[k]).trim() !== "";
    });
    var res;
    if (!anyFilled) {
      res = { line1: ok(""), line2: ok(""), city: ok(""), state: ok(""), pincode: ok("") };
    } else {
      res = {
        line1: V.addrLine1(val(ids.line1)),
        line2: V.addrLine2(val(ids.line2)),
        city: V.city(val(ids.city)),
        state: V.state(val(ids.state)),
        pincode: V.pincode(val(ids.pincode)),
      };
    }
    var pairs = Object.keys(ids).map(function (k) {
      return [$(ids[k]), res[k]];
    });
    return {
      pairs: pairs,
      value: {
        line1: res.line1.value,
        line2: res.line2.value,
        city: res.city.value,
        state: res.state.value,
        pincode: res.pincode.value,
      },
    };
  }

  /* =========================================================
   * Wishlist + orders
   * ======================================================= */
  async function loadWishlist() {
    var box = $("wishlistList");
    if (!box) return;
    try {
      var res = await fetch("/api/wishlist", {
        credentials: "include",
        headers: authHeaders(),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load wishlist");
      var items = data.items || [];
      if (!items.length) {
        box.innerHTML =
          '<p class="form-hint">Your wishlist is empty. Tap ♡ on any product while shopping to save it here.</p>';
        return;
      }
      box.innerHTML = items
        .map(function (row) {
          var p = row.product || {};
          var unavailable = p.status === "unavailable";
          var id = p.id || row.productSlug;
          return (
            '<article class="wish-card' +
            (unavailable ? " wish-card--unavailable" : "") +
            '">' +
            '<a class="wish-card__media" href="product.html?id=' +
            encodeURIComponent(id) +
            '"><img src="' +
            escapeHtml(p.image || "assets/products/grains.jpg") +
            '" alt="" onerror="this.onerror=null;this.src=\'assets/products/grains.jpg\'" /></a>' +
            '<div class="wish-card__body">' +
            '<h3><a href="product.html?id=' +
            encodeURIComponent(id) +
            '">' +
            escapeHtml(p.name || row.productSlug) +
            "</a></h3>" +
            '<p class="meta">' +
            inr(p.price) +
            (p.unit ? " / " + escapeHtml(p.unit) : "") +
            (unavailable ? " · Temporarily unavailable" : "") +
            "</p>" +
            '<div class="wish-card__actions">' +
            (unavailable
              ? ""
              : '<button type="button" class="btn btn--wine btn--sm" data-wish-add="' +
                escapeHtml(id) +
                '">Add to cart</button>') +
            '<button type="button" class="btn btn--ghost btn--sm" data-wish-remove="' +
            escapeHtml(id) +
            '" style="border-color:var(--wine);color:var(--wine)">Remove</button>' +
            "</div></div></article>"
          );
        })
        .join("");
    } catch (err) {
      box.innerHTML =
        '<p class="form-msg is-error">' +
        escapeHtml(err.message || "Could not load wishlist") +
        "</p>";
    }
  }

  async function loadOrders() {
    var box = $("ordersList");
    if (!box) return;
    try {
      var res = await fetch("/api/orders", {
        credentials: "include",
        headers: authHeaders(),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load orders");
      var orders = data.orders || [];
      if (!orders.length) {
        box.innerHTML = '<p class="form-hint">No orders yet. Add items to your cart and checkout after signing in.</p>';
        return;
      }
      box.innerHTML = orders
        .map(function (o) {
          var items = (o.items || [])
            .map(function (i) {
              return (
                "<li>" +
                escapeHtml(i.name) +
                " (" +
                escapeHtml(i.size || "pack") +
                ") × " +
                escapeHtml(i.qty) +
                " - " +
                inr(i.lineTotal) +
                "</li>"
              );
            })
            .join("");
          return (
            '<article class="order-card">' +
            '<div class="order-card__head">' +
            "<div><strong>" +
            escapeHtml(o.orderNumber) +
            '</strong><div class="form-hint">' +
            escapeHtml(formatDate(o.createdAt)) +
            "</div></div>" +
            '<span class="order-status">' +
            escapeHtml(o.status) +
            " · " +
            escapeHtml(o.paymentStatus) +
            "</span>" +
            "</div>" +
            '<ul class="order-items">' +
            items +
            "</ul>" +
            '<div class="order-card__total">Total ' +
            inr(o.total) +
            "</div>" +
            "</article>"
          );
        })
        .join("");
    } catch (err) {
      box.innerHTML = '<p class="form-msg is-error">' + escapeHtml(err.message || "Could not load orders") + "</p>";
    }
  }

  /* =========================================================
   * UI state
   * ======================================================= */
  function setLoggedInUI(customer) {
    state.customer = customer;
    var gate = $("authGate");
    var dash = $("accountDash");
    var navLabel = document.querySelectorAll("[data-account-label]");
    if (customer) {
      if (gate) gate.hidden = true;
      if (dash) dash.hidden = false;
      if ($("profileName")) $("profileName").value = customer.name || "";
      if ($("profileEmail")) $("profileEmail").value = customer.email || "";
      if ($("profilePhone")) $("profilePhone").value = customer.phone || "";
      var a = customer.address || {};
      if ($("addrLine1")) $("addrLine1").value = a.line1 || "";
      if ($("addrLine2")) $("addrLine2").value = a.line2 || "";
      if ($("addrCity")) $("addrCity").value = a.city || "";
      if ($("addrState")) $("addrState").value = a.state || "";
      if ($("addrPin")) $("addrPin").value = a.pincode || "";
      if ($("welcomeName")) $("welcomeName").textContent = customer.name || "there";
      navLabel.forEach(function (el) {
        el.textContent = "Account";
      });
      loadWishlist();
      loadOrders();
      if (window.location.hash === "#wishlist") {
        var wishSec = $("wishlist");
        if (wishSec) wishSec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      if (gate) gate.hidden = false;
      if (dash) dash.hidden = true;
      navLabel.forEach(function (el) {
        el.textContent = "Login";
      });
    }
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll("[data-auth-tab]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-auth-tab") === tab);
    });
    document.querySelectorAll("[data-auth-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-auth-panel") !== tab;
    });
  }

  async function refreshSession() {
    try {
      var data = await api("/me");
      setLoggedInUI(data.customer);
      return data.customer;
    } catch (e) {
      setToken("");
      setLoggedInUI(null);
      return null;
    }
  }

  /* =========================================================
   * Form handlers (validate -> submit -> map server errors)
   * ======================================================= */
  async function onRegister(e) {
    e.preventDefault();
    var form = $("registerForm");
    if (isBusy(form)) return;
    var msg = $("registerMsg");
    showMsg(msg, "");

    var name = V.name(val("regName"));
    var email = V.email(val("regEmail"), true);
    var phone = V.phone(val("regPhone"), true);
    var password = V.newPassword(val("regPassword"), { email: email.value });
    var pairs = [
      [$("regName"), name],
      [$("regEmail"), email],
      [$("regPhone"), phone],
      [$("regPassword"), password],
    ];
    // Optional extras: only validated when these fields exist in the HTML
    if ($("regConfirmPassword")) {
      pairs.push([$("regConfirmPassword"), V.confirm(val("regConfirmPassword"), val("regPassword"))]);
    }
    if ($("regTerms")) {
      pairs.push([
        $("regTerms"),
        $("regTerms").checked ? ok(true) : fail("Please accept the terms to create an account"),
      ]);
    }
    if (!applyResults(pairs)) {
      showMsg(msg, "Please fix the highlighted fields.", true);
      return;
    }

    setBusy(form, true);
    try {
      var data = await api("/register", {
        method: "POST",
        body: {
          name: name.value,
          email: email.value,
          phone: phone.value,
          password: password.value,
        },
      });
      if (data.token) setToken(data.token);
      clearFormErrors(form);
      setLoggedInUI(data.customer);
      showMsg($("dashMsg"), "Welcome! Your account is ready.", false);
      afterAuthRedirect();
    } catch (err) {
      if (err.status === 409) {
        setFieldError($("regEmail"), "An account with this email already exists. Try logging in.");
        $("regEmail").focus();
      } else {
        showMsg(msg, friendlyError(err, "Could not create account"), true);
      }
    } finally {
      setBusy(form, false);
    }
  }

  function afterAuthRedirect() {
    try {
      var next = new URLSearchParams(window.location.search).get("next");
      if (!next) return;
      if (next === "checkout") {
        window.location.href = "index.html?checkout=1#shop";
        return;
      }
      // Allow only same-site relative paths (product pages, shop, etc.)
      if (/^[a-zA-Z0-9._~\-/?&=%#]+$/.test(next) && next.indexOf("//") === -1 && next.charAt(0) !== "/") {
        window.location.href = next;
      }
    } catch (e) {}
  }

  async function onLogin(e) {
    e.preventDefault();
    var form = $("loginForm");
    if (isBusy(form)) return;
    var msg = $("loginMsg");
    showMsg(msg, "");

    var email = V.email(val("loginEmail"));
    var password = V.loginPassword(val("loginPassword"));
    if (!applyResults([[$("loginEmail"), email], [$("loginPassword"), password]])) {
      showMsg(msg, "Please fix the highlighted fields.", true);
      return;
    }

    setBusy(form, true);
    try {
      var data = await api("/login", {
        method: "POST",
        body: { email: email.value, password: password.value },
      });
      if (data.token) setToken(data.token);
      clearFormErrors(form);
      setLoggedInUI(data.customer);
      showMsg($("dashMsg"), "Signed in successfully.", false);
      afterAuthRedirect();
    } catch (err) {
      // Generic message on purpose: don't reveal whether the email exists
      var text = err.status === 401 ? "Incorrect email or password." : friendlyError(err, "Login failed");
      showMsg(msg, text, true);
    } finally {
      setBusy(form, false);
    }
  }

  async function onLogout() {
    try {
      await api("/logout", { method: "POST" });
    } catch (e) {}
    setToken("");
    setLoggedInUI(null);
    switchTab("login");
    showMsg($("loginMsg"), "You have been signed out.", false);
  }

  async function onSaveProfile(e) {
    e.preventDefault();
    var form = $("profileForm");
    if (isBusy(form)) return;
    var msg = $("profileMsg");
    showMsg(msg, "");

    var name = V.name(val("profileName"));
    var phone = V.phone(val("profilePhone"), false);
    var addr = validateAddress();
    var pairs = [[$("profileName"), name], [$("profilePhone"), phone]].concat(addr.pairs);
    if (!applyResults(pairs)) {
      showMsg(msg, "Please fix the highlighted fields.", true);
      return;
    }

    setBusy(form, true);
    try {
      var data = await api("/me", {
        method: "PUT",
        body: { name: name.value, phone: phone.value, address: addr.value },
      });
      setLoggedInUI(data.customer);
      showMsg(msg, "Profile saved.", false);
    } catch (err) {
      showMsg(msg, friendlyError(err, "Could not save profile"), true);
    } finally {
      setBusy(form, false);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    var form = $("passwordForm");
    if (isBusy(form)) return;
    var msg = $("passwordMsg");
    showMsg(msg, "");

    var current = V.currentPassword(val("currentPassword"));
    var email = state.customer ? state.customer.email : "";
    var next = V.newPassword(val("newPassword"), { email: email });
    if (!next.error && val("newPassword") === val("currentPassword")) {
      next = fail("New password must be different from your current password");
    }
    var confirm = V.confirm(val("confirmPassword"), val("newPassword"));
    if (!applyResults([[$("currentPassword"), current], [$("newPassword"), next], [$("confirmPassword"), confirm]])) {
      showMsg(msg, "Please fix the highlighted fields.", true);
      return;
    }

    setBusy(form, true);
    try {
      var data = await api("/password", {
        method: "PUT",
        body: { currentPassword: current.value, newPassword: next.value },
      });
      if (data.token) setToken(data.token);
      form.reset();
      clearFormErrors(form);
      showMsg(msg, "Password updated.", false);
    } catch (err) {
      if (/current/i.test(err.message || "")) {
        setFieldError($("currentPassword"), "Current password is incorrect");
        $("currentPassword").focus();
      } else {
        showMsg(msg, friendlyError(err, "Could not update password"), true);
      }
    } finally {
      setBusy(form, false);
    }
  }

  /* =========================================================
   * Init
   * ======================================================= */
  function initValidation() {
    injectValidationStyles();

    // Use our own messages instead of the browser's default bubbles
    ["loginForm", "registerForm", "profileForm", "passwordForm"].forEach(function (id) {
      var f = $(id);
      if (f) f.setAttribute("novalidate", "");
    });

    // Input hardening
    setAttrs("regName", { maxlength: "60", autocomplete: "name" });
    setAttrs("profileName", { maxlength: "60", autocomplete: "name" });
    setAttrs("regEmail", { maxlength: "254", autocomplete: "email", inputmode: "email", autocapitalize: "none" });
    setAttrs("loginEmail", { maxlength: "254", autocomplete: "email", inputmode: "email", autocapitalize: "none" });
    setAttrs("regPhone", { maxlength: "16", autocomplete: "tel", inputmode: "tel" });
    setAttrs("profilePhone", { maxlength: "16", autocomplete: "tel", inputmode: "tel" });
    setAttrs("regPassword", { maxlength: "64", autocomplete: "new-password" });
    setAttrs("loginPassword", { maxlength: "128", autocomplete: "current-password" });
    setAttrs("currentPassword", { maxlength: "128", autocomplete: "current-password" });
    setAttrs("newPassword", { maxlength: "64", autocomplete: "new-password" });
    setAttrs("confirmPassword", { maxlength: "64", autocomplete: "new-password" });
    setAttrs("regConfirmPassword", { maxlength: "64", autocomplete: "new-password" });
    setAttrs("addrLine1", { maxlength: "100", autocomplete: "address-line1" });
    setAttrs("addrLine2", { maxlength: "100", autocomplete: "address-line2" });
    setAttrs("addrCity", { maxlength: "50", autocomplete: "address-level2" });
    setAttrs("addrState", { maxlength: "50", autocomplete: "address-level1" });
    setAttrs("addrPin", { maxlength: "6", inputmode: "numeric", autocomplete: "postal-code" });

    // PIN code: digits only while typing
    var pin = $("addrPin");
    if (pin) {
      pin.addEventListener("input", function () {
        var digits = pin.value.replace(/\D/g, "").slice(0, 6);
        if (pin.value !== digits) pin.value = digits;
      });
    }

    // Live (inline) validation
    var optional = function (fn) {
      return function (v) {
        return v.trim() === "" ? ok("") : fn(v);
      };
    };
    bindLive("regName", V.name);
    bindLive("regEmail", function (v) {
      return V.email(v, true);
    });
    bindLive("regPhone", function (v) {
      return V.phone(v, true);
    });
    bindLive("regPassword", function (v) {
      return V.newPassword(v, { email: val("regEmail") });
    });
    bindLive("regConfirmPassword", function (v) {
      return V.confirm(v, val("regPassword"));
    });
    bindLive("loginEmail", V.email);
    bindLive("profileName", V.name);
    bindLive("profilePhone", function (v) {
      return V.phone(v, false);
    });
    bindLive("addrPin", optional(V.pincode));
    bindLive("newPassword", function (v) {
      return V.newPassword(v, { email: state.customer ? state.customer.email : "" });
    });
    bindLive("confirmPassword", function (v) {
      return V.confirm(v, val("newPassword"));
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    initValidation();

    document.querySelectorAll("[data-auth-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.getAttribute("data-auth-tab"));
      });
    });

    if ($("loginForm")) $("loginForm").addEventListener("submit", onLogin);
    if ($("registerForm")) $("registerForm").addEventListener("submit", onRegister);
    if ($("profileForm")) $("profileForm").addEventListener("submit", onSaveProfile);
    if ($("passwordForm")) $("passwordForm").addEventListener("submit", onChangePassword);
    if ($("logoutBtn")) $("logoutBtn").addEventListener("click", onLogout);

    if ($("wishlistList")) {
      $("wishlistList").addEventListener("click", async function (e) {
        var removeBtn = e.target.closest("[data-wish-remove]");
        if (removeBtn) {
          var slug = removeBtn.getAttribute("data-wish-remove");
          try {
            var delRes = await fetch("/api/wishlist/" + encodeURIComponent(slug), {
              method: "DELETE",
              credentials: "include",
              headers: authHeaders(),
            });
            if (!delRes.ok) throw new Error("Could not remove item from wishlist");
            await loadWishlist();
            if (window.NastroWishlist) window.NastroWishlist.refresh();
          } catch (err) {
            showMsg($("dashMsg"), err.message || "Could not remove", true);
          }
          return;
        }
        var addBtn = e.target.closest("[data-wish-add]");
        if (addBtn) {
          var id = addBtn.getAttribute("data-wish-add");
          if (window.Nastro && Nastro.loadCatalogFromApi) {
            await Nastro.loadCatalogFromApi();
          }
          if (window.Nastro && Nastro.addToCart) {
            Nastro.addToCart(id, 0, 1);
            showMsg($("dashMsg"), "Added to cart.", false);
          } else {
            window.location.href = "product.html?id=" + encodeURIComponent(id);
          }
        }
      });
    }

    var params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "register") switchTab("register");
    else switchTab("login");

    await refreshSession();

    var toggle = $("navToggle");
    var links = $("navLinks");
    if (toggle && links) {
      toggle.addEventListener("click", function () {
        links.classList.toggle("open");
      });
    }
  });
})();