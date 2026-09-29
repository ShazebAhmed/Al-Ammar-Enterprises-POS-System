-- Free delivery above an amount the admin chooses (admin → Settings).
-- 0 (the default) keeps delivery charged on every order, as before.
begin;

alter table public.store_settings
  add column if not exists free_delivery_over numeric not null default 0;
alter table public.store_settings drop constraint if exists store_valid_free_delivery;
alter table public.store_settings
  add constraint store_valid_free_delivery check (free_delivery_over >= 0);

-- Same as 202609280011_product_options.sql, plus the free delivery check.
create or replace function public.validate_store_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  line jsonb; item record; product public.products%rowtype;
  clean_items jsonb := '[]'::jsonb; subtotal numeric := 0; delivery numeric := 0;
  off numeric := 0; free_over numeric := 0; left_in_stock integer;
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
      for item in select value->>'productId' as product_id, coalesce(value->>'variant', '') as variant,
                         (value->>'qty')::integer as qty
                  from jsonb_array_elements(old.items::jsonb) order by value->>'productId' loop
        if item.variant <> '' then
          update public.products
          set variants = public.store_variant_stock(variants, item.variant, item.qty)
          where id::text = item.product_id
            and variants @> jsonb_build_array(jsonb_build_object('name', item.variant));
          if not found then
            -- The option was removed since; return the items to the product itself.
            update public.products set stock = stock + item.qty
            where id::text = item.product_id and jsonb_array_length(variants) = 0;
          end if;
        else
          update public.products set stock = stock + item.qty where id::text = item.product_id;
        end if;
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
    if line ? 'variant' and line->'variant' <> 'null'::jsonb and (jsonb_typeof(line->'variant') <> 'string' or length(line->>'variant') > 40) then
      raise exception 'Invalid product option';
    end if;
  end loop;
  -- Lock in a stable order to avoid overselling and reduce deadlocks between baskets.
  for item in select value->>'productId' as product_id, coalesce(value->>'variant', '') as variant,
                     sum((value->>'qty')::integer)::integer as qty
              from jsonb_array_elements(new.items::jsonb)
              group by value->>'productId', coalesce(value->>'variant', '')
              order by value->>'productId', coalesce(value->>'variant', '') loop
    if item.qty > 999 then raise exception 'Invalid quantity'; end if;
    select * into product from public.products where id::text = item.product_id for update;
    if not found or product.stock is null then raise exception 'Product unavailable or insufficient stock'; end if;
    if product.price is null or product.price < 0 then raise exception 'Invalid product price'; end if;
    if jsonb_array_length(product.variants) > 0 then
      if item.variant = '' then raise exception 'Please choose an option for %', product.name; end if;
      select (v->>'stock')::integer into left_in_stock
      from jsonb_array_elements(product.variants) v where v->>'name' = item.variant;
      if left_in_stock is null or left_in_stock < item.qty then raise exception 'Product unavailable or insufficient stock'; end if;
      update public.products set variants = public.store_variant_stock(variants, item.variant, -item.qty)
      where id = product.id;
    else
      if item.variant <> '' or product.stock < item.qty then raise exception 'Product unavailable or insufficient stock'; end if;
      update public.products set stock = stock - item.qty where id = product.id;
    end if;
    clean_items := clean_items || jsonb_build_array(
      jsonb_build_object('productId',product.id::text,'name',product.name,'price',round(product.price::numeric,2),'qty',item.qty)
      || case when item.variant <> '' then jsonb_build_object('variant', item.variant) else '{}'::jsonb end);
    subtotal := subtotal + round(product.price::numeric,2) * item.qty;
  end loop;
  select greatest(0, coalesce(shipping_fee, 0)), coalesce(free_delivery_over, 0)
    into delivery, free_over from public.store_settings where id = 1;
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
  -- Free delivery when the items, after any discount, reach the admin's amount.
  if free_over > 0 and subtotal - off >= free_over then delivery := 0; end if;
  new.customer_id := auth.uid();
  new.items := clean_items; new.subtotal := subtotal; new.shipping_fee := round(delivery,2);
  new.discount := off;
  new.total := subtotal - off + new.shipping_fee; new.status := 'Pending'; new.stock_reserved := true;
  new.created_at := now();
  return new;
end;
$$;

commit;
