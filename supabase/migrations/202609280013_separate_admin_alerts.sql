-- Store alerts and customer order updates never mix.
-- * Every subscription belongs to the admin ("New order" alerts) or to a customer
--   (updates on orders they follow), never both. A device that turned on store alerts
--   cannot follow orders, and turning store alerts on stops it following orders.
-- * Signed-in customers can follow every order on their account at once
--   (follow_my_orders) instead of one order at a time.
-- * A new-order alert opens that order in the admin panel.
-- * send_test_alert lets the admin check that a phone receives store alerts.
-- The admin app now runs on its own address (see middleware.js), so its alerts have their
-- own subscription and show under the Admin app. Store alerts turned on before this
-- were made on the shop's address; they are removed and turned on again in Admin 1.3.0.
begin;

alter table public.push_subscriptions
  add column if not exists follows_account boolean not null default false;

delete from public.push_subscriptions where for_admin;

create or replace function public.store_save_push_subscription(p_sub jsonb, p_admin boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  ep text := p_sub->>'endpoint';
  k1 text := p_sub->'keys'->>'p256dh';
  k2 text := p_sub->'keys'->>'auth';
begin
  if ep is null or k1 is null or k2 is null then raise exception 'Invalid subscription'; end if;
  if not p_admin and exists (select 1 from public.push_subscriptions where endpoint = ep and for_admin) then
    raise exception 'This device receives store alerts';
  end if;
  insert into public.push_subscriptions(endpoint, p256dh, auth, user_id, for_admin)
  values (ep, k1, k2, auth.uid(), p_admin)
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id),
    for_admin = excluded.for_admin,
    follows_account = public.push_subscriptions.follows_account and not excluded.for_admin;
  if p_admin then delete from public.order_watchers where endpoint = ep; end if;
  return ep;
end;
$$;
revoke all on function public.store_save_push_subscription(jsonb, boolean) from public, anon, authenticated;

-- Signed-in customer: notify this device about every order on the account.
create or replace function public.follow_my_orders(p_sub jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare ep text;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  ep := public.store_save_push_subscription(p_sub, false);
  -- A shared phone follows whoever turned this on last.
  update public.push_subscriptions set user_id = auth.uid(), follows_account = true
  where endpoint = ep;
end;
$$;
revoke all on function public.follow_my_orders(jsonb) from public, anon;
grant execute on function public.follow_my_orders(jsonb) to authenticated;

-- Admin: send a test alert to this phone (its subscription endpoint).
create or replace function public.send_test_alert(p_endpoint text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint and for_admin) then
    return false;
  end if;
  perform public.store_queue_push(jsonb_build_object(
    'title', 'Test alert',
    'body', 'New order alerts are working on this phone.',
    'url', '/admin',
    'tag', 'test-alert'), array[p_endpoint]);
  return true;
end;
$$;
revoke all on function public.send_test_alert(text) from public, anon;
grant execute on function public.send_test_alert(text) to authenticated;

-- Same as 202609280010, but each notification goes only to its own audience: new
-- orders to store-alert devices, status changes to the order's followers and to
-- devices following the customer's account.
create or replace function public.store_order_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  subs text[];
  money text;
  msg text;
begin
  begin
    select coalesce(nullif(currency_symbol, ''), 'Rs.') || ' ' || to_char(new.total, 'FM999,999,999,990')
      into money from public.store_settings where id = 1;
    if tg_op = 'INSERT' then
      select array_agg(endpoint) into subs from public.push_subscriptions where for_admin;
      perform public.store_queue_push(jsonb_build_object(
        'title', 'New order ' || new.id || ' · ' || coalesce(money, ''),
        'body', new.customer_name || ', ' || new.customer_city || '. Tap to confirm it.',
        'url', '/admin?order=' || new.id,
        'tag', 'new-' || new.id), subs);
    elsif new.status is distinct from old.status then
      msg := case new.status
        when 'Confirmed' then 'is confirmed. We are packing it for delivery.'
        when 'Shipped' then 'is on its way to you.'
        when 'Delivered' then 'has been delivered. Thank you for shopping with us!'
        when 'Cancelled' then 'has been cancelled. Message us if you did not expect this.'
      end;
      if msg is not null then
        select array_agg(distinct s.endpoint) into subs
        from public.push_subscriptions s
        where not s.for_admin
          and (exists (select 1 from public.order_watchers w
                       where w.order_id = new.id and w.endpoint = s.endpoint)
               or (s.follows_account and new.customer_id is not null
                   and s.user_id = new.customer_id));
        perform public.store_queue_push(jsonb_build_object(
          'title', 'Order ' || new.id || ': ' || lower(new.status),
          'body', 'Your order ' || new.id || ' ' || msg,
          'url', '/track?order=' || new.id,
          'tag', 'order-' || new.id), subs);
      end if;
    end if;
  exception when others then
    -- A notification problem must never stop an order or a status change.
    raise warning 'Order notification skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

commit;
