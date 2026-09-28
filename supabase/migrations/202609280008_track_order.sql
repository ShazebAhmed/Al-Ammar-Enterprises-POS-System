-- Order tracking without an account: the customer gives the order number and the phone
-- number used on the order, and sees its status and items. Nothing else is returned
-- (no address, no full name), and a wrong phone number looks exactly like a wrong
-- order number.
begin;

create or replace function public.track_order(p_order_id text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  wanted text := upper(trim(coalesce(p_order_id, '')));
  phone text := public.store_phone_key(p_phone);
  o public.orders%rowtype;
begin
  if length(wanted) not between 1 and 64 or length(phone) < 7 then return null; end if;
  -- "10001" and "aa-10001" both mean AA-10001.
  if wanted ~ '^[0-9]+$' then wanted := 'AA-' || wanted; end if;
  select * into o from public.orders where id = wanted;
  if not found or public.store_phone_key(o.customer_phone) <> phone then return null; end if;
  return jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'createdAt', o.created_at,
    'city', o.customer_city,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'name', line->>'name', 'qty', (line->>'qty')::integer,
                'price', (line->>'price')::numeric)), '[]'::jsonb)
              from jsonb_array_elements(o.items) line),
    'subtotal', o.subtotal,
    'shippingFee', o.shipping_fee,
    'total', o.total
  );
end;
$$;
revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

commit;
