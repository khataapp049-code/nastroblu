# Nastro Blu - Eat Better

Shop + MongoDB admin for [nastroblu.in](https://nastroblu.in) / Hostinger VPS.

## Quick links

- **Hostinger VPS deploy:** [`HOSTINGER-VPS.md`](./HOSTINGER-VPS.md)
- **Admin panel:** `/admin/` (requires server-side login; credentials live only in `.env`)

## Security

- Never put admin passwords in HTML, JS, or docs.
- `.env` is gitignored. Use `.env.example` for placeholders only.
- Product **cost** is returned only to authenticated admins.
- `GET /api/products?all=1` and mutating APIs require a JWT.
- Run `./deploy/security-check.sh https://nastroblu.in` after deploy.

If an old default password was ever published, rotate `ADMIN_PASSWORD` and `JWT_SECRET` immediately.

## Local full stack

```bash
cp .env.example .env # set strong JWT_SECRET + ADMIN_PASSWORD
docker compose up -d --build
```

## Admin can edit

- Product name, description, tags, sort order
- MRP, selling price, **cost** (admin-only)
- Availability, images (upload), packaging fields

Changes save to MongoDB and appear on the storefront via `/api/products`.
