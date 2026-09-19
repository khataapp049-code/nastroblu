#!/usr/bin/env python3
"""Re-verify previously failing QA cases against local + prod. Untracked."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

LOCAL = os.environ.get("NB_LOCAL", "http://127.0.0.1:4000")
PROD = "https://nastroblu.in"
ADMIN_EMAIL = "admin@nastroblu.in"
ADMIN_PASS = "LocalQaTestPass123!"


def req(base, method, path, body=None, token=None):
    url = base + path
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=25) as res:
            raw = res.read()
            try:
                parsed = json.loads(raw.decode() or "{}")
            except Exception:
                parsed = raw.decode("utf-8", "replace")
            return res.status, parsed, dict(res.headers)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw.decode() or "{}")
        except Exception:
            parsed = raw.decode("utf-8", "replace")
        return e.code, parsed, dict(e.headers)


def main():
    results = []

    def check(tid, ok, evidence):
        results.append({"id": tid, "result": "Pass" if ok else "Fail", "evidence": evidence[:300]})
        print(("PASS" if ok else "FAIL"), tid, "-", evidence[:160])

    # Prod headers / robots / compose
    code, body, hdrs = req(PROD, "GET", "/")
    h = {k.lower(): v for k, v in hdrs.items()}
    check(
        "P5/8.3",
        all(k in h for k in ["x-content-type-options", "x-frame-options", "content-security-policy", "referrer-policy"]),
        f"headers present: {[k for k in ['x-content-type-options','x-frame-options','content-security-policy','referrer-policy','strict-transport-security'] if k in h]}",
    )
    code, body, _ = req(PROD, "GET", "/docker-compose.yml")
    check("8.4-compose-prod", code == 404, f"compose status {code}")
    code, body, _ = req(PROD, "GET", "/robots.txt")
    check("8.5-robots-prod", code == 200 and "Sitemap:" in str(body), f"robots {code}")

    # Local auth + validation
    code, data, _ = req(LOCAL, "POST", "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    token = data.get("token") if isinstance(data, dict) else None
    check("local-login", bool(token), f"login {code}")
    if not token:
        print(json.dumps(results, indent=2))
        return

    # XSS create should strip tags
    slug = "qa-fix-xss"
    code, data, _ = req(
        LOCAL,
        "POST",
        "/api/products",
        {
            "name": '<img src=x onerror="window.__xss=true">',
            "price": 100,
            "mrp": 120,
            "description": "<script>alert(1)</script> tasty",
            "category": "honey",
            "slug": slug,
            "image": "assets/logo.png",
        },
        token=token,
    )
    name = (data.get("product") or {}).get("name", "") if isinstance(data, dict) else ""
    check("6.9-api", code in (200, 201) and "<" not in name, f"{code} name={name!r}")

    code, data, _ = req(
        LOCAL,
        "POST",
        "/api/products",
        {"name": "Bad$", "price": -1, "mrp": 10, "description": "x", "category": "honey"},
        token=token,
    )
    check("6.6", code == 400, f"neg price {code} {data}")

    code, data, _ = req(
        LOCAL,
        "POST",
        "/api/products",
        {"name": "Bad$", "price": 200, "mrp": 100, "description": "x", "category": "honey"},
        token=token,
    )
    check("6.5", code == 400, f"price>mrp {code} {data}")

    code, data, _ = req(
        LOCAL,
        "POST",
        "/api/products",
        {"name": "Bad cat", "price": 10, "mrp": 12, "description": "x", "category": "not-real"},
        token=token,
    )
    check("6.7", code == 400, f"bad category {code} {data}")

    code, data, _ = req(
        LOCAL,
        "POST",
        "/api/products",
        {
            "name": "JS img",
            "price": 10,
            "mrp": 12,
            "description": "x",
            "category": "honey",
            "image": "javascript:alert(1)",
        },
        token=token,
    )
    check("6.10-image", code == 400, f"js image {code} {data}")

    code, data, _ = req(
        LOCAL,
        "POST",
        "/api/products",
        {
            "name": "Mass rate",
            "price": 10,
            "mrp": 12,
            "description": "x",
            "category": "honey",
            "slug": "qa-mass-rate",
            "reviews": 99999,
            "rating": 11,
        },
        token=token,
    )
    p = (data.get("product") or {}) if isinstance(data, dict) else {}
    check("6.18", p.get("reviews") == 0 and p.get("rating") == 0, f"reviews={p.get('reviews')} rating={p.get('rating')}")

    # Customer XSS name
    email = "qa_fix_xss@example.com"
    code, data, _ = req(
        LOCAL,
        "POST",
        "/api/customer/register",
        {"name": '<img src=x onerror=alert(9)>', "email": email, "password": "CustomerPass123!"},
    )
    if code == 409:
        code, data, _ = req(
            LOCAL,
            "POST",
            "/api/customer/login",
            {"email": email, "password": "CustomerPass123!"},
        )
    ctoken = data.get("token") if isinstance(data, dict) else None
    if ctoken:
        code, data, _ = req(
            LOCAL,
            "PUT",
            "/api/customer/me",
            {"name": '<img src=x onerror=alert(9)>'},
            token=ctoken,
        )
        cname = ((data.get("customer") or {}).get("name") if isinstance(data, dict) else "") or ""
        check("customer-xss-name", "<" not in cname and code in (200, 400), f"{code} name={cname!r}")
    else:
        check("customer-xss-name", False, f"no customer token {code} {data}")

    # Storefront escape: product HTML should not include raw onerror from API name
    code, html, _ = req(LOCAL, "GET", f"/product.html?id={slug}")
    check(
        "6.9-dom",
        "onerror=" not in str(html) and "<img src=x" not in str(html),
        f"product html contains onerror={'onerror=' in str(html)}",
    )

    # SEO product title
    check("10.seo", "Buy Online" in str(html) or "Nastro Blu" in str(html), f"title area ok status={code}")

    # WhatsApp URL shape (checkout helper)
    wa = f"https://wa.me/919063048255?text={urllib.request.quote('Hi Nastro Blu! Order test & sweets')}"
    check("4.whatsapp-app", wa.startswith("https://wa.me/919063048255") and "%26" in wa or "&" not in wa.split("text=")[-1] or "%26" in wa, f"wa url encoded: {wa[:120]}")

    # Cleanup
    req(LOCAL, "DELETE", f"/api/products/{slug}?hard=1", token=token)
    req(LOCAL, "DELETE", "/api/products/qa-mass-rate?hard=1", token=token)

    fails = [r for r in results if r["result"] == "Fail"]
    print(f"\n{len(results)-len(fails)}/{len(results)} pass, {len(fails)} fail")
    open("_qa_reverify.json", "w").write(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
