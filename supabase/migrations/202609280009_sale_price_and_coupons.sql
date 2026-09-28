-- Sale prices and discount codes.
-- * products.compare_at_price: the old price shown struck through ("was Rs. 3,000").
--   Display only; customers always pay products.price.
-- * coupons: codes the admin creates (percent or fixed amount, optional minimum order,
--   expiry and use limit). The database applies the discount when the order is placed,
--   so a customer cannot change it. A cancelled order gives its use back.
begin;

alter table public.products add column if not exists compare_at_price numeric;
alter table public.products drop constraint if exists store_valid_compare_price;
alter table public.products add constraint store_valid_compare_price
  check (compare_at_price is null or compare_at_price >= 0) not valid;

create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9-]{3,30}$'),
  kind text not null check (kind in ('percent', 'amount')),
  value numeric not null check (value > 0),
  min_order numeric not null default 0 check (min_order >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 90)
);
alter table public.coupons enable row level security;
-- Only the admin can list or edit codes; customers check one code at a time below.
create policy store_coupons_admin on public.coupons for all to authenticated
  using (public.is_store_admin()) with check (public.is_store_admin());
create policy store_coupons_guard on public.coupons as restrictive for all to anon, authenticated
  using (public.is_store_admin()) with check (public.is_store_admin());

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount numeric not null default 0;

-- The discount a code gives on a subtotal, or an error saying why it cannot be used.
create or replace function public.store_coupon_discount(p_code text, p_subtotal numeric)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare c public.coupons%rowtype;
begin
  select * into c from public.coupons where code = upper(trim(coalesce(p_code, '')));
  if not found or not c.active or (c.expires_at is not null and c.expires_at <= now())
     or (c.max_uses is not null and c.used_count >= c.max_uses) then
    raise exception 'This discount code is not valid';
  end if;
  if p_subtotal < c.min_order then
    raise exception 'This discount code needs an order of at least %', c.min_order;
  end if;
  return least(p_subtotal, case when c.kind = 'percent'
    then round(p_subtotal * c.value / 100) else c.value end);
end;
$$;
revoke all on function public.store_coupon_discount(text, numeric) from public, anon, authenticated;

-- For the checkout page: what a code is worth on the current basket.
create or replace function public.check_coupon(p_code text, p_subtotal numeric) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_subtotal is null or p_subtotal < 0 or p_subtotal > 100000000 then
    raise exception 'Invalid subtotal';
  end if;
  return jsonb_build_object(
    'code', upper(trim(coalesce(p_code, ''))),
    'discount', public.store_coupon_discount(p_code, p_subtotal));
end;
$$;
revoke all on function public.check_coupon(text, numeric) from public;
grant execute on function public.check_coupon(text, numeric) to anon, authenticated;

-- Same as 202609270006 plus the discount (insert) and giving the code's use back (cancel).
create or replace function public.validate_store_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  line jsonb; item record; product public.products%rowtype;
  clean_items jsonb := '[]'::jsonb; subtotal numeric := 0; delivery numeric := 0;
  off numeric := 0;
begin
  if tg_op = 'UPDATE' then
    -- delete_my_account() detaches the leaving customer's orders (customer_id -> null
    -- through the foreign key). Allow exactly that change and nothing else.
    if current_setting('store.deleting_account', true) = 'on'
       and old.customer_id = auth.uid() and new.customer_id is null
       and (to_jsonb(new) - 'customer_id') = (to_jsonb(old) - 'customer_id') then
      return new;
    end if;
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
    if new.status = 'Cancelled' and old.coupon_code is not null then
      update public.coupons set used_count = greatest(0, used_count - 1) where code = old.coupon_code;
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
  if new.customer_phone !~ '^[+]?[0-9 ()-]{7,30}$' then raise exception 'Invalid phone number'; end if;
  new.coupon_code := nullif(upper(trim(coalesce(new.coupon_code, ''))), '');
  if new.coupon_code is not null then
    -- Lock the code so two orders cannot both take its last use.
    perform 1 from public.coupons where code = new.coupon_code for update;
    off := public.store_coupon_discount(new.coupon_code, subtotal);
    update public.coupons set used_count = used_count + 1 where code = new.coupon_code;
  end if;
  new.customer_id := auth.uid();
  new.items := clean_items; new.subtotal := subtotal; new.shipping_fee := round(delivery,2);
  new.discount := off;
  new.total := subtotal - off + new.shipping_fee; new.status := 'Pending'; new.stock_reserved := true;
  new.created_at := now();
  return new;
end;
$$;

-- Same as 202609270005 plus the discount code from the checkout form.
create or replace function public.place_store_order(p_request_id uuid, p_items jsonb, p_customer jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.orders%rowtype; phone text;
begin
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into saved from public.orders where checkout_token = p_request_id;
  if found then
    if saved.customer_id is distinct from auth.uid() then raise exception 'Order access denied'; end if;
    return to_jsonb(saved) - 'checkout_token';
  end if;
  phone := public.store_phone_key(p_customer->>'phone');
  if not public.is_store_admin() then
    perform pg_advisory_xact_lock(hashtextextended('store-checkout-limits',0));
    if (select count(*) from public.orders where status = 'Pending'
        and public.store_phone_key(customer_phone) = phone) >= 3 then
      raise exception 'Too many open orders for this phone number';
    end if;
    if (select count(*) from public.orders where created_at > now() - interval '1 hour'
        and public.store_phone_key(customer_phone) = phone) >= 5 then
      raise exception 'Too many orders for this phone number';
    end if;
    if auth.uid() is null and (select count(*) from public.orders where customer_id is null
        and created_at > now() - interval '10 minutes') >= 20 then
      raise exception 'Too many guest orders right now';
    end if;
  end if;
  insert into public.orders(id,checkout_token,customer_id,items,subtotal,shipping_fee,total,customer_name,customer_phone,customer_address,customer_city,customer_notes,status,coupon_code)
  values ('AA-' || nextval('public.store_order_number_seq'), p_request_id, auth.uid(), p_items, 0,0,0,
    trim(p_customer->>'name'),trim(p_customer->>'phone'),trim(p_customer->>'address'),trim(p_customer->>'city'),trim(coalesce(p_customer->>'notes','')),'Pending',
    left(trim(coalesce(p_customer->>'coupon','')), 30)) returning * into saved;
  return to_jsonb(saved) - 'checkout_token';
end;
$$;

commit;
