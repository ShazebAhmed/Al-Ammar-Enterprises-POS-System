# Project status and working notes

Updated 28 September 2026 so work can continue from another computer. The owner
writes in Urdu or Roman Urdu; reply in Urdu.

## Live

- Site: https://alammarstore.vercel.app (Vercel, deploys from `main`; functions in
  `hnd1` Tokyo, next to the Supabase database in Tokyo). Admin panel:
  https://alammar-admin.vercel.app/admin (same Vercel project, see Notifications).
- Database: Supabase project `ehxsrytdzyyyhsgbjccu`. All migrations up to
  `202609290015_policy_cleanup.sql` are applied. New migrations are applied in
  the Supabase SQL Editor; the owner has approved running them without asking each
  time (report which one ran). Destructive-looking statements show a confirmation
  dialog that must be accepted.
- Features: order tracking (`/track`, with discount line and chosen option), sale
  price and discount codes (admin Discounts tab), order notifications, product
  options with their own stock, "Buy now" (checks out one item without touching the
  basket: `/checkout?buy=1`).

## Notifications

- Web Push: an order trigger queues a message in `push_outbox`, pg_net calls
  `/api/push`, which sends it (VAPID key made by the admin's first "Turn on alerts").
- The admin panel has its own address so its alerts are separate from the shop's:
  `middleware.js` sends `/admin` there and shop pages back to the shop (only on the two
  live addresses). Its Supabase Auth redirect URL is added.
- New-order alerts go only to admin devices; status updates only to devices following
  that order or the customer's account. A device is never both (migration 0013).
- The apps ask to allow notifications when first opened (Android 13+), and
  `NotifyButton` then turns updates on by itself: after ordering (signed in: the whole
  account; guest: that order), on `/track`, `/account` and in the admin panel. The
  button only shows where notifications are not allowed yet (for example a browser).
- Admin: "Send test alert"; tapping a new-order alert opens that order.
- Checked end to end: owner's phone (vivo V30, Android 16, Chrome 154) got the admin
  test alert as Al Ammar Admin; emulator (Pixel 8, Android 16) with Store 1.4.0 asked
  on first open, followed an order by itself and showed the status update as Al
  Ammar Store.

## Android apps

- `android/` builds two Trusted Web Activity apps (store, admin) with
  `android/build-apks.ps1`. Current version 1.4.0, release `android-v1.4.0` on GitHub.
- `AppLauncherActivity` (main manifest) asks for notifications on first open, then
  opens the site. Each app claims its own address's links (`src/store`, `src/admin`
  manifests): Chrome only shows a site's notifications as an app's when that app
  handles the site's links.
- If an app was ever opened before its address verified, Chrome remembers that; the fix
  on a phone is to force-stop Chrome and reopen, or reinstall the app.
- Signing key: `android/signing/alammar-release.keystore` + `android/keystore.properties`
  are not in Git. The owner keeps the backup zip on Google Drive
  ("AlAmmar-Signing-Backup"). Never create a new key; Play only accepts this one.
- After uploading to Google Play, add Play's app-signing SHA-256 to
  `public/.well-known/assetlinks.json` (see `android/play-store/README.md`).

## Setting up another Windows computer

1. Install Git, Node.js 20+, GitHub CLI (`gh auth login`) and the Claude desktop app.
2. `git clone https://github.com/ShazebAhmed/Al-Ammar-Store` and `npm install`;
   `npm test` must pass.
3. For app builds: Android Studio, then SDK platform 36 (the SDK command line is now
   `cmdline-tools/latest/bin/android.exe sdk install platforms/android-36`); restore the
   signing key from the Drive backup into `android/`; `build-apks.ps1` downloads JDK 17
   and Gradle.
4. For the emulator: virtualization on (WHPX works with Hyper-V on), then
   `android.exe sdk install system-images/android-36/google_apis_playstore/x86_64` and
   an AVD (`Pixel_8_API_36` on the second PC).

## Not done yet (needs the owner)

- More products (admin → Add product; "Old price" for a sale, "Add option" for sizes or
  colours).
- A first discount code (admin → Discounts).
- Google Play: developer account, closed test with 12 testers for 14 days, then Play's
  app-signing SHA-256 in `assetlinks.json`.
- Test orders from 28 September: AA-10005 and AA-10006 were cancelled (stock returned).
  AA-10007 was a test marked Delivered, so it counts in "Delivered sales".
- iPhone: notifications need the site added to the Home Screen (the notify button
  shows a hint there); not yet tried on a real iPhone.
