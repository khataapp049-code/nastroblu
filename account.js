(function () {
  var API = "/api/customer";
  var TOKEN_KEY = "nb-customer-token";
  var state = { customer: null, tab: "login" };

  function $(id) {
    return document.getElementById(id);
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
    var res = await fetch(API + path, {
      method: opts.method || "GET",
      headers: authHeaders(),
      credentials: "include",
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
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
                i.name +
                " (" +
                (i.size || "pack") +
                ") × " +
                i.qty +
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
            o.orderNumber +
            '</strong><div class="form-hint">' +
            formatDate(o.createdAt) +
            "</div></div>" +
            '<span class="order-status">' +
            o.status +
            " · " +
            o.paymentStatus +
            "</span>" +
            "</div>" +
            "<ul class=\"order-items\">" +
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
      box.innerHTML = '<p class="form-msg is-error">' + (err.message || "Could not load orders") + "</p>";
    }
  }

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
      loadOrders();
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

  async function onRegister(e) {
    e.preventDefault();
    var msg = $("registerMsg");
    showMsg(msg, "");
    try {
      var data = await api("/register", {
        method: "POST",
        body: {
          name: $("regName").value.trim(),
          email: $("regEmail").value.trim(),
          phone: $("regPhone").value.trim(),
          password: $("regPassword").value,
        },
      });
      if (data.token) setToken(data.token);
      setLoggedInUI(data.customer);
      showMsg($("dashMsg"), "Welcome! Your account is ready.", false);
      afterAuthRedirect();
    } catch (err) {
      showMsg(msg, err.message || "Could not create account", true);
    }
  }

  function afterAuthRedirect() {
    try {
      var next = new URLSearchParams(window.location.search).get("next");
      if (next === "checkout") {
        window.location.href = "index.html?checkout=1#shop";
      }
    } catch (e) {}
  }

  async function onLogin(e) {
    e.preventDefault();
    var msg = $("loginMsg");
    showMsg(msg, "");
    try {
      var data = await api("/login", {
        method: "POST",
        body: {
          email: $("loginEmail").value.trim(),
          password: $("loginPassword").value,
        },
      });
      if (data.token) setToken(data.token);
      setLoggedInUI(data.customer);
      showMsg($("dashMsg"), "Signed in successfully.", false);
      afterAuthRedirect();
    } catch (err) {
      showMsg(msg, err.message || "Login failed", true);
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
    var msg = $("profileMsg");
    showMsg(msg, "");
    try {
      var data = await api("/me", {
        method: "PUT",
        body: {
          name: $("profileName").value.trim(),
          phone: $("profilePhone").value.trim(),
          address: {
            line1: $("addrLine1").value.trim(),
            line2: $("addrLine2").value.trim(),
            city: $("addrCity").value.trim(),
            state: $("addrState").value.trim(),
            pincode: $("addrPin").value.trim(),
          },
        },
      });
      setLoggedInUI(data.customer);
      showMsg(msg, "Profile saved.", false);
    } catch (err) {
      showMsg(msg, err.message || "Could not save profile", true);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    var msg = $("passwordMsg");
    showMsg(msg, "");
    var next = $("newPassword").value;
    var confirm = $("confirmPassword").value;
    if (next !== confirm) {
      showMsg(msg, "New passwords do not match", true);
      return;
    }
    try {
      var data = await api("/password", {
        method: "PUT",
        body: {
          currentPassword: $("currentPassword").value,
          newPassword: next,
        },
      });
      if (data.token) setToken(data.token);
      $("passwordForm").reset();
      showMsg(msg, "Password updated.", false);
    } catch (err) {
      showMsg(msg, err.message || "Could not update password", true);
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
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
