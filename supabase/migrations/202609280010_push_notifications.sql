-- Phone and browser notifications (Web Push).
-- * The admin turns on "new order" alerts on a phone; every new order notifies it.
-- * A customer asks to follow an order; Confirmed / Shipped / Delivered / Cancelled
--   notify them.
-- How a notification travels: an order trigger queues it in push_outbox and pg_net
-- sends only the queue id to the site's /api/push. That route fetches the message,
-- the recipients and the signing key with claim_push(id) (single use, unguessable id)
-- and delivers it. So the route cannot be used to send anything the database did not
-- queue, and no secret has to be copied into Vercel.
-- The signing key pair (VAPID) is created in the admin's browser the first time
-- alerts are turned on, and is readable only through claim_push.
begin;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;

create table if not exists public.push_keys (
  id integer primary key default 1 check (id = 1),
  public_key text not null check (public_key ~ '^[A-Za-z0-9_-]{80,100}$'),
  private_key text not null check (private_key ~ '^[A-Za-z0-9_-]{40,50}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 40 and 200),
  auth text not null check (length(auth) between 10 and 100),
  user_id uuid references auth.users(id) on delete cascade,
  for_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.order_watchers (
  order_id text not null references public.orders(id) on delete cascade,
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (order_id, endpoint)
);

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification jsonb not null,
  endpoints text[] not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

-- No policies: these tables are reached only through the functions below.
alter table public.push_keys enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.order_watchers enable row level security;
alter table public.push_outbox enable row level security;

-- The public half of the key, which browsers need to subscribe. Null until set up.
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = '' as $$
  select public_key from public.push_keys where id = 1;
$$;
revoke all on function public.push_public_key() from public;
grant execute on function public.push_public_key() to anon, authenticated;

-- First-time setup from the admin's browser. Never replaces an existing key (that
-- would silently break every subscription).
create or replace function public.set_push_keys(p_public text, p_private text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  insert into public.push_keys(id, public_key, private_key) values (1, p_public, p_private)
  on conflict (id) do nothing;
  return (select public_key from public.push_keys where id = 1);
end;
$$;
revoke all on function public.set_push_keys(text, text) from public, anon;
grant execute on function public.set_push_keys(text, text) to authenticated;

-- Saves a browser's subscription (PushSubscription.toJSON()).
create or replace function public.store_save_push_subscription(p_sub jsonb, p_admin boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  ep text := p_sub->>'endpoint';
  k1 text := p_sub->'keys'->>'p256dh';
  k2 text := p_sub->'keys'->>'auth';
begin
  if ep is null or k1 is null or k2 is null then raise exception 'Invalid subscription'; end if;
  insert into public.push_subscriptions(endpoint, p256dh, auth, user_id, for_admin)
  values (ep, k1, k2, auth.uid(), p_admin)
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id),
    for_admin = public.push_subscriptions.for_admin or excluded.for_admin;
  return ep;
end;
$$;
revoke all on function public.store_save_push_subscription(jsonb, boolean) from public, anon, authenticated;

create or replace function public.watch_new_orders(p_sub jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  perform public.store_save_push_subscription(p_sub, true);
end;
$$;
revoke all on function public.watch_new_orders(jsonb) from public, anon;
grant execute on function public.watch_new_orders(jsonb) to authenticated;

create or replace function public.unwatch_new_orders(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  update public.push_subscriptions set for_admin = false where endpoint = p_endpoint;
end;
$$;
revoke all on function public.unwatch_new_orders(text) from public, anon;
grant execute on function public.unwatch_new_orders(text) to authenticated;

-- Follow one order. Needs the order's phone number, like order tracking.
create or replace function public.watch_order(p_order_id text, p_phone text, p_sub jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := upper(trim(coalesce(p_order_id, '')));
  phone text := public.store_phone_key(p_phone);
  o public.orders%rowtype;
  ep text;
begin
  if wanted ~ '^[0-9]+$' then wanted := 'AA-' || wanted; end if;
  select * into o from public.orders where id = wanted;
  if not found or length(phone) < 7 or public.store_phone_key(o.customer_phone) <> phone then
    raise exception 'Order not found';
  end if;
  if (select count(*) from public.order_watchers where order_id = o.id) >= 10 then
    raise exception 'Too many devices are following this order';
  end if;
  ep := public.store_save_push_subscription(p_sub, false);
  insert into public.order_watchers(order_id, endpoint) values (o.id, ep) on conflict do nothing;
end;
$$;
revoke all on function public.watch_order(text, text, jsonb) from public;
grant execute on function public.watch_order(text, text, jsonb) to anon, authenticated;

-- Queue a notification and ask the site to deliver it. Never blocks the order.
create or replace function public.store_queue_push(p_notification jsonb, p_endpoints text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare box uuid;
begin
  if p_endpoints is null or cardinality(p_endpoints) = 0 then return; end if;
  if not exists (select 1 from public.push_keys) then return; end if;
  delete from public.push_outbox where created_at < now() - interval '1 day';
  insert into public.push_outbox(notification, endpoints) values (p_notification, p_endpoints)
  returning id into box;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
      using 'https://alammarstore.vercel.app/api/push', jsonb_build_object('id', box),
            '{"Content-Type": "application/json"}'::jsonb;
  end if;
end;
$$;
revoke all on function public.store_queue_push(jsonb, text[]) from public, anon, authenticated;

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
        'url', '/admin',
        'tag', 'new-' || new.id), subs);
    elsif new.status is distinct from old.status then
      msg := case new.status
        when 'Confirmed' then 'is confirmed. We are packing it for delivery.'
        when 'Shipped' then 'is on its way to you.'
        when 'Delivered' then 'has been delivered. Thank you for shopping with us!'
        when 'Cancelled' then 'has been cancelled. Message us if you did not expect this.'
      end;
      if msg is not null then
        select array_agg(endpoint) into subs from public.order_watchers where order_id = new.id;
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
drop trigger if exists store_order_push on public.orders;
create trigger store_order_push after insert or update of status on public.orders
  for each row execute function public.store_order_push();

-- For /api/push: the queued message, its recipients and the signing key, once.
create or replace function public.claim_push(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare box public.push_outbox%rowtype; k public.push_keys%rowtype;
begin
  update public.push_outbox set claimed_at = now()
  where id = p_id and claimed_at is null and created_at > now() - interval '1 hour'
  returning * into box;
  if not found then return null; end if;
  select * into k from public.push_keys where id = 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'notification', box.notification,
    'publicKey', k.public_key,
    'privateKey', k.private_key,
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object(
        'endpoint', s.endpoint,
        'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
      from public.push_subscriptions s where s.endpoint = any(box.endpoints)), '[]'::jsonb));
end;
$$;
revoke all on function public.claim_push(uuid) from public;
grant execute on function public.claim_push(uuid) to anon, authenticated;

-- After delivery: forget browsers the push service says are gone (404/410). Only
-- endpoints of that same queued message can be removed.
create or replace function public.finish_push(p_id uuid, p_expired text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare box public.push_outbox%rowtype;
begin
  delete from public.push_outbox where id = p_id and claimed_at is not null returning * into box;
  if not found or p_expired is null then return; end if;
  delete from public.push_subscriptions
  where endpoint = any(p_expired) and endpoint = any(box.endpoints);
end;
$$;
revoke all on function public.finish_push(uuid, text[]) from public;
grant execute on function public.finish_push(uuid, text[]) to anon, authenticated;

commit;
