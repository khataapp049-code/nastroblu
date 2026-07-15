# Nastro Blu — Eat Better

Shop + MongoDB admin for [nastroblu.in](https://nastroblu.in) / Hostinger VPS.

## Quick links

- **Hostinger VPS deploy (MongoDB + admin):** see [`HOSTINGER-VPS.md`](./HOSTINGER-VPS.md)
- **Admin panel:** `/admin/` after deploy
- **Default admin:** `admin@nastroblu.in` / `NastroBlu@Admin2026` (change in `.env`)

## Local static preview

```bash
python3 -m http.server 5173
```

## Local full stack (Mongo + admin)

```bash
docker compose up -d --build
# Shop http://localhost:4000
# Admin http://localhost:4000/admin/
```

Or:

```bash
docker compose up -d mongo
cd server && cp .env.example .env && npm install && npm run seed && npm run dev
```

## Admin can edit

- Product name
- Description
- MRP + selling price
- Quantity / weight, SKU, barcode
- Ingredients, packaging text, dates

Changes save to **MongoDB** and appear on the storefront via `/api/products`.
