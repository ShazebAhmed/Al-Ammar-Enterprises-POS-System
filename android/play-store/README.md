# Publishing Al Ammar Store on Google Play

Everything needed for the Play Console listing. Upload `android/dist/AlAmmarStore.aab`
(build it with `android/build-apks.ps1`). The admin app is **not** published on Play; share
`AlAmmarAdmin.apk` privately.

## Files in this folder

| Play Console field | File |
| --- | --- |
| App icon (512 × 512) | `icon-512.png` |
| Feature graphic (1024 × 500) | `feature-graphic.png` |
| Phone screenshots (1080 × 1920) | `screenshots/1-home.png` … `5-delivery.png` |

Regenerate the icon and graphic with `scripts/brand-assets.ps1`.

## Store listing

- **App name:** Al Ammar Store
- **Short description (80 max):** Everyday essentials delivered across Pakistan. Pay cash on delivery.
- **Category:** Shopping
- **Website:** https://alammarstore.vercel.app
- **Privacy policy:** https://alammarstore.vercel.app/policies/privacy
- **Full description:**

  > Al Ammar Store brings everyday essentials to your door, anywhere in Pakistan.
  >
  > • Browse groceries, home and kitchen, fashion, electronics, beauty and more
  > • Swipe through product photos and see what is in stock
  > • Add to your basket, or tap Buy now to order one item straight away
  > • Get a notification when your order is confirmed, sent and delivered
  > • Pay cash on delivery. No card needed
  > • One delivery charge per order, shown before you order
  > • We call to confirm every order before it is sent
  > • Prefer WhatsApp? Order on WhatsApp straight from the product or basket
  > • Sign in to see your orders and download your bill as a PDF
  > • Easy returns and exchanges. See our returns policy in the app
  >
  > Questions? Message us on WhatsApp from the app.

## App content (policy) answers

- **Privacy policy URL:** https://alammarstore.vercel.app/policies/privacy
- **Ads:** No, the app contains no ads.
- **App access:** All functionality is available without special access. Browsing and ordering work without an account. (If asked, you can give a test customer account.)
- **Target audience:** 18 and over (the app sells general products and takes orders).
- **Content rating (IARC questionnaire):** category "Shopping" / reference app; answer No to violence, sexual content, language, controlled substances, gambling. Users can interact? No chat between users. Shares location? No. Allows purchases of digital goods? No (physical goods, paid on delivery).
- **News app / COVID / Government:** No.
- **Account deletion:** Yes, users can create an account.
  - In-app: Your account → Delete my account
  - Web link: https://alammarstore.vercel.app/policies/delete-account

## Data safety answers

Does the app collect or share user data? **Yes, collects** (not shared except with service providers, which Play does not count as sharing).

| Data type | Collected | Why | Optional? |
| --- | --- | --- | --- |
| Name | Yes | App functionality (orders, account) | Required to order |
| Email address | Yes | Account management | Only for accounts |
| Phone number | Yes | App functionality (delivery confirmation) | Required to order |
| Address (physical) | Yes | App functionality (delivery) | Required to order |
| Purchase history | Yes | App functionality (order history) | Required |
| Other user-generated content (reviews) | Yes | App functionality | Optional |
| Device or other IDs (push notification address) | Yes | App functionality (order status notifications) | Optional (only if notifications are allowed) |

- Encrypted in transit: **Yes** (HTTPS only).
- Users can request deletion: **Yes** (in-app and the web link above).
- No location, contacts, photos, financial/card info or advertising data are collected.
- The app asks for the notifications permission (Android 13+) the first time it opens.

## Step by step

1. Create a Google Play developer account (one-time USD 25) at https://play.google.com/console with your own details. Personal accounts must verify identity.
2. Create app → "Al Ammar Store", default language English, App, Free.
3. Fill the store listing, app content and data safety as above.
4. Testing → **Closed testing**: new personal accounts must run a closed test with at least 12 testers for 14 days before production. Upload `AlAmmarStore.aab`, add testers' Gmail addresses, and ask them to install from the test link.
5. When Play asks about app signing, keep **Play App Signing** on. Then open *Setup → App signing*, copy the **App signing key certificate SHA-256**, and add it to `public/.well-known/assetlinks.json` (next to the upload key's fingerprint) for `com.alammar.store`. Without this the Play-installed app shows a browser address bar.
6. After 14 days, apply for production access and roll out.

## Keys

- Upload key: `android/signing/alammar-release.keystore` with `android/keystore.properties` (not in Git; backup zip on the owner's Google Drive).
- SHA-256: `9A:C9:92:DC:42:2D:B5:F5:D8:64:76:BB:8F:27:4C:4A:60:3D:2F:63:C1:B7:A9:C2:94:58:C7:3A:03:28:0F:49`
- Never create a new key for this app: Play only accepts updates signed with this one.
