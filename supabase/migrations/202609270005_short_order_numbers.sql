-- Short, readable order numbers (AA-10001, AA-10002, ...) instead of ORD- plus 32 hex
-- characters. Existing orders keep their numbers. Numbers can skip when an order fails
-- (sequences are not rolled back), which is harmless.
begin;

create sequence if not exists public.store_order_number_seq start with 10001;
revoke all on sequence public.store_order_number_seq from public, anon, authenticated;

-- Same as 202609270003 except for the generated id.
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
  insert into public.orders(id,checkout_token,customer_id,items,subtotal,shipping_fee,total,customer_name,customer_phone,customer_address,customer_city,customer_notes,status)
  values ('AA-' || nextval('public.store_order_number_seq'), p_request_id, auth.uid(), p_items, 0,0,0,
    trim(p_customer->>'name'),trim(p_customer->>'phone'),trim(p_customer->>'address'),trim(p_customer->>'city'),trim(coalesce(p_customer->>'notes','')),'Pending') returning * into saved;
  return to_jsonb(saved) - 'checkout_token';
end;
$$;

commit;
