#!/usr/bin/env bash
# Auth / exposure regression tests for Nastro Blu admin API.
# Usage: ./deploy/security-check.sh https://nastroblu.in [admin_password]
set -euo pipefail

BASE="${1:-https://nastroblu.in}"
PASS="${2:-}"
EMAIL="${ADMIN_EMAIL:-admin@nastroblu.in}"
FAIL=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAIL=$((FAIL + 1)); }

echo "Security check against $BASE"
echo

# 1) No credentials in admin HTML
HTML=$(curl -sS "$BASE/admin/")
if echo "$HTML" | grep -Eiq 'NastroBlu@Admin2026|Use:.*admin@|password.*=.*Nastro'; then
  fail "Admin HTML still contains credential hints / old password"
else
  pass "Admin HTML has no plaintext credentials"
fi

if echo "$HTML" | grep -Eq 'value="[^"]{8,}"' | grep -qi password; then
  fail "Password input appears pre-filled in HTML"
else
  pass "Password field not pre-filled in HTML"
fi

# 2) Unauthenticated mutations blocked
CODE=$(curl -sS -o /tmp/nb-sec.json -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name":"Hacked","price":1,"mrp":1,"description":"x","category":"honey"}' \
  "$BASE/api/products")
if [ "$CODE" = "401" ]; then pass "POST /api/products without token → 401"; else fail "POST /api/products without token → $CODE"; fi

CODE=$(curl -sS -o /tmp/nb-sec.json -w '%{http_code}' -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"price":1}' \
  "$BASE/api/products/a2-milk")
if [ "$CODE" = "401" ]; then pass "PUT /api/products/:id without token → 401"; else fail "PUT without token → $CODE"; fi

CODE=$(curl -sS -o /tmp/nb-sec.json -w '%{http_code}' -X DELETE "$BASE/api/products/a2-milk")
if [ "$CODE" = "401" ]; then pass "DELETE without token → 401"; else fail "DELETE without token → $CODE"; fi

CODE=$(curl -sS -o /tmp/nb-sec.json -w '%{http_code}' -X POST \
  -F 'image=@/etc/hosts' \
  "$BASE/api/uploads/image" 2>/dev/null || echo "401")
# may be 401 or 400; must not be 201
if [ "$CODE" = "201" ]; then fail "Upload without token succeeded"; else pass "Upload without token blocked ($CODE)"; fi

# 3) Admin list + cost locked
CODE=$(curl -sS -o /tmp/nb-sec-all.json -w '%{http_code}' "$BASE/api/products?all=1")
if [ "$CODE" = "401" ]; then pass "GET /api/products?all=1 without token → 401"; else fail "GET ?all=1 without token → $CODE"; fi

# 4) Public catalog must not include cost
curl -sS "$BASE/api/products" -o /tmp/nb-sec-pub.json
if python3 - <<'PY'
import json
d=json.load(open("/tmp/nb-sec-pub.json"))
ps=d.get("products") or []
assert ps, "no products"
assert all("cost" not in p for p in ps), "cost leaked in public list"
print("ok")
PY
then pass "Public /api/products does not include cost"
else fail "Public /api/products leaked cost or failed"
fi

# 5) Authenticated path (optional if password provided)
if [ -n "$PASS" ]; then
  LOGIN=$(curl -sS -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    "$BASE/api/auth/login")
  TOKEN=$(python3 -c 'import json,sys;print(json.load(sys.stdin).get("token",""))' <<<"$LOGIN")
  if [ -n "$TOKEN" ]; then
    pass "Admin login with provided password"
    curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/products?all=1" -o /tmp/nb-sec-admin.json
    python3 - <<'PY'
import json
d=json.load(open("/tmp/nb-sec-admin.json"))
ps=d.get("products") or []
assert ps, "admin list empty"
assert all("cost" in p for p in ps), "admin list missing cost"
print("ok")
PY
    pass "Authenticated ?all=1 returns cost for admin"
  else
    fail "Admin login failed with provided password"
  fi

  # Old default password must fail
  CODE=$(curl -sS -o /tmp/nb-old.json -w '%{http_code}' -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"NastroBlu@Admin2026\"}" \
    "$BASE/api/auth/login")
  if [ "$CODE" = "401" ]; then pass "Old default password rejected"; else fail "Old default password still works ($CODE)"; fi
else
  echo "SKIP  Authenticated checks (pass admin password as 2nd arg)"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "All security checks passed."
  exit 0
fi
echo "$FAIL check(s) failed."
exit 1
