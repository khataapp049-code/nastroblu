# Hostinger - make nastroblu.in live

## Current problem
DNS is on **parking** (`2.57.91.91`). Fix DNS in Hostinger, then upload the site.

## Full guides
- **DNS + hosting steps:** [`HOSTINGER-DNS.md`](./HOSTINGER-DNS.md)
- **VPS + Mongo admin:** [`HOSTINGER-VPS.md`](./HOSTINGER-VPS.md)

## Fast path (Web hosting)

1. hPanel → connect **nastroblu.in** to your hosting plan 
2. Set Hostinger nameservers (from Plan Details) - leave parking 
3. Upload site files to `public_html` (include `.htaccess`) 
4. Enable Free SSL 

## Fast path (VPS)

1. DNS A `@` + `www` → your **VPS IP** 
2. Run `deploy/hostinger-setup.sh` on the VPS 

## WhatsApp preview
Works after https://nastroblu.in is live (OG tags + `assets/og-image.png` included).
