# Upgrade audit

Source reviewed against main commit `60ddb4f88c2454ec7455036e414cd4c1fbf6db8c`. No production Supabase credentials, schema export or customer data were available. Findings below describe source behavior; they are not proof of a production breach.

## Implemented

| Area                  | Finding and change                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout integrity    | Browser-created orders trusted submitted totals. Added an RPC and database trigger to calculate totals, lock stock, reject invalid quantities and roll back the entire order on failure.                                                                    |
| Duplicate submissions | Added a persisted request token and database uniqueness/advisory locking for retries.                                                                                                                                                                       |
| Access boundaries     | Frontend admin visibility is insufficient authorization. Added restrictive RLS guards for orders, profiles, products, settings, carts and reviews, plus a guard against self-assigned admin status. Actual legacy policies still need staging verification. |
| Basket                | Added immutable quantity helpers, cents-based totals, per-account caching, one-time guest merge, serialized account sync and a retry state that blocks edits after a failed initial basket load.                                                            |
| Stock                 | Quantity controls respect stock; unavailable lines remain removable. Server-side checkout is authoritative. Cancellation restores reserved stock once.                                                                                                      |
| Admin reporting       | Replaced misleading profit reporting with delivered revenue; weekly order value excludes cancellations. Lists load in batches. Search, status filtering and mutation error feedback added.                                                                  |
| Experience            | Rebuilt homepage, header/footer, product cards, basket, checkout, authentication and admin layout using emerald, ivory and gold. Added responsive layouts, loading/error/empty states, reduced-motion handling and receipt printing.                        |
| Accessibility         | Added named icon controls, form labels on rebuilt flows, skip link, live feedback and product-editor keyboard focus handling. A complete screen-reader audit remains outstanding.                                                                           |
| Resilience            | Missing configuration fails visibly; auth/account errors are handled; recovery flow preserves session; product uploads and video URLs are validated.                                                                                                        |
| Maintenance           | Added shared catalogue/cart helpers, lockfile, formatting, automated tests and CI. Sitemap reads catalogue pages instead of silently stopping at the first page.                                                                                            |

## Verification and limits

Automated tests cover cart normalization/merging/quantities/customer validation, authoritative order totals, stock rollback, duplicate requests, access isolation, profile privilege escalation and cancellation. Database tests run against a representative PGlite schema. A successful build verifies compilation, not a live Supabase integration.

The deployed homepage, basket error state and sign-in layout have now been inspected in the desktop browser after Vercel authentication. See [browser QA](browser-qa.md) for evidence and the database connection blocker. Required before release: real-schema migration trial, mobile browser review, data-backed product and admin review, login and password recovery, product upload, guest/authenticated checkout, order-history isolation and admin status transitions.

## Follow-up work

- Public guest checkout and anonymous reviews need an abuse-control design (rate limits, CAPTCHA and review moderation). Their current endpoints can be spammed. Stock reservation also needs an agreed expiry/cancellation process for abandoned COD orders.
- Check existing database triggers, functions, views, grants and storage policies. These were unavailable and can affect security or duplicate stock deductions.
- Account basket sync uses the latest local snapshot, not a conflict-resolution protocol across multiple devices/tabs. Guest baskets remain device-local.
- Manually editing stock in admin can overwrite concurrent changes; use an inventory adjustment ledger/RPC if multiple operators manage stock.
- Admin pages still load complete datasets in batches; large stores should use server pagination and aggregate reporting queries.
- Product imagery uses ordinary image elements; benchmark real assets and configure optimized delivery once the production image host is known.
- No payment gateway, tax/accounting ledger, refunds, barcode sales or POS hardware support is introduced by this upgrade.
