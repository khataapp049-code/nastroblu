/* Nastro Blu hampers - used by hampers.html and hamper-builder.html.
   Shows only the curated hamper list (admin Hampers tab), not the full shop.
   Hamper picks live in their own basket (nb_hamper_basket) and never mix with shop cart. */
(function () {
  var STORE_KEY = "nb_hamper_basket";
  var OLD_STORE_KEY = "nb_hamper_draft";
  var FALLBACK_IMG = "assets/products/grains.jpg";

  var GROUP_META = {
    pantry: { label: "Pantry", blurb: "Elaichi, honey, squash, ghee, bhujia, roasted gram and saffron" },
    dryfruits: { label: "Dry fruits", blurb: "Walnut, badam, kaju, anjeer, apricot and dry fruit mixture" },
    sweets: { label: "Mithai", blurb: "Kaju katli, motichoor, kalakand, barfi, rolls and assorted kaju" },
  };
  var GROUP_ORDER = ["pantry", "dryfruits", "sweets"];

  var FALLBACK_ITEMS = [
    { id: "palakudi-cardamom-25g", group: "pantry", sizeLabel: "25 g" },
    { id: "raw-honey-250g", group: "pantry", sizeLabel: "250 g" },
    { id: "mango-squash-1l", group: "pantry", sizeLabel: "500 ml" },
    { id: "desi-cow-ghee-250g", group: "pantry", sizeLabel: "250 g" },
    { id: "walnuts-250g", group: "dryfruits", sizeLabel: "" },
    { id: "desi-mamra-badam-250g", group: "dryfruits", sizeLabel: "" },
    { id: "konkan-cashew-250g", group: "dryfruits", sizeLabel: "" },
    { id: "anjeer-fig-250g", group: "dryfruits", sizeLabel: "" },
    { id: "apricot-250g", group: "dryfruits", sizeLabel: "" },
    { id: "dry-fruit-mixture-250g", group: "dryfruits", sizeLabel: "" },
    { id: "plain-mota-bhujia-250g", group: "pantry", sizeLabel: "" },
    { id: "futana-dal-500g", group: "pantry", sizeLabel: "" },
    { id: "saffron-1g", group: "pantry", sizeLabel: "1 g" },
    { id: "kaju-katli-250g", group: "sweets", sizeLabel: "" },
    { id: "motichoor-laddu-250g", group: "sweets", sizeLabel: "" },
    { id: "ajmeri-kalakand-jaggery-250g", group: "sweets", sizeLabel: "" },
    { id: "mamra-badam-anjeer-barfi-250g", group: "sweets", sizeLabel: "" },
    { id: "dry-fruit-choco-delight-250g", group: "sweets", sizeLabel: "" },
    { id: "kaju-delight-assorted-250g", group: "sweets", sizeLabel: "" },
    { id: "anjeer-dry-fruit-roll-250g", group: "sweets", sizeLabel: "" },
    { id: "kaju-anjeer-roll-250g", group: "sweets", sizeLabel: "" },
    { id: "desi-mamra-badam-katli-250g", group: "sweets", sizeLabel: "" },
    { id: "mava-choco-barfi-250g", group: "sweets", sizeLabel: "" },
  ];

  var catalog = window.NASTRO_CATALOG || { products: [], categories: [] };
  var LIST = [];
  var BY_ID = {};
  var hamperTitle = "Nastro Blu Gift Hamper";
  var hamperBlurb = "Pick from this curated list of pantry staples, dry fruits and mithai.";

  function mapProduct(p, extra) {
    extra = extra || {};
    var sizes = p.sizes && p.sizes.length ? p.sizes : [{ label: p.unit || "", price: p.price }];
    var wanted = String(extra.sizeLabel || "").toLowerCase().replace(/\s+/g, "");
    var s = sizes[0];
    if (wanted) {
      for (var i = 0; i < sizes.length; i++) {
        var lab = String(sizes[i].label || "").toLowerCase().replace(/\s+/g, "");
        if (lab.indexOf(wanted.replace(/gms?/g, "g")) >= 0) {
          s = sizes[i];
          break;
        }
      }
    }
    return {
      id: p.id,
      name: p.name,
      price: Number(s.price) || Number(p.price) || 0,
      unit: extra.sizeLabel || s.label || p.unit || "",
      img: p.image || FALLBACK_IMG,
      cat: p.category,
      group: extra.group || "pantry",
      note: extra.note || "",
    };
  }

  function rebuildFromCatalog(itemsSpec) {
    var products = (catalog.products || []).filter(function (p) {
      return p.active !== false && p.status !== "unavailable" && p.status !== "archived";
    });
    var byId = {};
    products.forEach(function (p) {
      byId[p.id] = p;
    });
    LIST = [];
    BY_ID = {};
    (itemsSpec || FALLBACK_ITEMS).forEach(function (spec) {
      var pid = spec.id || spec.productId;
      var p = byId[pid];
      if (!p) return;
      var row = mapProduct(p, spec);
      LIST.push(row);
      BY_ID[row.id] = row;
    });
  }

  rebuildFromCatalog(FALLBACK_ITEMS);

  var rupee = function (n) {
    return "₹" + Math.round(n).toLocaleString("en-IN");
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var imgTag = function (src) {
    return (
      '<img src="' +
      esc(src) +
      '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' +
      FALLBACK_IMG +
      '\'">'
    );
  };
  function totalOf(items) {
    return Object.keys(items).reduce(function (s, id) {
      return s + (BY_ID[id] ? BY_ID[id].price * items[id] : 0);
    }, 0);
  }

  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) {
      alert(msg);
      return;
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove("show");
    }, 2400);
  }

  function customerHeaders() {
    var h = { "Content-Type": "application/json" };
    try {
      var token = localStorage.getItem("nb-customer-token") || "";
      if (token) h.Authorization = "Bearer " + token;
    } catch (e) {}
    return h;
  }

  async function checkoutHamper(items) {
    var ids = Object.keys(items).filter(function (id) {
      return BY_ID[id] && items[id] > 0;
    });
    if (!ids.length) {
      toast("Your hamper is empty");
      return false;
    }
    var me;
    try {
      var meRes = await fetch("/api/customer/me", {
        credentials: "include",
        headers: customerHeaders(),
      });
      if (meRes.status === 401) {
        toast("Please sign in to checkout this hamper");
        window.location.href = "account.html?next=" + encodeURIComponent("hamper-builder.html");
        return false;
      }
      me = await meRes.json();
    } catch (e) {
      toast("Could not check your sign-in. Try again.");
      return false;
    }
    var customer = me && me.customer;
    try {
      var res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: customerHeaders(),
        body: JSON.stringify({
          items: ids.map(function (id) {
            var p = BY_ID[id];
            return { productId: id, size: p.unit, qty: items[id] };
          }),
          shippingAddress: (customer && customer.address) || {},
          notes: "Gift hamper — separate from shop cart",
        }),
      });
      var data = {};
      try {
        data = await res.json();
      } catch (e) {}
      if (res.status === 401) {
        window.location.href = "account.html?next=" + encodeURIComponent("hamper-builder.html");
        return false;
      }
      if (!res.ok) throw new Error(data.error || "Could not checkout hamper");
      var snapshot = ids.map(function (id) {
        var p = BY_ID[id];
        return {
          id: id,
          name: p.name,
          unit: p.unit,
          img: p.img,
          qty: items[id],
          line: p.price * items[id],
        };
      });
      var result = {
        ok: true,
        orderNumber: (data.order && data.order.orderNumber) || "",
        total: totalOf(items),
        items: snapshot,
        whatsappUrl: data.whatsappUrl || "",
      };
      try {
        sessionStorage.setItem("nb_hamper_thanks", JSON.stringify(result));
      } catch (e) {}
      if (data.whatsappUrl) window.open(data.whatsappUrl, "_blank", "noopener");
      return result;
    } catch (err) {
      toast(err.message || "Hamper checkout failed");
      return false;
    }
  }

  function parseBasket(raw) {
    try {
      var o = JSON.parse(raw || "{}");
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function readDraft() {
    var fromLocal = "";
    var fromSession = "";
    try {
      fromLocal = localStorage.getItem(STORE_KEY) || "";
    } catch (e) {}
    try {
      fromSession = sessionStorage.getItem(OLD_STORE_KEY) || sessionStorage.getItem(STORE_KEY) || "";
    } catch (e) {}
    var d = parseBasket(fromLocal);
    if (!Object.keys(d).length) d = parseBasket(fromSession);
    var clean = {};
    Object.keys(d).forEach(function (id) {
      if (BY_ID[id] && d[id] > 0) clean[id] = d[id];
    });
    return clean;
  }
  function writeDraft(d) {
    var clean = {};
    Object.keys(d || {}).forEach(function (id) {
      if (BY_ID[id] && d[id] > 0) clean[id] = d[id];
    });
    var json = JSON.stringify(clean);
    try {
      localStorage.setItem(STORE_KEY, json);
    } catch (e) {}
    try {
      sessionStorage.removeItem(OLD_STORE_KEY);
      sessionStorage.removeItem(STORE_KEY);
    } catch (e) {}
  }

  function parseHamperProduct(p) {
    var title = "";
    var blurb = "";
    var items = [];
    var replaceAll = false;
    ((p && p.packagingText) || []).forEach(function (line) {
      var s = String(line || "");
      if (s.indexOf("NB_HAMPER_TITLE|") === 0) title = s.slice("NB_HAMPER_TITLE|".length);
      else if (s.indexOf("NB_HAMPER_BLURB|") === 0) blurb = s.slice("NB_HAMPER_BLURB|".length);
      else if (s.indexOf("NB_HAMPER_REPLACE|") === 0) replaceAll = s.slice("NB_HAMPER_REPLACE|".length) === "1";
      else if (s.indexOf("NB_HAMPER_ITEM|") === 0) {
        var parts = s.slice("NB_HAMPER_ITEM|".length).split("|");
        if (parts[0]) {
          items.push({
            id: parts[0],
            productId: parts[0],
            group: parts[1] || "pantry",
            sizeLabel: parts[2] || "",
            note: parts[3] || "",
          });
        }
      }
    });
    if (!title && !items.length) return null;
    return { title: title, blurb: blurb, items: items, replaceAll: replaceAll };
  }

  function mergeHamperItems(saved, replaceAll) {
    saved = saved || [];
    if (replaceAll && saved.length) {
      return saved.map(function (it) {
        var id = it.id || it.productId;
        return {
          id: id,
          productId: id,
          group: it.group || "pantry",
          sizeLabel: it.sizeLabel || "",
          note: it.note || "",
        };
      });
    }
    var byId = {};
    FALLBACK_ITEMS.forEach(function (it) {
      byId[it.id] = {
        id: it.id,
        productId: it.id,
        group: it.group,
        sizeLabel: it.sizeLabel || "",
        note: it.note || "",
      };
    });
    saved.forEach(function (it) {
      var id = it.id || it.productId;
      if (!id) return;
      var prev = byId[id] || {};
      byId[id] = {
        id: id,
        productId: id,
        group: it.group || prev.group || "pantry",
        sizeLabel: it.sizeLabel != null && it.sizeLabel !== "" ? it.sizeLabel : prev.sizeLabel || "",
        note: it.note || prev.note || "",
      };
    });
    var out = [];
    var seen = {};
    FALLBACK_ITEMS.forEach(function (it) {
      out.push(byId[it.id]);
      seen[it.id] = true;
    });
    saved.forEach(function (it) {
      var id = it.id || it.productId;
      if (id && !seen[id]) {
        out.push(byId[id]);
        seen[id] = true;
      }
    });
    return out;
  }

  async function loadHamperConfig() {
    try {
      var pres = await fetch("/api/products");
      if (pres.ok) {
        var pdata = await pres.json();
        if (pdata && Array.isArray(pdata.products)) {
          catalog = { products: pdata.products, categories: pdata.categories || [] };
        }
      }
    } catch (e) {}
    if (window.NASTRO_CATALOG && window.NASTRO_CATALOG.products && !(catalog.products || []).length) {
      catalog = window.NASTRO_CATALOG;
    }
    var saved = parseHamperProduct(
      (catalog.products || []).filter(function (p) {
        return p.id === "gift-hamper";
      })[0]
    );
    if (saved) {
      if (saved.title) hamperTitle = saved.title;
      if (saved.blurb) hamperBlurb = saved.blurb;
      rebuildFromCatalog(mergeHamperItems(saved.items, false));
      if (LIST.length) return;
    }
    rebuildFromCatalog(FALLBACK_ITEMS);
  }

  function initListing() {
    var group = "all";
    var draft = readDraft();
    var host = document.getElementById("hb-browse");
    var floatBar = document.getElementById("hb-float");
    var tilesEl = document.getElementById("hb-tiles");
    var titleEl = document.getElementById("hb-list-title");
    var subEl = document.getElementById("hb-list-sub");

    var heroNames = ["Kaju Katli", "Walnuts", "Raw Honey"];
    document.getElementById("hb-hero-art").innerHTML = heroNames
      .map(function (n) {
        var p = LIST.filter(function (x) {
          return x.name === n;
        })[0];
        if (!p) p = LIST[0];
        return p ? "<div>" + imgTag(p.img) + "<span>" + esc(p.name) + "</span></div>" : "";
      })
      .join("");

    function firstInGroup(g) {
      for (var i = 0; i < LIST.length; i++) {
        if (LIST[i].group === g) return LIST[i];
      }
      return null;
    }

    function tileArt(c) {
      if (c.id !== "all") {
        var sample = firstInGroup(c.id);
        return sample ? imgTag(sample.img) : "";
      }
      var picks = [];
      GROUP_ORDER.forEach(function (g) {
        var p = firstInGroup(g);
        if (p) picks.push(p);
      });
      var extra = LIST.filter(function (p) {
        return picks.indexOf(p) < 0;
      })[0];
      if (extra) picks.push(extra);
      picks = picks.slice(0, 4);
      if (!picks.length) return "";
      return (
        '<div class="hb-tile-collage n' +
        picks.length +
        '">' +
        picks.map(function (p) { return imgTag(p.img); }).join("") +
        "</div>"
      );
    }

    function drawTiles() {
      var chips = [{ id: "all", label: "All items" }].concat(
        GROUP_ORDER.filter(function (id) {
          return !!firstInGroup(id);
        }).map(function (id) {
          return { id: id, label: GROUP_META[id].label };
        })
      );
      tilesEl.innerHTML = chips
        .map(function (c) {
          return (
            '<button type="button" class="hb-tile' +
            (c.id === group ? " on" : "") +
            (c.id === "all" ? " hb-tile--mix" : "") +
            '" data-grp="' +
            c.id +
            '"><div>' +
            tileArt(c) +
            "</div><span>" +
            esc(c.label) +
            "</span></button>"
          );
        })
        .join("");
    }

    function drawBrowse() {
      if (titleEl) titleEl.textContent = hamperTitle;
      if (subEl) subEl.textContent = hamperBlurb;
      var groups = group === "all" ? GROUP_ORDER : [group];
      host.innerHTML = groups
        .map(function (g) {
          var shown = LIST.filter(function (p) {
            return p.group === g;
          });
          if (!shown.length) return "";
          var meta = GROUP_META[g] || { label: g, blurb: "" };
          return (
            '<section class="hb-group" id="hb-g-' +
            g +
            '">' +
            '<div class="hb-group__head"><h2 class="display">' +
            esc(meta.label) +
            '</h2><p class="hb-muted">' +
            esc(meta.blurb) +
            "</p></div>" +
            '<div class="hb-pgrid">' +
            shown
              .map(function (p) {
                var inH = !!draft[p.id];
                return (
                  '<article class="hb-pcard' +
                  (inH ? " is-in" : "") +
                  '"><div class="hb-pcard__img">' +
                  imgTag(p.img) +
                  '<span class="hb-ribbon">' +
                  esc(meta.label) +
                  "</span></div><h3>" +
                  esc(p.name) +
                  "</h3>" +
                  '<div class="hb-muted">' +
                  esc(p.unit) +
                  (p.note ? " · " + esc(p.note) : "") +
                  '</div><div class="hb-row"><span class="hb-price">' +
                  rupee(p.price) +
                  "</span>" +
                  '<button type="button" class="btn ' +
                  (inH ? "btn--ghost" : "btn--wine") +
                  '" data-badd="' +
                  esc(p.id) +
                  '">' +
                  (inH ? "Added" : "Add to hamper") +
                  "</button></div></article>"
                );
              })
              .join("") +
            "</div></section>"
          );
        })
        .join("");
    }

    function drawFloat() {
      var ids = Object.keys(draft).filter(function (id) {
        return BY_ID[id];
      });
      if (!ids.length) {
        floatBar.style.display = "none";
        return;
      }
      var n = ids.reduce(function (s, id) {
        return s + draft[id];
      }, 0);
      floatBar.style.display = "flex";
      floatBar.innerHTML =
        "<span><b>Your hamper:</b> " +
        n +
        " item" +
        (n > 1 ? "s" : "") +
        " · <b>" +
        rupee(totalOf(draft)) +
        "</b></span>" +
        '<span><button type="button" class="btn btn--ghost hb-float-clear" data-bclear>Clear</button> ' +
        '<a class="btn btn--gold" href="hamper-builder.html">View hamper</a></span>';
    }

    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-grp],[data-badd],[data-bclear]");
      if (!t) return;
      var d = t.dataset;
      if (d.grp) {
        group = d.grp;
        drawTiles();
        drawBrowse();
        host.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (d.badd) {
        if (draft[d.badd]) delete draft[d.badd];
        else draft[d.badd] = 1;
        writeDraft(draft);
      }
      if (t.hasAttribute("data-bclear")) {
        draft = {};
        writeDraft(draft);
      }
      drawBrowse();
      drawFloat();
    });

    drawTiles();
    drawBrowse();
    drawFloat();

    var form = document.getElementById("hb-corp-form");
    if (form)
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var f = new FormData(form);
        var wa = (window.NASTRO_BRAND && NASTRO_BRAND.whatsapp) || "919063048255";
        var msg =
          "Corporate gifting enquiry\nName: " +
          f.get("name") +
          "\nPhone: " +
          f.get("phone") +
          "\nEmail: " +
          f.get("email") +
          "\nCompany: " +
          f.get("company") +
          "\nQuantity: " +
          f.get("qty") +
          "\nDelivery: " +
          f.get("loc");
        window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(msg), "_blank");
      });
  }

  function initBuilder() {
    var items = readDraft();
    var thanks = null;
    try {
      thanks = JSON.parse(sessionStorage.getItem("nb_hamper_thanks") || "null");
    } catch (e) {
      thanks = null;
    }

    var list = document.getElementById("hb-products");
    var panel = document.getElementById("hb-panel-body");
    var title = document.getElementById("hb-title");
    var sub = document.getElementById("hb-sub");
    var chips = document.getElementById("hb-chips");
    var search = document.getElementById("hb-search");
    var back = document.querySelector(".hb-back");
    if (chips) chips.style.display = "none";
    if (search) search.style.display = "none";
    if (back) {
      back.textContent = "← Add more products";
      back.setAttribute("href", "hampers.html#hb-tiles");
    }

    function setHead() {
      if (thanks && thanks.ok) {
        if (title) title.textContent = "Hamper order placed";
        if (sub)
          sub.textContent =
            "Thank you. We saved this hamper as its own order. WhatsApp is open so we can confirm packing and delivery.";
        if (back) {
          back.textContent = "← Back to hampers";
          back.setAttribute("href", "hampers.html");
        }
        return;
      }
      if (title) title.textContent = "Your hamper";
      if (sub)
        sub.textContent =
          "Only items you added with Add to hamper appear here. Shop cart items stay in the cart — they are not mixed with this hamper.";
    }

    function idsNow() {
      return Object.keys(items).filter(function (id) {
        return BY_ID[id];
      });
    }

    function qtyBox(id) {
      return (
        '<div class="hb-qty"><button type="button" data-dec="' +
        esc(id) +
        '">−</button>' +
        items[id] +
        '<button type="button" data-inc="' +
        esc(id) +
        '">+</button></div>'
      );
    }

    function drawList() {
      if (thanks && thanks.ok) {
        list.innerHTML =
          '<div class="hb-thanks">' +
          '<p class="hb-thanks__badge">Almost done: send your message on WhatsApp</p>' +
          "<h3>Your gift hamper is saved.</h3>" +
          (thanks.orderNumber
            ? '<p class="hb-muted">Order <b>' + esc(thanks.orderNumber) + "</b> is saved. It stays waiting until we confirm it. <a href=\"order-confirmation.html?order=" +
              encodeURIComponent(thanks.orderNumber) +
              '">See order status</a></p>'
            : "") +
          '<p class="hb-muted">We cleared the hamper basket so you cannot check it out twice. Your shop cart is unchanged.</p>' +
          '<div class="hb-thanks__items">' +
          (thanks.items || [])
            .map(function (p) {
              return (
                '<div class="hb-item">' +
                imgTag(p.img) +
                '<div class="info"><b>' +
                esc(p.name) +
                '</b><div class="hb-muted">' +
                esc(p.unit) +
                " · qty " +
                p.qty +
                "</div></div>" +
                '<span class="hb-price" style="font-size:1rem">' +
                rupee(p.line) +
                "</span></div>"
              );
            })
            .join("") +
          "</div></div>";
        return;
      }
      var ids = idsNow();
      list.innerHTML = ids.length
        ? ids
            .map(function (id) {
              var p = BY_ID[id];
              return (
                '<div class="hb-item">' +
                imgTag(p.img) +
                '<div class="info"><b>' +
                esc(p.name) +
                '</b><div class="hb-muted">' +
                esc(p.unit) +
                " · " +
                rupee(p.price) +
                " each</div>" +
                qtyBox(id) +
                '</div><span class="hb-price" style="font-size:1rem">' +
                rupee(p.price * items[id]) +
                "</span>" +
                '<button type="button" class="btn btn--ghost" style="border-color:var(--wine);color:var(--wine);padding:.5rem 1rem" data-del="' +
                esc(id) +
                '">Remove</button></div>'
              );
            })
            .join("")
        : '<div class="hb-item" style="flex-direction:column;align-items:flex-start"><b>Your hamper is empty.</b><div class="hb-muted">Choose items from the curated hamper list.</div><a class="btn btn--wine" href="hampers.html#hb-tiles">Browse hamper items</a></div>';
    }

    function drawPanel() {
      if (thanks && thanks.ok) {
        panel.innerHTML =
          '<p class="hb-muted">Hamper total</p>' +
          '<div class="hb-row"><span>Paid / to confirm</span><span class="hb-total">' +
          rupee(thanks.total || 0) +
          "</span></div>" +
          '<p class="hb-muted">WhatsApp opened with this hamper order. If the window was blocked, use the button below.</p>' +
          (thanks.whatsappUrl
            ? '<a class="btn btn--gold" href="' +
              esc(thanks.whatsappUrl) +
              '" target="_blank" rel="noopener">Open WhatsApp again</a>'
            : "") +
          '<a class="btn btn--wine" href="hampers.html#hb-tiles">Build another hamper</a>' +
          '<a class="btn btn--ghost" style="border-color:var(--wine);color:var(--wine)" href="account.html">View my orders</a>';
        return;
      }
      var ids = idsNow();
      var count = ids.reduce(function (s, id) {
        return s + items[id];
      }, 0);
      panel.innerHTML =
        '<div class="hb-row" style="padding-top:.9rem"><span>Items (' +
        count +
        ')</span><span class="hb-total">' +
        rupee(totalOf(items)) +
        "</span></div>" +
        '<p class="hb-muted">This hamper is separate from your shop cart.</p>' +
        '<button type="button" class="btn btn--gold" data-cart ' +
        (ids.length ? "" : "disabled") +
        ">Checkout hamper</button>" +
        '<button type="button" class="btn btn--ghost" style="border-color:var(--wine);color:var(--wine)" data-clear>Clear hamper</button>';
    }

    function draw() {
      setHead();
      drawList();
      drawPanel();
      if (!(thanks && thanks.ok)) writeDraft(items);
    }

    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-inc],[data-dec],[data-del],[data-cart],[data-clear]");
      if (!t || t.disabled) return;
      var d = t.dataset;
      if (d.inc) items[d.inc]++;
      if (d.dec && --items[d.dec] <= 0) delete items[d.dec];
      if (d.del) delete items[d.del];
      if (t.hasAttribute("data-clear")) items = {};
      if (t.hasAttribute("data-cart")) {
        if (window.NastroCheckout && typeof window.NastroCheckout.start === "function") {
          window.NastroCheckout.start({
            source: "hamper",
            next: "hamper-builder.html",
            total: totalOf(items),
            getItems: function () {
              return idsNow().map(function (id) {
                var p = BY_ID[id];
                return {
                  id: p.id,
                  productId: p.id,
                  size: p.unit,
                  unit: p.unit,
                  qty: items[id],
                  name: p.name,
                  price: p.price,
                  image: p.img,
                };
              });
            },
            onSuccess: function () {
              items = {};
              writeDraft({});
            },
          });
          return;
        }
        t.disabled = true;
        t.textContent = "Placing hamper order…";
        checkoutHamper(items).then(function (result) {
          if (result && result.ok) {
            thanks = result;
            items = {};
            writeDraft({});
          } else {
            t.disabled = false;
            t.textContent = "Checkout hamper";
          }
          draw();
        });
        return;
      }
      draw();
    });
    draw();
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadHamperConfig().then(function () {
      if (document.getElementById("hb-browse")) initListing();
      if (document.getElementById("hb-products")) initBuilder();
    });
  });
})();
