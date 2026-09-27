-- Limits guest checkout abuse and hides reviews until an admin approves them.
begin;

-- One key per Pakistani phone number however it is typed: 0321 7654321, +92 321 7654321,
-- 0092-321-7654321 and 3217654321 all become 03217654321.
create or replace function public.store_phone_key(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when d like '0092%' then '0' || substr(d, 5)
    when d like '92%' and length(d) = 12 then '0' || substr(d, 3)
    when d like '3%' and length(d) = 10 then '0' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s;
$$;
create index if not exists orders_phone_key_idx on public.orders(public.store_phone_key(customer_phone));

-- Checkout limits. Each pending order reserves stock, so a flood of fake orders can empty the
-- shop. Limits apply per phone number and to guest orders overall.
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
  values ('ORD-' || upper(replace(gen_random_uuid()::text,'-','')), p_request_id, auth.uid(), p_items, 0,0,0,
    trim(p_customer->>'name'),trim(p_customer->>'phone'),trim(p_customer->>'address'),trim(p_customer->>'city'),trim(coalesce(p_customer->>'notes','')),'Pending') returning * into saved;
  return to_jsonb(saved) - 'checkout_token';
end;
$$;
create index if not exists orders_created_at_idx on public.orders(created_at);

-- Review moderation. Existing reviews stay visible; new ones wait for an admin.
alter table public.reviews add column if not exists approved boolean not null default false;
update public.reviews set approved = true;
create policy store_reviews_visible_guard on public.reviews as restrictive for select to anon,authenticated
  using (approved or public.is_store_admin());
create policy store_reviews_self_approve_guard on public.reviews as restrictive for insert to anon,authenticated
  with check (not approved or public.is_store_admin());

-- Bound the moderation queue so a flood of spam cannot grow the table without limit.
create or replace function public.limit_pending_reviews() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_store_admin() then return new; end if;
  -- Serialize concurrent submissions so parallel inserts cannot all see 199 and pass.
  perform pg_advisory_xact_lock(hashtextextended('store-review-queue',0));
  if (select count(*) from public.reviews where not approved) >= 200 then
    raise exception 'Too many reviews are awaiting approval';
  end if;
  return new;
end;
$$;
drop trigger if exists store_review_queue_limit on public.reviews;
create trigger store_review_queue_limit before insert on public.reviews
  for each row execute function public.limit_pending_reviews();

commit;
