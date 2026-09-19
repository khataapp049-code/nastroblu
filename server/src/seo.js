const fs = require("fs");
const path = require("path");
const Product = require("./models/Product");

const SITE = "https://nastroblu.in";
const ROOT = path.join(__dirname, "../..");

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, " ");
}

function absUrl(p) {
  if (!p) return `${SITE}/assets/og-image.png`;
  if (String(p).startsWith("http")) return String(p);
  return `${SITE}/${String(p).replace(/^\//, "")}`;
}

function stripTags(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["Store", "LocalBusiness", "FoodEstablishment"],
    "@id": `${SITE}/#business`,
    name: "Nastro Blu",
    alternateName: "NASTRO BLU",
    description:
      "Naturally grown pantry foods in Hyderabad — cold-pressed oils, bilona desi cow ghee, Kerala spices, traditional sweets, dry fruits and farm produce. Choose Better. Eat Better.",
    url: SITE,
    image: `${SITE}/assets/og-image.png`,
    logo: `${SITE}/assets/brand/nastroblu-logo.png`,
    telephone: "+91-90630-48255",
    email: "nastroblu.eatbetter@gmail.com",
    priceRange: "₹₹",
    servesCuisine: "Natural foods",
    address: {
      "@type": "PostalAddress",
      streetAddress: "2-2-18/15/C, Plot no -10, Durgabai Deshmukh Colony, Bagh Amberpet",
      addressLocality: "Hyderabad",
      addressRegion: "Telangana",
      postalCode: "500013",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 17.4055,
      longitude: 78.5189,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "08:00",
        closes: "20:00",
      },
    ],
    identifier: {
      "@type": "PropertyValue",
      name: "FSSAI",
      value: "23624030000782",
    },
    sameAs: [
      "https://www.instagram.com/nastroblu.eatbetter/",
      "https://www.google.com/maps?cid=11786458721880673435",
    ],
    areaServed: {
      "@type": "City",
      name: "Hyderabad",
    },
  };
}

function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: SITE,
    name: "Nastro Blu",
    description: "Shop naturally grown foods from Nastro Blu, Hyderabad.",
    publisher: { "@id": `${SITE}/#business` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE}/?q={search_term_string}#shop`,
      "query-input": "required name=search_term_string",
    },
  };
}

function productJsonLd(p) {
  const status = p.status || (p.active === false ? "unavailable" : "available");
  const available = status === "available";
  const desc = stripTags(p.description || p.blurb || p.name).slice(0, 5000);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: stripTags(p.name),
    description: desc,
    image: [absUrl(p.image)],
    sku: p.sku || p.slug,
    brand: {
      "@type": "Brand",
      name: p.brand || "Nastro Blu",
    },
    category: p.category || undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE}/product.html?id=${encodeURIComponent(p.slug)}`,
      priceCurrency: "INR",
      price: String(p.price ?? 0),
      availability: available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@id": `${SITE}/#business` },
    },
    ...(p.reviews > 0 && p.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: String(p.rating),
            reviewCount: String(p.reviews),
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };
}

function injectHead(html, { title, description, canonical, image, jsonLd, keywords }) {
  let out = html;
  const safeTitle = escapeAttr(title);
  const safeDesc = escapeAttr(description);
  const safeCanon = escapeAttr(canonical);
  const safeImage = escapeAttr(image || `${SITE}/assets/og-image.png`);
  const safeKeywords = escapeAttr(keywords || "");

  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );
  if (/<link\s+rel="canonical"/i.test(out)) {
    out = out.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${safeCanon}" />`
    );
  } else {
    out = out.replace(
      /<\/title>/i,
      `</title>\n <link rel="canonical" href="${safeCanon}" />`
    );
  }

  const ogReplacements = [
    [/property="og:url"\s+content="[^"]*"/i, `property="og:url" content="${safeCanon}"`],
    [/property="og:title"\s+content="[^"]*"/i, `property="og:title" content="${safeTitle}"`],
    [
      /property="og:description"\s+content="[^"]*"/i,
      `property="og:description" content="${safeDesc}"`,
    ],
    [/property="og:image"\s+content="[^"]*"/i, `property="og:image" content="${safeImage}"`],
    [/name="twitter:title"\s+content="[^"]*"/i, `name="twitter:title" content="${safeTitle}"`],
    [
      /name="twitter:description"\s+content="[^"]*"/i,
      `name="twitter:description" content="${safeDesc}"`,
    ],
    [/name="twitter:image"\s+content="[^"]*"/i, `name="twitter:image" content="${safeImage}"`],
  ];
  ogReplacements.forEach(([re, repl]) => {
    if (re.test(out)) out = out.replace(re, repl);
  });

  if (safeKeywords) {
    if (/name="keywords"/i.test(out)) {
      out = out.replace(
        /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="keywords" content="${safeKeywords}" />`
      );
    } else {
      out = out.replace(
        /<meta\s+name="description"[^>]*>/i,
        (m) => `${m}\n <meta name="keywords" content="${safeKeywords}" />`
      );
    }
  }

  if (jsonLd) {
    const block =
      `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(
        /</g,
        "\\u003c"
      )}</script>`;
    // Replace existing product ld+json placeholder or inject before </head>
    if (/id="seo-jsonld"/i.test(out)) {
      out = out.replace(
        /<script[^>]*id="seo-jsonld"[^>]*>[\s\S]*?<\/script>/i,
        `<script type="application/ld+json" id="seo-jsonld">${JSON.stringify(jsonLd).replace(
          /</g,
          "\\u003c"
        )}</script>`
      );
    } else {
      out = out.replace(/<\/head>/i, ` ${block}\n</head>`);
    }
  }

  return out;
}

async function buildSitemapXml() {
  const urls = [
    { loc: `${SITE}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${SITE}/about.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${SITE}/#shop`, changefreq: "daily", priority: "0.9" },
    { loc: `${SITE}/#visit`, changefreq: "monthly", priority: "0.7" },
    { loc: `${SITE}/#google-reviews`, changefreq: "weekly", priority: "0.6" },
    { loc: `${SITE}/terms.html`, changefreq: "yearly", priority: "0.3" },
    { loc: `${SITE}/privacy.html`, changefreq: "yearly", priority: "0.3" },
    { loc: `${SITE}/shipping.html`, changefreq: "monthly", priority: "0.4" },
    { loc: `${SITE}/returns.html`, changefreq: "monthly", priority: "0.4" },
    { loc: `${SITE}/disclaimer.html`, changefreq: "yearly", priority: "0.3" },
    { loc: `${SITE}/food-safety.html`, changefreq: "yearly", priority: "0.3" },
  ];

  const products = await Product.find({ status: { $ne: "archived" } })
    .select("slug updatedAt image name")
    .sort({ sortOrder: 1, updatedAt: -1 })
    .limit(2000)
    .lean();

  products.forEach((p) => {
    urls.push({
      loc: `${SITE}/product.html?id=${encodeURIComponent(p.slug)}`,
      lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : undefined,
      changefreq: "weekly",
      priority: "0.8",
    });
  });

  const body = urls
    .map((u) => {
      let item = `  <url>\n    <loc>${escapeHtml(u.loc)}</loc>\n`;
      if (u.lastmod) item += `    <lastmod>${u.lastmod}</lastmod>\n`;
      if (u.changefreq) item += `    <changefreq>${u.changefreq}</changefreq>\n`;
      if (u.priority) item += `    <priority>${u.priority}</priority>\n`;
      item += `  </url>`;
      return item;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function mountSeoRoutes(app) {
  const DENY_EXACT = new Set([
    "/docker-compose.yml",
    "/docker-compose.qa.yml",
    "/.env",
    "/.env.example",
    "/Dockerfile",
    "/package.json",
    "/package-lock.json",
    "/server/package.json",
    "/server/.env",
    "/server/.env.example",
    "/_qa_run_local.py",
    "/_qa_findings.json",
    "/_qa_report_full.json",
    "/netlify.toml",
    "/.gitignore",
  ]);

  const DENY_PREFIXES = ["/server/", "/deploy/", "/node_modules/", "/.git/", "/.netlify/"];
  const DENY_EXT = /\.(md|sh|yml|yaml|env|log|lock|map)$/i;

  app.use((req, res, next) => {
    const p = req.path || "";
    if (DENY_EXACT.has(p)) {
      return res.status(404).type("text").send("Not found");
    }
    if (DENY_PREFIXES.some((pre) => p === pre.slice(0, -1) || p.startsWith(pre))) {
      return res.status(404).type("text").send("Not found");
    }
    // Block docs / scripts / compose at web root (keep storefront .js)
    if (DENY_EXT.test(p) && !p.startsWith("/assets/")) {
      return res.status(404).type("text").send("Not found");
    }
    next();
  });

  app.get("/robots.txt", (_req, res) => {
    const file = path.join(ROOT, "robots.txt");
    if (fs.existsSync(file)) {
      return res.type("text/plain").sendFile(file);
    }
    // Fallback when file isn't volume-mounted in Docker
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Allow: /",
        "Allow: /about.html",
        "Allow: /product.html",
        "Allow: /assets/",
        "Disallow: /admin/",
        "Disallow: /api/",
        "Disallow: /account.html",
        "Disallow: /account",
        "Disallow: /docker-compose.yml",
        "Disallow: /.env",
        "Disallow: /server/",
        "Disallow: /deploy/",
        "",
        `Sitemap: ${SITE}/sitemap.xml`,
        "",
      ].join("\n")
    );
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const xml = await buildSitemapXml();
      res.type("application/xml").send(xml);
    } catch (err) {
      console.error("sitemap error", err);
      res.status(500).type("text").send("Could not build sitemap");
    }
  });

  /** SEO-friendly product HTML with server-injected meta + Product JSON-LD for crawlers */
  app.get(["/product.html", "/product"], async (req, res) => {
    try {
      const file = path.join(ROOT, "product.html");
      let html = fs.readFileSync(file, "utf8");
      const id = String(req.query.id || "").trim();

      if (id) {
        const product =
          (await Product.findOne({ slug: id })) ||
          (await Product.findById(id).catch(() => null));
        const status =
          product && (product.status || (product.active === false ? "unavailable" : "available"));
        if (product && status !== "archived") {
          const name = stripTags(product.name);
          const blurb = stripTags(product.blurb || product.description || "").slice(0, 155);
          const title = `${name} | Buy Online | Nastro Blu Hyderabad`;
          const description =
            blurb ||
            `Buy ${name} from Nastro Blu, Hyderabad. Naturally grown, farm-direct pantry foods.`;
          const canonical = `${SITE}/product.html?id=${encodeURIComponent(product.slug)}`;
          const keywords = [
            name,
            "Nastro Blu",
            "Hyderabad",
            "organic",
            "natural food",
            product.category,
            "Bagh Amberpet",
          ]
            .filter(Boolean)
            .join(", ");

          html = injectHead(html, {
            title,
            description,
            canonical,
            image: absUrl(product.image),
            keywords,
            jsonLd: productJsonLd(product),
          });
        }
      }

      res.set("Cache-Control", "public, max-age=300");
      res.type("html").send(html);
    } catch (err) {
      console.error("product seo serve error", err);
      res.sendFile(path.join(ROOT, "product.html"));
    }
  });
}

module.exports = {
  mountSeoRoutes,
  localBusinessJsonLd,
  websiteJsonLd,
  SITE,
};
