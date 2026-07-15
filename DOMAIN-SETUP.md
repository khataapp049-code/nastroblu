# Make nastroblu.in live (and keep it live)

## Why it was down

`nastroblu.in` currently points to Hostinger **DNS parking** (`2.57.91.91` / `dns-parking.com`).  
That parking page returns **403** — so the domain is **not serving** your Nastro Blu site.

Your working site is already live on Netlify:

**https://creative-bublanina-c71f23.netlify.app/**

## Fix (recommended): point domain → Netlify

This is the most reliable way so the site does **not** go down again (Netlify handles uptime/SSL).

### A) In Netlify (Dashboard)

1. Open: https://app.netlify.com/projects/creative-bublanina-c71f23/domain-management  
2. Click **Add domain** → enter `nastroblu.in`  
3. Also add `www.nastroblu.in`  
4. Netlify will show DNS records (usually):

| Type | Name | Value |
|------|------|--------|
| A | `@` | `75.2.60.5` |
| CNAME | `www` | `creative-bublanina-c71f23.netlify.app` |

(Use the exact values Netlify shows for your site.)

### B) In Hostinger (Domain → DNS)

1. Hostinger → Domains → **nastroblu.in** → DNS / DNS Zone  
2. **Remove** parking records pointing to `2.57.91.91` / dns-parking  
3. Add the Netlify A + CNAME records from step A  
4. Wait 5–60 minutes for DNS  

### C) Verify

```bash
dig +short nastroblu.in A
# should become Netlify IP (e.g. 75.2.60.5), NOT 2.57.91.91

curl -I https://nastroblu.in
# should return 200 from Netlify
```

## WhatsApp / link preview

Open Graph tags + `assets/og-image.png` are set so sharing `https://nastroblu.in/` shows:

- Title: **Nastro Blu — Know Your Farmer. Know Your Food.**  
- Description: Hyderabad farm-direct story  
- Image: Nastro Blu logo card  

After DNS works, refresh WhatsApp preview once with:  
https://developers.facebook.com/tools/debug/ → scrape `https://nastroblu.in/`

## Optional later: Hostinger VPS + Mongo admin

Keep public site on Netlify for uptime.  
Run Mongo/admin API on VPS under `api.nastroblu.in` when ready (see `HOSTINGER-VPS.md`).
