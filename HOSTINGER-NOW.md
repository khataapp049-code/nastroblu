# Do this now in Hostinger (nastroblu.in)

Domain is registered at **Hostinger** but still on **DNS parking**.
I cannot change DNS without your Hostinger login. Upload pack is ready.

## 1. Connect hosting (2 minutes)

1. Open: https://hpanel.hostinger.com  
2. **Websites** → **Add website** → use existing domain **nastroblu.in**  
   (or open the website already linked to this domain)

## 2. Fix nameservers (required)

1. **Domains** → **nastroblu.in** → **DNS / Nameservers**  
2. Change from parking:

```text
apollo.dns-parking.com   ← remove
athena.dns-parking.com   ← remove
```

3. Set **Hostinger nameservers** shown under that website’s **Plan Details**  
   (usually look like `ns1.dns-parking.com` is wrong — use the ones Hostinger lists for *hosting*, often `ns1.Hostinger.com` / `ns2.Hostinger.com` or plan-specific NS).

If the UI has **“Connect domain” / “Use Hostinger nameservers”**, click that.

## 3. Upload the site

1. Open **File Manager** → `public_html`  
2. Delete default `index.html` / `default.php` if present  
3. Upload: **`/Users/akshaysharma/Downloads/nastroblu-hostinger-public_html.zip`**  
4. Extract into `public_html` so you see `index.html` and `.htaccess` at the root of `public_html`  
   (not inside an extra nested folder — if you see `nastroblu-hostinger-upload/`, move those files up one level)

## 4. SSL

**SSL** → enable **Free SSL** for `nastroblu.in` and `www`.

## 5. Done when

- https://nastroblu.in opens the shop  
- A record is **not** `2.57.91.91`

---

After you finish steps 1–2, reply with a screenshot of **Plan Details** (IP + nameservers) or paste them here and I will verify DNS.
