-- Lets a signed-in customer delete their own account (required by Google Play).
-- Deleting the auth user removes the profile and saved basket (on delete cascade);
-- past orders stay for the store's records with customer_id set to null
-- (on delete set null), as the privacy policy explains.
begin;

-- Same as 202609270001 except for the account-deletion exception at the top of the
-- UPDATE branch, without which the foreign key's update is rejected.
create or replace function public.validate_store_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  line jsonb; item record; product public.products%rowtype;
  clean_items jsonb := '[]'::jsonb; subtotal numeric := 0; delivery numeric := 0;
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

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to delete your account'; end if;
  -- Keeps the shop from locking itself out of its admin panel.
  if public.is_store_admin() then
    raise exception 'The store admin account cannot be deleted here';
  end if;
  perform set_config('store.deleting_account', 'on', true);
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

commit;
