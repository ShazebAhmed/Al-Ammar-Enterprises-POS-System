-- Product options such as size or colour, each with its own stock.
-- * products.option_label: what the options are called ("Size", "Colour").
-- * products.variants: [{"name": "M", "stock": 3}, ...]; empty for products without
--   options. With options, products.stock is kept equal to their total.
-- * Order lines and basket rows carry the chosen option ("variant").
begin;

alter table public.products add column if not exists option_label text not null default '';
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;

create or replace function public.store_product_variants() returns trigger
language plpgsql set search_path = '' as $$
declare v jsonb; names text[] := '{}'; total integer := 0;
begin
  new.variants := coalesce(new.variants, '[]'::jsonb);
  if jsonb_typeof(new.variants) <> 'array' or jsonb_array_length(new.variants) > 50 then
    raise exception 'Invalid product options';
  end if;
  for v in select value from jsonb_array_elements(new.variants) loop
    if jsonb_typeof(v->'name') is distinct from 'string' or length(trim(v->>'name')) not between 1 and 40
       or jsonb_typeof(v->'stock') is distinct from 'number' or (v->>'stock') !~ '^[0-9]+$' then
      raise exception 'Invalid product option';
    end if;
    if lower(trim(v->>'name')) = any(names) then raise exception 'Option names must be different'; end if;
    names := names || lower(trim(v->>'name'));
    total := total + (v->>'stock')::integer;
  end loop;
  if jsonb_array_length(new.variants) > 0 then new.stock := total; end if;
  new.option_label := left(trim(coalesce(new.option_label, '')), 40);
  return new;
end;
$$;
drop trigger if exists store_product_variants on public.products;
create trigger store_product_variants before insert or update on public.products
  for each row execute function public.store_product_variants();

-- The options list with one option's stock changed by p_delta.
create or replace function public.store_variant_stock(p_variants jsonb, p_name text, p_delta integer)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(case when t.v->>'name' = p_name
      then jsonb_set(t.v, '{stock}', to_jsonb((t.v->>'stock')::integer + p_delta)) else t.v end
      order by t.ord), '[]'::jsonb)
  from jsonb_array_elements(p_variants) with ordinality as t(v, ord);
$$;
revoke all on function public.store_variant_stock(jsonb, text, integer) from public, anon, authenticated;

-- Basket rows per option.
alter table public.cart_items add column if not exists variant text not null default '';
alter table public.cart_items drop constraint if exists store_cart_variant_length;
alter table public.cart_items add constraint store_cart_variant_length check (length(variant) <= 40);
do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.cart_items'::regclass and contype = 'p';
  if c is not null then execute format('alter table public.cart_items drop constraint %I', c); end if;
end $$;
drop index if exists public.cart_items_customer_product_unique;
alter table public.cart_items add primary key (customer_id, product_id, variant);

-- Same as 202609280009 plus options: stock is checked and reserved per option, and
-- order lines keep the option's name.
create or replace function public.validate_store_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  line jsonb; item record; product public.products%rowtype;
  clean_items jsonb := '[]'::jsonb; subtotal numeric := 0; delivery numeric := 0;
  off numeric := 0; left_in_stock integer;
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

commit;
