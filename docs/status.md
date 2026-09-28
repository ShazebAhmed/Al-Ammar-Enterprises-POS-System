# Project status and working notes

Written 28 September 2026 so work can continue from another computer. The owner
writes in Urdu or Roman Urdu; reply in Urdu.

## Live

- Site: https://alammarstore.vercel.app (Vercel, deploys from `main`; functions in
  `hnd1` Tokyo, next to the Supabase database in Tokyo).
- Database: Supabase project `ehxsrytdzyyyhsgbjccu`. All migrations up to
  `202609280011_product_options.sql` are applied. New migrations are applied in the
  Supabase SQL Editor (owner approval first); destructive-looking statements such as
  `drop trigger if exists` show a confirmation dialog that must be accepted.
- Features added on 28 September: order tracking (`/track`), sale price and discount
  codes (admin Discounts tab), order notifications (Web Push via pg_net ->
  `/api/push`; admin "Turn on alerts", customer "Notify me about this order"),
  product options with their own stock (admin product form).

## Android apps

- `android/` builds two Trusted Web Activity apps (store, admin) with
  `android/build-apks.ps1`. Current version 1.2.0 (notification delegation), release
  `android-v1.2.0` on GitHub.
- Signing key: `android/signing/alammar-release.keystore` + `android/keystore.properties`
  are not in Git. The owner keeps the backup zip on Google Drive
  ("AlAmmar-Signing-Backup"). Never create a new key; Play only accepts this one.
- After uploading to Google Play, add Play's app-signing SHA-256 to
  `public/.well-known/assetlinks.json`.

## Setting up another Windows computer

1. Install Git, Node.js 20+, GitHub CLI (`gh auth login`) and the Claude desktop app.
2. `git clone https://github.com/ShazebAhmed/Al-Ammar-Store` and `npm install`;
   `npm test` must pass.
3. For app builds: Android Studio (SDK platform 36), then restore the signing key from
   the Drive backup into `android/`; `build-apks.ps1` downloads JDK 17 and Gradle.
4. For the emulator: enable virtualization in the BIOS, create a Pixel AVD with an
   android-36 Google Play image.

## Not done yet

- Emulator check of the new features (discount code at checkout, choosing an option,
  a real notification on a phone).
- `/track` does not yet show the discount line, the chosen option or a "notify me"
  button.
