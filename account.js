(function () {
  var API = "/api/customer";
  var TOKEN_KEY = "nb-customer-token";
  var state = {
    customer: null,
    tab: "login",
    loginOtpEmail: ""
  };

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
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {}
  }

  function authHeaders() {
    var h = {
      "Content-Type": "application/json"
    };

    var t = getToken();

    if (t) {
      h.Authorization = "Bearer " + t;
    }

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
        body: opts.body
          ? JSON.stringify(opts.body)
          : undefined
      });
    } catch (e) {
      var netErr = new Error(
        "Network error. Please check your connection and try again."
      );

      netErr.status = 0;

      throw netErr;
    }

    var data = {};

    try {
      data = await res.json();
    } catch (e) {}

    if (!res.ok) {
      var err = new Error(
        data.error || "Request failed"
      );

      err.status = res.status;

      throw err;
    }

    return data;
  }

  function showMsg(el, text, isError) {
    if (!el) return;

    el.textContent = text || "";

    el.classList.toggle(
      "is-error",
      !!isError
    );

    el.classList.toggle(
      "is-ok",
      !isError && !!text
    );

    el.hidden = !text;
  }

  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString(
        "en-IN",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      );
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
   * ======================================================= */

  function ok(v) {
    return {
      value: v,
      error: ""
    };
  }

  function fail(msg) {
    return {
      value: "",
      error: msg
    };
  }

  function clean(raw) {
    return String(
      raw == null ? "" : raw
    )
      .trim()
      .replace(/\s+/g, " ");
  }

  var EMAIL_RE =
    /^[a-z0-9._%+\-]+@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/;

  var NAME_RE =
    /^[\p{L}][\p{L}\p{M}\s.'\-]*$/u;

  var PLACE_RE =
    /^[\p{L}][\p{L}\p{M}\s.'\-&]*$/u;

  var ADDRESS_RE =
    /^[\p{L}\p{N}\p{M}\s,.\/#\-()'&]+$/u;

  var V = {
    name: function (raw) {
      var v = clean(raw);

      if (!v) {
        return fail("Full name is required");
      }

      if (!/^\p{L}/u.test(v)) {
        return fail(
          "Name must start with a letter (no numbers or special characters)"
        );
      }

      if (v.length < 3) {
        return fail(
          "Name must be at least 3 characters"
        );
      }

      if (v.length > 60) {
        return fail(
          "Name must be 60 characters or fewer"
        );
      }

      if (!NAME_RE.test(v)) {
        return fail(
          "Name can contain only letters, spaces, . ' and -"
        );
      }

      return ok(v);
    },

    email: function (raw, requireGmail) {
      var v = String(
        raw == null ? "" : raw
      )
        .trim()
        .toLowerCase();

      if (!v) {
        return fail("Email is required");
      }

      if (v.length > 254) {
        return fail("Email is too long");
      }

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

      if (
        requireGmail &&
        v.slice(-10) !== "@gmail.com"
      ) {
        return fail(
          "Only @gmail.com email addresses are allowed"
        );
      }

      return ok(v);
    },

    phone: function (raw, required) {
      var digits = String(
        raw == null ? "" : raw
      ).replace(/[\s\-()]/g, "");

      if (!digits) {
        return required
          ? fail("Mobile number is required")
          : ok("");
      }

      digits = digits.replace(
        /^(\+91|91|0)(?=\d{10}$)/,
        ""
      );

      if (
        !/^[6-9]\d{9}$/.test(digits) ||
        /^(\d)\1{9}$/.test(digits)
      ) {
        return fail(
          "Enter a valid 10-digit Indian mobile number"
        );
      }

      return ok(digits);
    },

    addrLine1: function (raw) {
      var v = clean(raw);

      if (!v) {
        return fail(
          "Address line 1 is required"
        );
      }

      if (v.length < 5) {
        return fail("Address is too short");
      }

      if (v.length > 100) {
        return fail(
          "Address must be 100 characters or fewer"
        );
      }

      if (!ADDRESS_RE.test(v)) {
        return fail(
          "Address contains unsupported characters"
        );
      }

      return ok(v);
    },

    addrLine2: function (raw) {
      var v = clean(raw);

      if (!v) {
        return ok("");
      }

      if (v.length > 100) {
        return fail(
          "Address must be 100 characters or fewer"
        );
      }

      if (!ADDRESS_RE.test(v)) {
        return fail(
          "Address contains unsupported characters"
        );
      }

      return ok(v);
    },

    city: function (raw) {
      var v = clean(raw);

      if (!v) {
        return fail("City is required");
      }

      if (v.length < 2) {
        return fail("City name is too short");
      }

      if (v.length > 50) {
        return fail(
          "City must be 50 characters or fewer"
        );
      }

      if (!PLACE_RE.test(v)) {
        return fail(
          "City can contain only letters and spaces"
        );
      }

      return ok(v);
    },

    state: function (raw) {
      var v = clean(raw);

      if (!v) {
        return fail("State is required");
      }

      if (v.length < 2) {
        return fail(
          "State name is too short"
        );
      }

      if (v.length > 50) {
        return fail(
          "State must be 50 characters or fewer"
        );
      }

      if (!PLACE_RE.test(v)) {
        return fail(
          "State can contain only letters and spaces"
        );
      }

      return ok(v);
    },

    pincode: function (raw) {
      var v = String(
        raw == null ? "" : raw
      ).replace(/\s/g, "");

      if (!v) {
        return fail("PIN code is required");
      }

      if (!/^[1-9]\d{5}$/.test(v)) {
        return fail(
          "Enter a valid 6-digit PIN code"
        );
      }

      if (
        ["500", "501", "502"].indexOf(
          v.slice(0, 3)
        ) === -1
      ) {
        return fail(
          "We don’t deliver to this PIN code yet"
        );
      }

      return ok(v);
    }
  };

  /* =========================================================
   * Inline error UI
   * ======================================================= */

  function injectValidationStyles() {
    if (
      document.getElementById(
        "nb-validation-styles"
      )
    ) {
      return;
    }

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

    var el = document.getElementById(
      errId
    );

    if (message) {
      if (!el) {
        el = document.createElement(
          "small"
        );

        el.id = errId;
        el.className = "field-error";
        el.setAttribute(
          "role",
          "alert"
        );

        input.insertAdjacentElement(
          "afterend",
          el
        );
      }

      el.textContent = message;

      input.classList.add(
        "is-invalid"
      );

      input.setAttribute(
        "aria-invalid",
        "true"
      );

      input.setAttribute(
        "aria-describedby",
        errId
      );
    } else {
      if (el) {
        el.remove();
      }

      input.classList.remove(
        "is-invalid"
      );

      input.removeAttribute(
        "aria-invalid"
      );

      input.removeAttribute(
        "aria-describedby"
      );
    }
  }

  function clearFormErrors(form) {
    if (!form) return;

    form
      .querySelectorAll(".is-invalid")
      .forEach(function (el) {
        setFieldError(el, "");
      });
  }

  function applyResults(pairs) {
    var first = null;

    pairs.forEach(function (p) {
      if (!p[0]) return;

      setFieldError(
        p[0],
        p[1].error
      );

      if (
        p[1].error &&
        !first
      ) {
        first = p[0];
      }
    });

    if (first) {
      first.focus();
    }

    return !first;
  }

  function bindLive(id, validate) {
    var el = $(id);

    if (!el) return;

    el.addEventListener(
      "input",
      function () {
        el.dataset.touched = "1";

        if (
          el.classList.contains(
            "is-invalid"
          )
        ) {
          setFieldError(
            el,
            validate(el.value).error
          );
        }
      }
    );

    el.addEventListener(
      "blur",
      function () {
        if (
          el.dataset.touched ||
          el.value !== ""
        ) {
          setFieldError(
            el,
            validate(el.value).error
          );
        }
      }
    );
  }

  function setAttrs(id, attrs) {
    var el = $(id);

    if (!el) return;

    Object.keys(attrs).forEach(
      function (k) {
        el.setAttribute(
          k,
          attrs[k]
        );
      }
    );
  }

  function isBusy(form) {
    var btn =
      form &&
      form.querySelector(
        '[type="submit"]'
      );

    return !!(
      btn &&
      btn.disabled
    );
  }

  function setBusy(form, busy) {
    var btn =
      form &&
      form.querySelector(
        '[type="submit"]'
      );

    if (!btn) return;

    if (busy) {
      btn.dataset.label =
        btn.textContent;

      btn.textContent =
        "Please wait…";

      btn.disabled = true;
    } else {
      btn.textContent =
        btn.dataset.label ||
        btn.textContent;

      btn.disabled = false;
    }
  }

  function friendlyError(
    err,
    fallback
  ) {
    if (err.status === 0) {
      return err.message;
    }

    if (err.status === 429) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }

    if (err.status >= 500) {
      return "Something went wrong on our side. Please try again shortly.";
    }

    return (
      err.message ||
      fallback
    );
  }

  /* =========================================================
   * Address validation
   * ======================================================= */

  function validateAddress() {
    var ids = {
      line1: "addrLine1",
      line2: "addrLine2",
      city: "addrCity",
      state: "addrState",
      pincode: "addrPin"
    };

    var anyFilled =
      Object.keys(ids).some(
        function (k) {
          return (
            val(ids[k]).trim() !== ""
          );
        }
      );

    var res;

    if (!anyFilled) {
      res = {
        line1: ok(""),
        line2: ok(""),
        city: ok(""),
        state: ok(""),
        pincode: ok("")
      };
    } else {
      res = {
        line1: V.addrLine1(
          val(ids.line1)
        ),
        line2: V.addrLine2(
          val(ids.line2)
        ),
        city: V.city(
          val(ids.city)
        ),
        state: V.state(
          val(ids.state)
        ),
        pincode: V.pincode(
          val(ids.pincode)
        )
      };
    }

    var pairs =
      Object.keys(ids).map(
        function (k) {
          return [
            $(ids[k]),
            res[k]
          ];
        }
      );

    return {
      pairs: pairs,

      value: {
        line1:
          res.line1.value,
        line2:
          res.line2.value,
        city:
          res.city.value,
        state:
          res.state.value,
        pincode:
          res.pincode.value
      }
    };
  }

  /* =========================================================
   * Wishlist
   * ======================================================= */

  async function loadWishlist() {
    var box = $(
      "wishlistList"
    );

    if (!box) return;

    try {
      var res = await fetch(
        "/api/wishlist",
        {
          credentials: "include",
          headers: authHeaders()
        }
      );

      var data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Could not load wishlist"
        );
      }

      var items =
        data.items || [];

      if (!items.length) {
        box.innerHTML =
          '<p class="form-hint">Your wishlist is empty. Tap ♡ on any product while shopping to save it here.</p>';

        return;
      }

      box.innerHTML = items
        .map(function (row) {
          var p =
            row.product || {};

          var unavailable =
            p.status ===
            "unavailable";

          var id =
            p.id ||
            row.productSlug;

          return (
            '<article class="wish-card' +
            (
              unavailable
                ? " wish-card--unavailable"
                : ""
            ) +
            '">' +

            '<a class="wish-card__media" href="product.html?id=' +
            encodeURIComponent(id) +
            '">' +

            '<img src="' +
            escapeHtml(
              p.image ||
              "assets/products/grains.jpg"
            ) +
            '" alt="" onerror="this.onerror=null;this.src=\'assets/products/grains.jpg\'" />' +

            "</a>" +

            '<div class="wish-card__body">' +

            '<h3><a href="product.html?id=' +
            encodeURIComponent(id) +
            '">' +

            escapeHtml(
              p.name ||
              row.productSlug
            ) +

            "</a></h3>" +

            '<p class="meta">' +
            inr(p.price) +

            (
              p.unit
                ? " / " +
                  escapeHtml(
                    p.unit
                  )
                : ""
            ) +

            (
              unavailable
                ? " · Temporarily unavailable"
                : ""
            ) +

            "</p>" +

            '<div class="wish-card__actions">' +

            (
              unavailable
                ? ""
                : '<button type="button" class="btn btn--wine btn--sm" data-wish-add="' +
                  escapeHtml(id) +
                  '">Add to cart</button>'
            ) +

            '<button type="button" class="btn btn--ghost btn--sm" data-wish-remove="' +
            escapeHtml(id) +
            '" style="border-color:var(--wine);color:var(--wine)">Remove</button>' +

            "</div>" +

            "</div>" +

            "</article>"
          );
        })
        .join("");

    } catch (err) {
      box.innerHTML =
        '<p class="form-msg is-error">' +
        escapeHtml(
          err.message ||
          "Could not load wishlist"
        ) +
        "</p>";
    }
  }

  /* =========================================================
   * Orders
   * ======================================================= */

  async function loadOrders() {
    var box = $(
      "ordersList"
    );

    if (!box) return;

    try {
      var res =
        await fetch(
          "/api/orders",
          {
            credentials:
              "include",
            headers:
              authHeaders()
          }
        );

      var data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Could not load orders"
        );
      }

      var orders =
        data.orders || [];

      if (!orders.length) {
        box.innerHTML =
          '<p class="form-hint">No orders yet. Add items to your cart and checkout after signing in.</p>';

        return;
      }

      box.innerHTML = orders
        .map(function (o) {
          var items =
            (o.items || [])
              .map(function (i) {
                return (
                  "<li>" +
                  escapeHtml(
                    i.name
                  ) +
                  " (" +
                  escapeHtml(
                    i.size ||
                    "pack"
                  ) +
                  ") × " +
                  escapeHtml(
                    i.qty
                  ) +
                  " - " +
                  inr(
                    i.lineTotal
                  ) +
                  "</li>"
                );
              })
              .join("");

          return (
            '<article class="order-card">' +

            '<div class="order-card__head">' +

            "<div><strong>" +
            escapeHtml(
              o.orderNumber
            ) +

            '</strong><div class="form-hint">' +
            escapeHtml(
              formatDate(
                o.createdAt
              )
            ) +
            "</div></div>" +

            '<span class="order-status">' +
            escapeHtml(
              o.status === "pending"
                ? "Waiting"
                : o.status === "confirmed"
                  ? "Confirmed"
                  : o.status || "Waiting"
            ) +
            "</span>" +

            "</div>" +

            '<ul class="order-items">' +
            items +
            "</ul>" +

            '<div class="order-card__total">Total ' +
            inr(o.total) +
            "</div>" +
            '<p class="form-hint" style="margin:.6rem 0 0"><a href="order-confirmation.html?order=' +
            encodeURIComponent(o.orderNumber || "") +
            '">View status</a></p>' +

            "</article>"
          );
        })
        .join("");

    } catch (err) {
      box.innerHTML =
        '<p class="form-msg is-error">' +
        escapeHtml(
          err.message ||
          "Could not load orders"
        ) +
        "</p>";
    }
  }

  /* =========================================================
   * UI state
   * ======================================================= */

  function setLoggedInUI(
    customer
  ) {
    state.customer =
      customer;

    var gate =
      $("authGate");

    var dash =
      $("accountDash");

    var navLabel =
      document.querySelectorAll(
        "[data-account-label]"
      );

    if (customer) {
      if (gate) {
        gate.hidden = true;
      }

      if (dash) {
        dash.hidden = false;
      }

      if ($("profileName")) {
        $("profileName").value =
          customer.name || "";
      }

      if ($("profileEmail")) {
        $("profileEmail").value =
          customer.email || "";
      }

      if ($("profilePhone")) {
        $("profilePhone").value =
          customer.phone || "";
      }

      var a =
        customer.address || {};

      if ($("addrLine1")) {
        $("addrLine1").value =
          a.line1 || "";
      }

      if ($("addrLine2")) {
        $("addrLine2").value =
          a.line2 || "";
      }

      if ($("addrCity")) {
        $("addrCity").value =
          a.city || "";
      }

      if ($("addrState")) {
        $("addrState").value =
          a.state || "";
      }

      if ($("addrPin")) {
        $("addrPin").value =
          a.pincode || "";
      }

      if ($("welcomeName")) {
        $("welcomeName").textContent =
          customer.name ||
          "there";
      }

      navLabel.forEach(
        function (el) {
          el.textContent =
            "Account";
        }
      );

      loadWishlist();
      loadOrders();

      if (
        window.location.hash ===
        "#wishlist"
      ) {
        var wishSec =
          $("wishlist");

        if (wishSec) {
          wishSec.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }

    } else {
      if (gate) {
        gate.hidden = false;
      }

      if (dash) {
        dash.hidden = true;
      }

      navLabel.forEach(
        function (el) {
          el.textContent =
            "Login";
        }
      );
    }
  }

  /*
   * Normal login/register tabs.
   *
   * IMPORTANT:
   * login-otp is NOT one of these normal tabs.
   * It is controlled separately by showLoginOtpPanel()
   * after a code has been emailed.
   */
  function switchTab(tab) {
    state.tab = tab;

    document
      .querySelectorAll(
        "[data-auth-tab]"
      )
      .forEach(
        function (btn) {
          btn.classList.toggle(
            "active",
            btn.getAttribute(
              "data-auth-tab"
            ) === tab
          );
        }
      );

    document
      .querySelectorAll(
        "[data-auth-panel]"
      )
      .forEach(
        function (panel) {
          panel.hidden =
            panel.getAttribute(
              "data-auth-panel"
            ) !== tab;
        }
      );
  }

  async function refreshSession() {
    try {
      var data =
        await api("/me");

      setLoggedInUI(
        data.customer
      );

      return data.customer;

    } catch (e) {
      setToken("");

      setLoggedInUI(null);

      return null;
    }
  }

  /* =========================================================
   * Register
   * ======================================================= */

  async function onRegister(e) {
    e.preventDefault();

    var form =
      $("registerForm");

    if (isBusy(form)) {
      return;
    }

    var msg =
      $("registerMsg");

    showMsg(msg, "");

    var name =
      V.name(
        val("regName")
      );

    var email =
      V.email(
        val("regEmail"),
        true
      );

    var phone =
      V.phone(
        val("regPhone"),
        true
      );

    var pairs = [
      [
        $("regName"),
        name
      ],
      [
        $("regEmail"),
        email
      ],
      [
        $("regPhone"),
        phone
      ]
    ];

    if ($("regTerms")) {
      pairs.push([
        $("regTerms"),
        $("regTerms").checked
          ? ok(true)
          : fail(
              "Please accept the terms to create an account"
            )
      ]);
    }

    if (!applyResults(pairs)) {
      showMsg(
        msg,
        "Please fix the highlighted fields.",
        true
      );

      return;
    }

    setBusy(
      form,
      true
    );

    try {
      var data =
        await api(
          "/register",
          {
            method: "POST",
            body: {
              name:
                name.value,
              email:
                email.value,
              phone:
                phone.value
            }
          }
        );

      /*
       * No token here. The account is signed in only
       * after the emailed code is verified.
       */
      if (!data.otpRequired) {
        throw new Error(
          "Email verification is required to finish creating your account."
        );
      }

      state.loginOtpEmail =
        data.email ||
        email.value;

      clearFormErrors(
        form
      );

      form.hidden = true;

      showLoginOtpPanel(
        state.loginOtpEmail
      );

      showLoginOtpMessage(
        data.message ||
          "A 6-digit verification code has been sent to your email.",
        false
      );

    } catch (err) {
      if (err.status === 409) {
        setFieldError(
          $("regEmail"),
          "An account with this email already exists. Try logging in."
        );

        $("regEmail").focus();

      } else {
        showMsg(
          msg,
          friendlyError(
            err,
            "Could not create account"
          ),
          true
        );
      }

    } finally {
      setBusy(
        form,
        false
      );
    }
  }

  /* =========================================================
   * Redirect after successful authentication
   * ======================================================= */

  function afterAuthRedirect() {
    try {
      var next =
        new URLSearchParams(
          window.location.search
        ).get("next");

      if (!next) {
        return;
      }

      if (next === "checkout") {
        window.location.href =
          "index.html?checkout=1#categories";

        return;
      }

      if (
        /^[a-zA-Z0-9._~\-/?&=%#]+$/.test(
          next
        ) &&
        next.indexOf("//") === -1 &&
        next.charAt(0) !== "/"
      ) {
        window.location.href =
          next;
      }

    } catch (e) {}
  }

  /* =========================================================
   * LOGIN - STEP 1
   *
   * Email is submitted; a code is emailed.
   * NO JWT is stored here.
   * OTP is sent by backend.
   * ======================================================= */

  async function onLogin(e) {
    /*
     * THIS IS CRITICAL.
     *
     * Prevent the browser from submitting the form normally.
     * Without this, the page refreshes before the OTP screen
     * can be displayed.
     */
    e.preventDefault();

    var form =
      $("loginForm");

    if (isBusy(form)) {
      return;
    }

    var msg =
      $("loginMsg");

    showMsg(msg, "");

    var email =
      V.email(
        val("loginEmail")
      );

    if (
      !applyResults([
        [
          $("loginEmail"),
          email
        ]
      ])
    ) {
      showMsg(
        msg,
        "Please fix the highlighted fields.",
        true
      );

      return;
    }

    setBusy(
      form,
      true
    );

    try {
      /*
       * Step 1:
       * Request an emailed code (no password).
       *
       * Backend MUST NOT return a JWT here.
       */
      var data =
        await api(
          "/login",
          {
            method: "POST",
            body: {
              email:
                email.value
            }
          }
        );

      /*
       * We expect the backend to tell us that
       * OTP verification is required.
       */
      if (!data.otpRequired) {
        throw new Error(
          "Email verification is required before signing in."
        );
      }

      /*
       * Store ONLY the email while waiting
       * for the OTP.
       *
       * DO NOT store a token here.
       */
      state.loginOtpEmail =
        data.email ||
        email.value;

      clearFormErrors(
        form
      );

      /*
       * Hide login form and show OTP form.
       */
      showLoginOtpPanel(
        state.loginOtpEmail
      );

      showLoginOtpMessage(
        data.message ||
          "A 6-digit verification code has been sent to your email.",
        false
      );

    } catch (err) {
      var text =
        friendlyError(
          err,
          "Could not send the code"
        );

      showMsg(
        msg,
        text,
        true
      );

    } finally {
      setBusy(
        form,
        false
      );
    }
  }

  /* =========================================================
   * SHOW OTP PANEL
   * ======================================================= */

  function showLoginOtpPanel(
    email
  ) {
    var loginForm =
      $("loginForm");

    var otpPanel =
      $("loginOtpPanel");

    var emailEl =
      $("loginOtpEmail");

    var otpInput =
      $("loginOtp");

    /*
     * Login form disappears.
     */
    if (loginForm) {
      loginForm.hidden =
        true;
    }

    /*
     * OTP panel appears ONLY now.
     */
    if (otpPanel) {
      otpPanel.hidden =
        false;
    }

    if (emailEl) {
      emailEl.textContent =
        email || "";
    }

    if (otpInput) {
      otpInput.value =
        "";

      setTimeout(
        function () {
          otpInput.focus();
        },
        50
      );
    }
  }

  /* =========================================================
   * HIDE OTP PANEL
   * ======================================================= */

  function hideLoginOtpPanel() {
    var loginForm =
      $("loginForm");

    var otpPanel =
      $("loginOtpPanel");

    if (loginForm) {
      loginForm.hidden =
        false;
    }

    if (otpPanel) {
      otpPanel.hidden =
        true;
    }
  }

  function showLoginOtpMessage(
    message,
    isError
  ) {
    showMsg(
      $("loginOtpMsg"),
      message || "",
      !!isError
    );
  }

  /* =========================================================
   * LOGIN - STEP 2
   *
   * Verify OTP.
   * JWT is issued only here.
   * ======================================================= */

  async function verifyLoginOtp() {
    var otpInput =
      $("loginOtp");

    var button =
      $("verifyLoginOtpBtn");

    var otp =
      String(
        otpInput
          ? otpInput.value
          : ""
      ).trim();

    if (!/^\d{6}$/.test(otp)) {
      showLoginOtpMessage(
        "Please enter the 6-digit verification code.",
        true
      );

      if (otpInput) {
        otpInput.focus();
      }

      return;
    }

    if (!state.loginOtpEmail) {
      showLoginOtpMessage(
        "Please return to login and try again.",
        true
      );

      return;
    }

    if (button) {
      button.disabled =
        true;

      button.dataset.label =
        button.textContent;

      button.textContent =
        "Verifying…";
    }

    try {
      /*
       * Step 2:
       * Verify OTP with backend.
       */
      var data =
        await api(
          "/login/verify-otp",
          {
            method: "POST",
            body: {
              email:
                state.loginOtpEmail,
              otp:
                otp
            }
          }
        );

      /*
       * JWT is stored ONLY after OTP verification.
       */
      if (data.token) {
        setToken(
          data.token
        );
      }

      state.loginOtpEmail =
        "";

      showLoginOtpMessage(
        ""
      );

      setLoggedInUI(
        data.customer
      );

      showMsg(
        $("dashMsg"),
        "Signed in successfully.",
        false
      );

      afterAuthRedirect();

    } catch (err) {
      showLoginOtpMessage(
        err.status === 429
          ? "Too many incorrect attempts. Please request a new code."
          : (
              err.message ||
              "Invalid verification code."
            ),
        true
      );

    } finally {
      if (button) {
        button.textContent =
          button.dataset.label ||
          "Verify and sign in";

        button.disabled =
          false;
      }
    }
  }

  /* =========================================================
   * RESEND OTP
   * ======================================================= */

  async function resendLoginOtp() {
    var button =
      $("resendLoginOtpBtn");

    if (!state.loginOtpEmail) {
      showLoginOtpMessage(
        "Please return to login and try again.",
        true
      );

      return;
    }

    if (button) {
      button.disabled =
        true;

      button.dataset.label =
        button.textContent;

      button.textContent =
        "Sending…";
    }

    try {
      var data =
        await api(
          "/login/resend-otp",
          {
            method: "POST",
            body: {
              email:
                state.loginOtpEmail
            }
          }
        );

      showLoginOtpMessage(
        data.message ||
          "A new verification code has been sent to your email.",
        false
      );

    } catch (err) {
      showLoginOtpMessage(
        err.message ||
          "Unable to resend verification code.",
        true
      );

    } finally {
      if (button) {
        button.textContent =
          button.dataset.label ||
          "Resend code";

        button.disabled =
          false;
      }
    }
  }

  /* =========================================================
   * BACK TO LOGIN
   * ======================================================= */

  function backToLogin() {
    state.loginOtpEmail =
      "";

    showLoginOtpMessage(
      ""
    );

    hideLoginOtpPanel();

    var otpInput =
      $("loginOtp");

    if (otpInput) {
      otpInput.value =
        "";
    }

    /*
     * Make sure normal login tab is restored.
     */
    switchTab("login");
  }

  /* =========================================================
   * LOGOUT
   * ======================================================= */

  async function onLogout() {
    try {
      await api(
        "/logout",
        {
          method: "POST"
        }
      );
    } catch (e) {}

    setToken("");

    setLoggedInUI(
      null
    );

    switchTab(
      "login"
    );

    hideLoginOtpPanel();

    showMsg(
      $("loginMsg"),
      "You have been signed out.",
      false
    );
  }

  /* =========================================================
   * SAVE PROFILE
   * ======================================================= */

  async function onSaveProfile(e) {
    e.preventDefault();

    var form =
      $("profileForm");

    if (isBusy(form)) {
      return;
    }

    var msg =
      $("profileMsg");

    showMsg(
      msg,
      ""
    );

    var name =
      V.name(
        val("profileName")
      );

    var phone =
      V.phone(
        val("profilePhone"),
        false
      );

    var addr =
      validateAddress();

    var pairs = [
      [
        $("profileName"),
        name
      ],
      [
        $("profilePhone"),
        phone
      ]
    ].concat(
      addr.pairs
    );

    if (!applyResults(pairs)) {
      showMsg(
        msg,
        "Please fix the highlighted fields.",
        true
      );

      return;
    }

    setBusy(
      form,
      true
    );

    try {
      var data =
        await api(
          "/me",
          {
            method: "PUT",
            body: {
              name:
                name.value,
              phone:
                phone.value,
              address:
                addr.value
            }
          }
        );

      setLoggedInUI(
        data.customer
      );

      showMsg(
        msg,
        "Profile saved.",
        false
      );

    } catch (err) {
      showMsg(
        msg,
        friendlyError(
          err,
          "Could not save profile"
        ),
        true
      );

    } finally {
      setBusy(
        form,
        false
      );
    }
  }

  /* =========================================================
   * VALIDATION INIT
   * ======================================================= */

  function initValidation() {
    injectValidationStyles();

    [
      "loginForm",
      "registerForm",
      "profileForm"
    ].forEach(
      function (id) {
        var f = $(id);

        if (f) {
          f.setAttribute(
            "novalidate",
            ""
          );
        }
      }
    );

    /* Input hardening */

    setAttrs(
      "regName",
      {
        maxlength: "60",
        autocomplete: "name"
      }
    );

    setAttrs(
      "profileName",
      {
        maxlength: "60",
        autocomplete: "name"
      }
    );

    setAttrs(
      "regEmail",
      {
        maxlength: "254",
        autocomplete: "email",
        inputmode: "email",
        autocapitalize: "none"
      }
    );

    setAttrs(
      "loginEmail",
      {
        maxlength: "254",
        autocomplete: "email",
        inputmode: "email",
        autocapitalize: "none"
      }
    );

    setAttrs(
      "regPhone",
      {
        maxlength: "16",
        autocomplete: "tel",
        inputmode: "tel"
      }
    );

    setAttrs(
      "profilePhone",
      {
        maxlength: "16",
        autocomplete: "tel",
        inputmode: "tel"
      }
    );

    setAttrs(
      "loginOtp",
      {
        maxlength: "6",
        inputmode: "numeric",
        autocomplete: "one-time-code"
      }
    );

    setAttrs(
      "addrLine1",
      {
        maxlength: "100",
        autocomplete: "address-line1"
      }
    );

    setAttrs(
      "addrLine2",
      {
        maxlength: "100",
        autocomplete: "address-line2"
      }
    );

    setAttrs(
      "addrCity",
      {
        maxlength: "50",
        autocomplete: "address-level2"
      }
    );

    setAttrs(
      "addrState",
      {
        maxlength: "50",
        autocomplete: "address-level1"
      }
    );

    setAttrs(
      "addrPin",
      {
        maxlength: "6",
        inputmode: "numeric",
        autocomplete: "postal-code"
      }
    );

    /* OTP digits only */

    var loginOtp =
      $("loginOtp");

    if (loginOtp) {
      loginOtp.addEventListener(
        "input",
        function () {
          var digits =
            loginOtp.value
              .replace(/\D/g, "")
              .slice(0, 6);

          if (
            loginOtp.value !==
            digits
          ) {
            loginOtp.value =
              digits;
          }
        }
      );
    }

    /* PIN digits only */

    var pin =
      $("addrPin");

    if (pin) {
      pin.addEventListener(
        "input",
        function () {
          var digits =
            pin.value
              .replace(/\D/g, "")
              .slice(0, 6);

          if (
            pin.value !==
            digits
          ) {
            pin.value =
              digits;
          }
        }
      );
    }

    /* Live validation */

    var optional =
      function (fn) {
        return function (v) {
          return v.trim() === ""
            ? ok("")
            : fn(v);
        };
      };

    bindLive(
      "regName",
      V.name
    );

    bindLive(
      "regEmail",
      function (v) {
        return V.email(
          v,
          true
        );
      }
    );

    bindLive(
      "regPhone",
      function (v) {
        return V.phone(
          v,
          true
        );
      }
    );

    bindLive(
      "loginEmail",
      V.email
    );

    bindLive(
      "profileName",
      V.name
    );

    bindLive(
      "profilePhone",
      function (v) {
        return V.phone(
          v,
          false
        );
      }
    );

    bindLive(
      "addrPin",
      optional(
        V.pincode
      )
    );

  }

  /* =========================================================
   * DOM READY
   * ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    async function () {

      /*
       * Initialize validation first.
       */
      initValidation();

      /*
       * Login / Register tabs.
       */
      document
        .querySelectorAll(
          "[data-auth-tab]"
        )
        .forEach(
          function (btn) {
            btn.addEventListener(
              "click",
              function () {
                /*
                 * If user clicks either normal tab,
                 * make sure OTP state is cleared.
                 */
                state.loginOtpEmail =
                  "";

                hideLoginOtpPanel();

                switchTab(
                  btn.getAttribute(
                    "data-auth-tab"
                  )
                );
              }
            );
          }
        );

      /*
       * CRITICAL:
       * Attach login submit handler.
       *
       * This prevents page refresh.
       */
      if ($("loginForm")) {
        $("loginForm")
          .addEventListener(
            "submit",
            onLogin
          );
      }

      /*
       * OTP buttons.
       */
      if ($("verifyLoginOtpBtn")) {
        $("verifyLoginOtpBtn")
          .addEventListener(
            "click",
            verifyLoginOtp
          );
      }

      if ($("resendLoginOtpBtn")) {
        $("resendLoginOtpBtn")
          .addEventListener(
            "click",
            resendLoginOtp
          );
      }

      if ($("backToLoginBtn")) {
        $("backToLoginBtn")
          .addEventListener(
            "click",
            backToLogin
          );
      }

      /*
       * Registration.
       */
      if ($("registerForm")) {
        $("registerForm")
          .addEventListener(
            "submit",
            onRegister
          );
      }

      /*
       * Profile.
       */
      if ($("profileForm")) {
        $("profileForm")
          .addEventListener(
            "submit",
            onSaveProfile
          );
      }

      /*
       * Logout.
       */
      if ($("logoutBtn")) {
        $("logoutBtn")
          .addEventListener(
            "click",
            onLogout
          );
      }

      /* =====================================================
       * Wishlist event delegation
       * =================================================== */

      if ($("wishlistList")) {
        $("wishlistList")
          .addEventListener(
            "click",
            async function (e) {

              var removeBtn =
                e.target.closest(
                  "[data-wish-remove]"
                );

              if (removeBtn) {
                var slug =
                  removeBtn.getAttribute(
                    "data-wish-remove"
                  );

                try {
                  var delRes =
                    await fetch(
                      "/api/wishlist/" +
                      encodeURIComponent(
                        slug
                      ),
                      {
                        method:
                          "DELETE",
                        credentials:
                          "include",
                        headers:
                          authHeaders()
                      }
                    );

                  if (!delRes.ok) {
                    throw new Error(
                      "Could not remove item from wishlist"
                    );
                  }

                  await loadWishlist();

                  if (
                    window.NastroWishlist
                  ) {
                    window.NastroWishlist.refresh();
                  }

                } catch (err) {
                  showMsg(
                    $("dashMsg"),
                    err.message ||
                      "Could not remove",
                    true
                  );
                }

                return;
              }

              var addBtn =
                e.target.closest(
                  "[data-wish-add]"
                );

              if (addBtn) {
                var id =
                  addBtn.getAttribute(
                    "data-wish-add"
                  );

                if (
                  window.Nastro &&
                  Nastro.loadCatalogFromApi
                ) {
                  await Nastro.loadCatalogFromApi();
                }

                if (
                  window.Nastro &&
                  Nastro.addToCart
                ) {
                  Nastro.addToCart(
                    id,
                    0,
                    1
                  );

                  showMsg(
                    $("dashMsg"),
                    "Added to cart.",
                    false
                  );

                } else {
                  window.location.href =
                    "product.html?id=" +
                    encodeURIComponent(
                      id
                    );
                }
              }
            }
          );
      }

      /* =====================================================
       * Initial tab state
       * =================================================== */

      var params =
        new URLSearchParams(
          window.location.search
        );

      if (
        params.get("tab") ===
        "register"
      ) {
        /*
         * Show register only when explicitly requested.
         */
        switchTab(
          "register"
        );

      } else {
        /*
         * Normal initial state:
         *
         * Login visible
         * OTP hidden
         * Register hidden
         */
        switchTab(
          "login"
        );

        hideLoginOtpPanel();
      }

      /*
       * Check whether an already-authenticated
       * customer exists.
       */
      await refreshSession();

      /* =====================================================
       * Mobile navigation
       * =================================================== */

      var toggle =
        $("navToggle");

      var links =
        $("navLinks");

      if (
        toggle &&
        links
      ) {
        toggle.addEventListener(
          "click",
          function () {
            links.classList.toggle(
              "open"
            );
          }
        );
      }
    }
  );
})();