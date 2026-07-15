# Hostinger VPS — nastroblu.in + MongoDB + Admin

This guide deploys the Nastro Blu storefront, MongoDB product database, and admin panel on a **Hostinger VPS**.

## What you get

| URL | Purpose |
|-----|---------|
| `https://nastroblu.in/` | Public shop |
| `https://nastroblu.in/admin/` | Admin login — add/edit products, description, MRP |
| `https://nastroblu.in/api/products` | Product API (MongoDB) |
| `https://nastroblu.in/api/health` | Health check |

## Default admin (change after first login)

- **Email:** `admin@nastroblu.in`
- **Password:** `NastroBlu@Admin2026`

Set your own values in `.env` on the VPS (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`).

---

## 1) DNS on Hostinger

In Hostinger DNS for **nastroblu.in**:

| Type | Name | Value |
|------|------|--------|
| A | `@` | your VPS public IP |
| A | `www` | your VPS public IP |

Wait until DNS resolves before SSL.

---

## 2) Upload the site to the VPS

From your laptop (replace IP):

```bash
scp -r "/Users/akshaysharma/Downloads/gi-commerce-development 9/nastroblu" root@YOUR_VPS_IP:/var/www/nastroblu
```

Or zip + upload via Hostinger file manager / SFTP into `/var/www/nastroblu`.

---

## 3) Run the setup script (recommended)

SSH into the VPS:

```bash
ssh root@YOUR_VPS_IP
cd /var/www/nastroblu
chmod +x deploy/hostinger-setup.sh
./deploy/hostinger-setup.sh
```

This installs Docker + Nginx, starts **MongoDB + API**, and configures `nastroblu.in`.

---

## 4) Manual Docker start (if you skip the script)

```bash
cd /var/www/nastroblu
cp server/.env.example .env
# edit .env — set strong JWT_SECRET + ADMIN_PASSWORD

docker compose up -d --build mongo api

# Nginx host config
cp deploy/nginx.nastroblu.in.conf /etc/nginx/sites-available/nastroblu.in
ln -sf /etc/nginx/sites-available/nastroblu.in /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d nastroblu.in -d www.nastroblu.in
```

---

## 5) Admin: add / edit products

1. Open `https://nastroblu.in/admin/`
2. Login with admin email/password
3. Click **+ Add product** or select a product
4. Edit **name, description, MRP, selling price, SKU, quantity**, etc.
5. **Save product** — storefront updates from MongoDB

Archived products are hidden from the public shop.

---

## 6) MongoDB details (on this VPS)

Docker Compose runs MongoDB as service `mongo`:

- **URI (inside Docker network):** `mongodb://mongo:27017/nastroblu`
- **URI (from VPS host):** `mongodb://127.0.0.1:27017/nastroblu`
- **Database:** `nastroblu`
- **Collections:** `products`, `admins`
- **Volume:** `nastroblu_mongo` (persists data across restarts)

Useful commands:

```bash
cd /var/www/nastroblu
docker compose ps
docker compose logs -f api
docker compose exec api node src/seed.js          # re-seed catalog + sync admin password from .env
docker compose exec mongo mongosh nastroblu
```

Inside `mongosh`:

```js
db.products.countDocuments()
db.products.find({}, { name: 1, mrp: 1, price: 1, sku: 1 }).limit(5)
```

---

## 7) Local development (optional)

```bash
cd nastroblu
docker compose up -d mongo
cd server && cp .env.example .env && npm install
npm run seed
npm run dev
```

- Shop: http://localhost:4000/
- Admin: http://localhost:4000/admin/

---

## Security checklist

- [ ] Change `ADMIN_PASSWORD` and `JWT_SECRET` in `.env`
- [ ] Restrict MongoDB port `27017` in Hostinger firewall (keep it private / localhost only)
- [ ] Keep only `80` / `443` open publicly
- [ ] Re-run `docker compose up -d --build api` after code updates

---

## Update / redeploy

```bash
cd /var/www/nastroblu
# upload new files, then:
docker compose up -d --build api
```
