-- Cost prices for profit reports, kept away from customers.
-- * product_costs: what the store pays for each product. Products are public, so the
--   cost lives in its own table that only the admin can read or change.
-- * order_item_costs: each product's cost at the moment an order was placed, so later
--   price changes do not rewrite past profit. Filled by a trigger; admin read-only.
begin;

create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost numeric not null check (cost >= 0 and cost <= 100000000),
  updated_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;
drop policy if exists product_costs_admin on public.product_costs;
create policy product_costs_admin on public.product_costs for all to authenticated
  using (public.is_store_admin()) with check (public.is_store_admin());
revoke all on public.product_costs from anon;

create table if not exists public.order_item_costs (
  order_id text not null references public.orders(id) on delete cascade,
  product_id uuid not null,
  unit_cost numeric not null,
  primary key (order_id, product_id)
);
alter table public.order_item_costs enable row level security;
drop policy if exists order_item_costs_admin_read on public.order_item_costs;
create policy order_item_costs_admin_read on public.order_item_costs for select to authenticated
  using (public.is_store_admin());
revoke all on public.order_item_costs from anon;
revoke insert, update, delete on public.order_item_costs from authenticated;

create or replace function public.store_order_costs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.order_item_costs(order_id, product_id, unit_cost)
  select new.id, c.product_id, c.cost
  from (select distinct value->>'productId' as pid
        from jsonb_array_elements(new.items::jsonb)) i
  join public.product_costs c on c.product_id::text = i.pid
  on conflict do nothing;
  return null;
exception when others then
  -- Profit reports must never stop an order.
  raise warning 'Order cost snapshot skipped: %', sqlerrm;
  return null;
end;
$$;
revoke all on function public.store_order_costs() from public, anon, authenticated;
drop trigger if exists store_order_costs on public.orders;
create trigger store_order_costs after insert on public.orders
  for each row execute function public.store_order_costs();

commit;
