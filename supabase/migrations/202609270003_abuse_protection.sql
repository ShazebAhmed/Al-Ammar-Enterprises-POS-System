-- Limits guest checkout abuse and hides reviews until an admin approves them.
begin;

-- Checkout limits. Each pending order reserves stock, so a flood of fake orders can empty the
-- shop. Limits apply per phone number (digits only) and to guest orders overall.
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
  phone := regexp_replace(coalesce(p_customer->>'phone',''), '[^0-9]', '', 'g');
  if not public.is_store_admin() then
    perform pg_advisory_xact_lock(hashtextextended('store-checkout-limits',0));
    if (select count(*) from public.orders where status = 'Pending'
        and regexp_replace(customer_phone, '[^0-9]', '', 'g') = phone) >= 3 then
      raise exception 'Too many open orders for this phone number';
    end if;
    if (select count(*) from public.orders where created_at > now() - interval '1 hour'
        and regexp_replace(customer_phone, '[^0-9]', '', 'g') = phone) >= 5 then
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
  if not public.is_store_admin() and (select count(*) from public.reviews where not approved) >= 200 then
    raise exception 'Too many reviews are awaiting approval';
  end if;
  return new;
end;
$$;
drop trigger if exists store_review_queue_limit on public.reviews;
create trigger store_review_queue_limit before insert on public.reviews
  for each row execute function public.limit_pending_reviews();

commit;
