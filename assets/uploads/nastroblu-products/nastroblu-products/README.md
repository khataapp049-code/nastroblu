# Nastro Blu - Product Catalog

Complete product catalog for the Nastro Blu website (142 products), extracted from the
Nastro Blu app catalog screenshots on 15 Jul 2026. Prices shown in the app are used as MRP (INR).

## What's in this folder

| Path | What it is |
|---|---|
| `products.json` | Master catalog - every product with id, name, pack size, MRP, category, description, ingredients and image path. **Use this as the single source of truth.** |
| `products.csv` | Same data as a spreadsheet-friendly CSV. |
| `images/` | One image per product, named by slug (e.g. `kaju-katli-250g.jpg`). |
| `products/<slug>/` | One folder per product containing `product.md` (name, MRP, category, description) and `image.jpg`. |

## Categories

| Category | Products |
|---|---|
| Sweets (delivery 12-24 Hrs) | 51 |
| Snacks (delivery 12-24 Hrs) | 12 |
| Naturally Grown Farm Products | 42 |
| Kerala Naturally Grown Product | 12 |
| Kashmiri Dry Fruits & More | 8 |
| Dairy Products | 2 |
| Cold Pressed Oil | 6 |
| Pickles | 3 |
| Summer Special Squashes | 5 |
| Gift Hampers | 1 |

## Using this in Cursor

Point Cursor at `products.json` - it has everything needed to generate product pages,
cards or a catalog grid. Each record's `image` path resolves inside this folder.
Example prompt: *"Using products.json in the nastroblu-products folder, generate a product
listing page grouped by category, with image, name, pack size, MRP and description per card."*

## Things to review before publishing

- **Mava Chocolate Barfi** - App also lists 'Mava Choco Barfi' - possibly the same SKU; verify.
- **Mava Choco Barfi** - Possibly a duplicate of 'Mava Chocolate Barfi' - verify before publishing.
- **Special Chena Mango Sweets** - Available on order (as listed in app).
- **Chanoli** - Could not identify this item precisely from the screenshot - please review the description.
- **Gift Hamper** - Price depends on customisation - shown in app without a fixed MRP.
- **Images are 240x240 px** thumbnails cropped from app screenshots - fine for cards, too small
 for full-width hero sections. Swap in original photos when available (keep the same filenames).
- **Ingredients ending with "…"** were truncated in the app UI itself; the full list wasn't visible.
- Descriptions were freshly written for the website from the visible app data.
