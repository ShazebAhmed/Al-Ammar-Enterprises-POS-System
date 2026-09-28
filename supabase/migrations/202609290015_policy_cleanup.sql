-- From the Supabase Performance Advisor.
--
-- 1. The original schema's policies are exact copies of newer store_* policies
--    (is_admin() and is_store_admin() check the same flag, and signed-out visitors
--    have no auth.uid()), so Postgres was checking both on every row.
drop policy if exists cart_own_only on public.cart_items;
drop policy if exists orders_insert on public.orders; -- inserts go through place_store_order
drop policy if exists orders_select_own_or_admin on public.orders;
drop policy if exists orders_admin_update on public.orders;
drop policy if exists products_public_read on public.products;
drop policy if exists products_admin_write on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists reviews_public_read on public.reviews;
drop policy if exists reviews_admin_delete on public.reviews;
drop policy if exists settings_public_read on public.store_settings;
drop policy if exists settings_admin_write on public.store_settings;

-- 2. (select auth.uid()) is worked out once per query instead of once per row.
--    Same rules as before.
alter policy profiles_insert_own on public.profiles
  with check ((select auth.uid()) = id);
alter policy profiles_update_own on public.profiles
  using ((select auth.uid()) = id);
alter policy store_profiles_guard on public.profiles
  using (id = (select auth.uid()) or public.is_store_admin())
  with check (id = (select auth.uid()) or public.is_store_admin());
alter policy store_profiles_self_read on public.profiles
  using (id = (select auth.uid()) or public.is_store_admin());
alter policy store_orders_read_guard on public.orders
  using (public.is_store_admin() or customer_id = (select auth.uid()));
alter policy store_orders_read on public.orders
  using (public.is_store_admin() or customer_id = (select auth.uid()));
alter policy store_cart_guard on public.cart_items
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()) and qty between 1 and 999 and qty = trunc(qty));
alter policy store_cart_self on public.cart_items
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()) and qty between 1 and 999);
