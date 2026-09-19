# Hostinger DNS + hosting for nastroblu.in

Your domain is currently on **Hostinger DNS parking** (`apollo.dns-parking.com` → `2.57.91.91`). 
That is why the site is not reachable. Point it to your **Hostinger hosting / VPS** instead.

---

## Step 0 - Pick your Hostinger product

| You have | Use this path |
|----------|----------------|
| **Web / Cloud hosting** (hPanel websites) | **Option A** below |
| **VPS** (full server + Mongo admin) | **Option B** below |

---

## Option A - Hostinger Web / Cloud hosting (static shop)

### A1. Connect domain in hPanel

1. Login: https://hpanel.hostinger.com 
2. **Websites** → **Add website** / **Connect domain** → choose **nastroblu.in** 
3. Open the site **Dashboard** → **Plan Details** 
4. Copy the values shown there:
 - **Nameservers** (ns1… / ns2…) 
 - **Server IP** (for A record method)

### A2. DNS (recommended: Nameservers)

If domain is registered at Hostinger:

1. **Domains** → **nastroblu.in** → **DNS / Nameservers** 
2. Set nameservers to the **exact** ones from Plan Details (not parking) 
3. Save

Typical Hostinger nameservers look like:

```text
ns1.dns-parking.com ❌ parking - do NOT keep these
ns1.Hostinger.com ✅ example only - use YOUR panel values
ns2.Hostinger.com
```

If domain is registered elsewhere (GoDaddy, Namecheap, etc.):

1. At that registrar → Nameservers 
2. Replace with the Hostinger nameservers from Plan Details 
3. Save (propagation up to 24h)

### A3. DNS (alternate: A records)

Only if you keep DNS at Hostinger zone editor and were given a server IP:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| **A** | `@` | `YOUR_HOSTINGER_SERVER_IP` | 300 |
| **A** or **CNAME** | `www` | same IP **or** `nastroblu.in` | 300 |

Delete any old A record for `@` pointing to `2.57.91.91`.

### A4. Upload website files

1. hPanel → **Files** → **File Manager** 
2. Open `public_html` for nastroblu.in 
3. Upload these files/folders from the `nastroblu` project:

```text
index.html
about.html
product.html
styles.css
app.js
products.js
shared.js
product-page.js
assets/
admin/ (UI only - needs API for full save)
```

4. Also upload `.htaccess` (in this repo root) into `public_html`

### A5. SSL

hPanel → **SSL** → enable **Free SSL (Let's Encrypt)** for `nastroblu.in` + `www`.

### A6. Verify

```bash
dig +short nastroblu.in A
# must show YOUR Hostinger server IP (not 2.57.91.91)

curl -I https://nastroblu.in
# expect HTTP/2 200
```

---

## Option B - Hostinger VPS (shop + MongoDB admin)

Use this if you want `/admin` to save products to MongoDB.

### B1. Get VPS IP

hPanel → **VPS** → your server → copy **IP address**.

### B2. DNS A records (Hostinger DNS zone)

**Domains** → **nastroblu.in** → **DNS / DNS Zone Editor**:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| **A** | `@` | `YOUR_VPS_IP` | 300 |
| **A** | `www` | `YOUR_VPS_IP` | 300 |

Delete parking A (`2.57.91.91`).

If nameservers are still `apollo.dns-parking.com` / `athena.dns-parking.com`, first switch nameservers to Hostinger’s active ones for your account, **or** manage DNS zone after connecting the domain to the VPS DNS Manager.

### B3. Deploy app on VPS

```bash
# from your Mac
scp -r nastroblu root@YOUR_VPS_IP:/var/www/nastroblu

ssh root@YOUR_VPS_IP
cd /var/www/nastroblu
chmod +x deploy/hostinger-setup.sh
./deploy/hostinger-setup.sh
```

Details: [`HOSTINGER-VPS.md`](./HOSTINGER-VPS.md)

Admin after deploy:

- https://nastroblu.in/admin/ 
- `admin@nastroblu.in` / password from VPS `.env`

---

## WhatsApp link preview

OG tags are already in `index.html` using:

- Title / description 
- Image: `https://nastroblu.in/assets/og-image.png`

After DNS + SSL work, scrape once:

https://developers.facebook.com/tools/debug/ → `https://nastroblu.in/`

---

## Checklist

- [ ] Domain connected to Hostinger hosting or VPS 
- [ ] Nameservers / A records no longer parking (`2.57.91.91` gone) 
- [ ] Files in `public_html` (shared) **or** Docker running on VPS 
- [ ] Free SSL enabled 
- [ ] https://nastroblu.in opens 
- [ ] WhatsApp preview scraped 

---

## Need from you (so we can finish remotely)

Reply with:

1. Hostinger type: **Web hosting** or **VPS** 
2. **Server IP** from hPanel (Plan Details / VPS) 
3. Nameservers shown in Plan Details (copy/paste)

Then we can confirm exact DNS rows and finish deploy.
