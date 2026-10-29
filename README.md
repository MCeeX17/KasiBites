# Kasi Bites 🍔🔥

Self-order kiosk + kitchen portal. Plain HTML + CSS + JavaScript (no build step), Firebase backend, hosted free on GitHub Pages.

## Files
- `index.html` – the page · `css/styles.css` – styles · `js/app.js` – all logic
- `js/config.js` – Firebase keys, admin Google emails, site URL
- `js/data.js` – default menu, kota ingredients, specials, hours
- `firestore.rules` – database security rules · `assets/` – logo + icons

## Setup (10 minutes)
1. **Firebase Console → Build → Firestore Database → Create database** (production mode).
2. **Authentication** – Email, Google and Anonymous are already enabled. Also open *Authentication → Settings → Authorized domains* and add `YOURNAME.github.io`.
3. Edit `ADMIN_EMAILS` in `js/config.js` **and** the email list in `firestore.rules` (same Google account(s)).
4. **Firestore → Rules** → paste the contents of `firestore.rules` → Publish.
5. Set `SITE_URL` in `js/config.js` to your live address, e.g. `https://yourname.github.io/kasi-bites/` (used in the WhatsApp rating link and the QR flyer).
6. Push to GitHub → *Settings → Pages → Deploy from branch → main / root*.

> It must be opened over `http(s)` (GitHub Pages or a local server such as `npx serve`). Double-clicking `index.html` will not work because it uses JavaScript modules.

## Using it
- **Kitchen terminal:** tap the logo in the footer 3 times → Sign in with Google.
- **Menu & Prices tab:** search, switch items ON/OFF, edit prices (meals, kota ingredients, specials).
- **WhatsApp button:** sends "ready" message + a link like `…/?rate=KB-7F2K9Q`. The customer opens it and rates each meal they ordered.
- **Photos later:** add `image: 'assets/food/kota.jpg'` to any item in `js/data.js` and it replaces the emoji.
