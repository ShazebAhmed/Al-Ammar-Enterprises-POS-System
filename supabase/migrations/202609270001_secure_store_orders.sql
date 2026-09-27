-- Apply to a staging copy first. Existing order/item history is retained.
-- Required existing tables/columns are documented in README.md.
begin;

alter table public.orders add column if not exists checkout_token uuid;
alter table public.orders add column if not exists stock_reserved boolean not null default false;
create unique index if not exists orders_checkout_token_unique on public.orders(checkout_token);
create unique index if not exists cart_items_customer_product_unique on public.cart_items(customer_id, product_id);

create or replace function public.is_store_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_admin = true);
$$;
revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('', 'service_role') then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) and not public.is_store_admin() then raise exception 'Admin role cannot be self-assigned'; end if;
  elsif new.is_admin is distinct from old.is_admin and not public.is_store_admin() then
    raise exception 'Admin role cannot be self-assigned';
  end if;
  return new;
end;
$$;
drop trigger if exists store_profile_role_guard on public.profiles;
create trigger store_profile_role_guard before insert or update on public.profiles for each row execute function public.guard_profile_role();

create or replace function public.validate_store_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  line jsonb; item record; product public.products%rowtype;
  clean_items jsonb := '[]'::jsonb; subtotal numeric := 0; delivery numeric := 0;
begin
  if tg_op = 'UPDATE' then
    if not public.is_store_admin() and coalesce(auth.role(), '') not in ('', 'service_role') then raise exception 'Administrator access required'; end if;
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then raise exception 'Order snapshots cannot be changed'; end if;
    if new.status = old.status then return new; end if;
    if new.status is null or not ((old.status = 'Pending' and new.status in ('Confirmed','Cancelled')) or
      (old.status = 'Confirmed' and new.status in ('Shipped','Cancelled')) or
      (old.status = 'Shipped' and new.status = 'Delivered')) then raise exception 'Invalid order status transition'; end if;
    if new.status = 'Cancelled' and old.stock_reserved then
      for item in select value->>'productId' as product_id, (value->>'qty')::integer as qty from jsonb_array_elements(old.items::jsonb) order by value->>'productId' loop
        update public.products set stock = stock + item.qty where id::text = item.product_id;
      end loop;
      new.stock_reserved := false;
    end if;
    return new;
  end if;
  if new.items is null or jsonb_typeof(new.items::jsonb) <> 'array' then raise exception 'Invalid order items'; end if;
  if jsonb_array_length(new.items::jsonb) < 1 or jsonb_array_length(new.items::jsonb) > 100 then raise exception 'Invalid order size'; end if;
  for line in select value from jsonb_array_elements(new.items::jsonb) loop
    if jsonb_typeof(line->'productId') is distinct from 'string' or length(line->>'productId') > 100 or
       jsonb_typeof(line->'qty') is distinct from 'number' or (line->>'qty') !~ '^[0-9]+$' then raise exception 'Invalid product or quantity'; end if;
    if (line->>'qty')::numeric < 1 or (line->>'qty')::numeric > 999 then raise exception 'Invalid quantity'; end if;
  end loop;
  -- Lock in a stable order to avoid overselling and reduce deadlocks between baskets.
  for item in select value->>'productId' as product_id, sum((value->>'qty')::integer)::integer as qty
              from jsonb_array_elements(new.items::jsonb) group by value->>'productId' order by value->>'productId' loop
    if item.qty > 999 then raise exception 'Invalid quantity'; end if;
    select * into product from public.products where id::text = item.product_id for update;
    if not found or product.stock is null or product.stock < item.qty then raise exception 'Product unavailable or insufficient stock'; end if;
    if product.price is null or product.price < 0 then raise exception 'Invalid product price'; end if;
    clean_items := clean_items || jsonb_build_array(jsonb_build_object('productId',product.id::text,'name',product.name,'price',round(product.price::numeric,2),'qty',item.qty));
    subtotal := subtotal + round(product.price::numeric,2) * item.qty;
    update public.products set stock = stock - item.qty where id = product.id;
  end loop;
  select greatest(0, coalesce(shipping_fee, 0)) into delivery from public.store_settings where id = 1;
  if not found then raise exception 'Store settings are unavailable'; end if;
  if length(trim(coalesce(new.customer_name,''))) not between 1 and 120 or
     length(trim(coalesce(new.customer_phone,''))) not between 7 and 30 or
     length(trim(coalesce(new.customer_address,''))) not between 1 and 500 or
     length(trim(coalesce(new.customer_city,''))) not between 1 and 100 or
     length(coalesce(new.customer_notes,'')) > 1000 then raise exception 'Invalid customer details'; end if;
  if new.customer_phone !~ '^\+?[0-9 ()-]{7,30}$' then raise exception 'Invalid phone number'; end if;
  new.customer_id := auth.uid();
  new.items := clean_items; new.subtotal := subtotal; new.shipping_fee := round(delivery,2);
  new.total := subtotal + new.shipping_fee; new.status := 'Pending'; new.stock_reserved := true;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists store_order_validation on public.orders;
create trigger store_order_validation before insert or update on public.orders for each row execute function public.validate_store_order();

create or replace function public.place_store_order(p_request_id uuid, p_items jsonb, p_customer jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.orders%rowtype;
begin
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into saved from public.orders where checkout_token = p_request_id;
  if found then
    if saved.customer_id is distinct from auth.uid() then raise exception 'Order access denied'; end if;
    return to_jsonb(saved) - 'checkout_token';
  end if;
  insert into public.orders(id,checkout_token,customer_id,items,subtotal,shipping_fee,total,customer_name,customer_phone,customer_address,customer_city,customer_notes,status)
  values ('ORD-' || upper(replace(gen_random_uuid()::text,'-','')), p_request_id, auth.uid(), p_items, 0,0,0,
    trim(p_customer->>'name'),trim(p_customer->>'phone'),trim(p_customer->>'address'),trim(p_customer->>'city'),trim(coalesce(p_customer->>'notes','')),'Pending') returning * into saved;
  return to_jsonb(saved) - 'checkout_token';
end;
$$;
revoke all on function public.place_store_order(uuid,jsonb,jsonb) from public;
grant execute on function public.place_store_order(uuid,jsonb,jsonb) to anon,authenticated;

-- Restrictive policies also constrain pre-existing permissive policies. Policies here
-- deliberately do not rely on hiding admin links or on browser-supplied user IDs.
alter table public.orders enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.cart_items enable row level security;
alter table public.reviews enable row level security;

create policy store_orders_read_guard on public.orders as restrictive for select to anon,authenticated using (public.is_store_admin() or customer_id = auth.uid());
create policy store_orders_read on public.orders for select to authenticated using (public.is_store_admin() or customer_id = auth.uid());
create policy store_orders_insert_guard on public.orders as restrictive for insert to anon,authenticated with check (false);
create policy store_orders_update_guard on public.orders as restrictive for update to anon,authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy store_orders_update on public.orders for update to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy store_orders_delete_guard on public.orders as restrictive for delete to anon,authenticated using (false);

create policy store_profiles_guard on public.profiles as restrictive for all to anon,authenticated using (id = auth.uid() or public.is_store_admin()) with check (id = auth.uid() or public.is_store_admin());
create policy store_profiles_self_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_store_admin());

create policy store_cart_guard on public.cart_items as restrictive for all to anon,authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid() and qty between 1 and 999 and qty = trunc(qty));
create policy store_cart_self on public.cart_items for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid() and qty between 1 and 999);

create policy store_products_read on public.products for select to anon,authenticated using (true);
create policy store_settings_read on public.store_settings for select to anon,authenticated using (true);
create policy store_reviews_read on public.reviews for select to anon,authenticated using (true);
create policy store_products_write on public.products for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy store_settings_write on public.store_settings for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy store_reviews_admin on public.reviews for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy store_reviews_submit on public.reviews for insert to anon,authenticated with check (rating between 1 and 5 and length(trim(customer_name)) between 1 and 120 and length(trim(comment)) between 1 and 2000);
create policy store_reviews_submit_guard on public.reviews as restrictive for insert to anon,authenticated with check (rating between 1 and 5 and rating = trunc(rating) and length(trim(customer_name)) between 1 and 120 and length(trim(comment)) between 1 and 2000);

-- Admin-only mutations even when older projects have broad permissive policies.
do $$
declare t text; op text;
begin
  foreach t in array array['products','store_settings'] loop
    foreach op in array array['insert','update','delete'] loop
      execute format('create policy %I on public.%I as restrictive for %s to anon,authenticated %s',
        'store_'||t||'_'||op||'_guard',t,op,
        case when op='insert' then 'with check (public.is_store_admin())'
             when op='update' then 'using (public.is_store_admin()) with check (public.is_store_admin())'
             else 'using (public.is_store_admin())' end);
    end loop;
  end loop;
end $$;
create policy store_reviews_update_guard on public.reviews as restrictive for update to anon,authenticated using (public.is_store_admin()) with check (public.is_store_admin());
create policy store_reviews_delete_guard on public.reviews as restrictive for delete to anon,authenticated using (public.is_store_admin());

-- These constraints leave historic rows untouched but validate future writes.
alter table public.products add constraint store_valid_price check (price >= 0 and price is not null) not valid;
alter table public.products add constraint store_valid_stock check (stock >= 0 and stock = trunc(stock) and stock is not null) not valid;
alter table public.store_settings add constraint store_valid_shipping check (shipping_fee >= 0 and shipping_fee is not null) not valid;

-- Do not change other buckets. Run this block only when Supabase Storage is present.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'create policy store_image_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check (bucket_id <> ''product-images'' or public.is_store_admin())';
    execute 'create policy store_image_update_guard on storage.objects as restrictive for update to anon,authenticated using (bucket_id <> ''product-images'' or public.is_store_admin()) with check (bucket_id <> ''product-images'' or public.is_store_admin())';
    execute 'create policy store_image_delete_guard on storage.objects as restrictive for delete to anon,authenticated using (bucket_id <> ''product-images'' or public.is_store_admin())';
  end if;
end $$;
commit;
