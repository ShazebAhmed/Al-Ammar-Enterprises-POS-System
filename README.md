# Al-Ammar Store

A Next.js 15 / React 19 storefront with Supabase authentication, product catalogue, persistent baskets, cash-on-delivery checkout and an administration dashboard. Despite the repository name, this is an ecommerce site, not a complete point-of-sale accounting system.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, fill in your project values, then run `npm run dev`. Do not put a Supabase service-role key in a `NEXT_PUBLIC_*` variable. Without configuration the interface renders a store-unavailable state.

Run `npm test`, `npm run format:check` and `npm run build` before deployment. The database tests use embedded PostgreSQL (PGlite): they apply every file in `supabase/migrations/` in order, starting from the baseline copied from the live schema, on top of minimal stand-ins for the Supabase `auth` and `storage` schemas.

## Keeping Supabase awake

The free Supabase plan pauses a project after about a week without activity, and the site then shows no products. The `Supabase keep-alive` workflow loads the live home page every three days, which queries Supabase. If a run fails, the catalogue could not be loaded: open the Supabase dashboard and resume the project. GitHub disables scheduled workflows in repositories with no commits for 60 days; re-enable it from the Actions tab if that happens.

## Database requirement

**The new checkout requires the included migration. Do not deploy this frontend alone to an existing live store.** Follow [the rollout guide](docs/rollout.md) on a staging database first.

Existing public tables are expected: `profiles`, `products`, `store_settings`, `cart_items`, `orders` and `reviews`. `202607010000_baseline_schema.sql` recreates the original tables, functions, triggers and policies as they existed on the live project; it is already applied there and is only for fresh projects. The upgrade migration adds order request tokens, reservation tracking, validated checkout and row-level access guards.

Expected columns include:

| Table          | Columns used by the application                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| profiles       | id (auth user UUID), name, phone, is_admin, created_at                                                                                                                                                           |
| products       | id (UUID or text), name, category, price (numeric), stock (integer), description, images (text array), video_url, created_at                                                                                     |
| store_settings | id (row 1), store_name, tagline, logo_initial, currency_symbol, shipping_fee, contact_phone, whatsapp, about_text, categories (text array)                                                                       |
| cart_items     | customer_id (UUID), product_id, qty, updated_at; unique customer/product pair                                                                                                                                    |
| orders         | id (text, supports 36 characters), customer_id (nullable UUID), items (JSONB), subtotal, shipping_fee, total, customer_name, customer_phone, customer_address, customer_city, customer_notes, status, created_at |
| reviews        | id, product_id, customer_name, rating, comment, created_at                                                                                                                                                       |

The existing signup profile trigger and table grants must be retained and verified. Storage uses the public `product-images` bucket with admin upload permission. Configure Supabase Auth redirect URLs for the actual site and `/reset-password`.

## How checkout works

The browser submits product IDs, quantities, delivery details and a random request token to `place_store_order`. PostgreSQL locks stock, reads authoritative prices and delivery fees, and creates the order atomically. Retrying the same request returns its original order. Admins can move Pending → Confirmed → Shipped → Delivered, or cancel before shipping. Cancellation restores stock only for orders reserved by this migration; historical orders are not automatically restocked.

See [the audit notes](docs/audit.md) for completed changes and remaining verification.
