#!/usr/bin/env bash
# Hostinger VPS bootstrap for nastroblu.in
# Run as root on Ubuntu 22.04/24.04 VPS after uploading the nastroblu folder.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nastroblu}"
DOMAIN="${DOMAIN:-nastroblu.in}"

echo "==> Installing Docker + Nginx + Certbot"
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> App directory: $APP_DIR"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -f .env ]; then
  ADMIN_PASS="$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-20)!Aa1"
  cat > .env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@nastroblu.in
ADMIN_PASSWORD=${ADMIN_PASS}
CORS_ORIGIN=https://nastroblu.in,https://www.nastroblu.in
EOF
  chmod 600 .env
  echo "Created .env with a random ADMIN_PASSWORD (shown once below)."
  echo "  ADMIN_EMAIL=admin@nastroblu.in"
  echo "  ADMIN_PASSWORD=${ADMIN_PASS}"
  echo "Store this password securely — it is not printed again."
fi

echo "==> Starting MongoDB + API"
docker compose up -d --build mongo api

echo "==> Configuring Nginx for $DOMAIN"
cp deploy/nginx.nastroblu.in.conf /etc/nginx/sites-available/nastroblu.in
ln -sf /etc/nginx/sites-available/nastroblu.in /etc/nginx/sites-enabled/nastroblu.in
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

echo "==> Requesting SSL (ensure DNS A records point to this VPS first)"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN" || \
  echo "Certbot skipped/failed — run manually after DNS propagates."

echo ""
echo "Done."
echo "Storefront: https://$DOMAIN"
echo "Admin:      https://$DOMAIN/admin/"
echo "Login:      admin@nastroblu.in  (password only in $APP_DIR/.env — never commit it)"
echo ""
echo "Useful:"
echo "  cd $APP_DIR && docker compose logs -f api"
echo "  cd $APP_DIR && docker compose exec api node src/seed.js"
