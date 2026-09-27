# Staging and release

This is a coordinated frontend/database change. Applying the migration blocks the old direct-insert checkout. Deploying only the new frontend leaves the checkout RPC missing. Plan a short checkout maintenance window for production.

1. Back up the database and save the existing policy/function definitions. Create a staging database with the real schema and anonymized representative data. Check the expected columns in README, especially JSONB order items, text order IDs, product IDs and existing stock/order triggers. Do not run two stock-deduction triggers.
2. Check for duplicate cart pairs with `select customer_id, product_id, count(*) from public.cart_items group by 1,2 having count(*) > 1;`. Resolve duplicates with an approved data migration before creating the unique index. Check legacy negative/null prices, stock and shipping; the upgrade does not silently rewrite historical values.
3. Apply `supabase/migrations/202609270001_secure_store_orders.sql` once to staging as the database owner. The transaction rolls back if a schema assumption fails. Do not treat this as a fresh-schema bootstrap or rerun it blindly after success.
4. Confirm row 1 of store_settings exists; signup creates non-admin profiles; the intended admin is explicitly assigned through a trusted database operation; `product-images` has public reads and admin-only writes. The migration adds restrictive storage guards, not missing permissive upload policies.
5. Configure a preview deployment with the staging Supabase public URL/key and its own site URL. Add that URL to Supabase Auth allowed redirects. Never use a service-role key in the frontend. Confirm password recovery returns to `/reset-password`.
6. Test desktop and mobile: browse/search/filter, product details, add/remove basket items, refresh, guest-to-account merge, auth/recovery, failed-load retry, checkout, timeout retry, insufficient stock, receipt, account history, image upload and admin lifecycle. Use two accounts to verify isolation. Use simultaneous requests against real PostgreSQL to confirm stock locking under concurrency.
7. Check historical order statuses. The migration allows Pending → Confirmed/Cancelled, Confirmed → Shipped/Cancelled and Shipped → Delivered. Existing terminal or custom statuses require an agreed transition policy. Cancellation of historical orders does not adjust inventory automatically.
8. After staging sign-off, pause checkout, back up production, apply the migration and deploy the matching frontend together. Reopen checkout after a production smoke order and cancellation. Monitor errors and stock.

## Rollback

Keep the previous deployment available, but do not revert only the frontend while the direct-insert guard is active. Keep checkout paused while restoring compatible policies/functions from the saved definitions or applying a reviewed compatibility migration. Preserve new orders and their stock reservations; do not blindly drop columns or restore an old database snapshot over new orders. Reconcile inventory before reopening.

## Hosting

Use a host that supports Next.js server rendering and App Router. `npm run build` is the build command; the Node start command is `npm start`. Cloudflare requires a separately configured compatible Next.js deployment adapter; this repository does not claim a static export or a completed Cloudflare deployment.
