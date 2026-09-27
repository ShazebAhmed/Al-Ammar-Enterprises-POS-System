-- Baseline: the schema the live Supabase project had before 202609270001, reconstructed from
-- the live catalog on 27 September 2026 (tables, defaults, constraints, policies, functions
-- and triggers). It is already applied on the live project: run it only on a fresh project,
-- followed by the later migrations in order.
-- The trigger definitions for before_order_insert and after_order_status_update were rebuilt
-- from their names, timing and functions; 202609270002 drops both.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  price numeric not null default 0,
  stock integer not null default 0,
  description text not null default '',
  images text[] not null default '{}',
  video_url text not null default '',
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id integer primary key default 1 constraint store_settings_single_row check (id = 1),
  store_name text not null default '',
  tagline text not null default '',
  logo_initial text not null default '',
  currency_symbol text not null default 'Rs.',
  shipping_fee numeric not null default 150,
  contact_phone text not null default '',
  whatsapp text not null default '',
  about_text text not null default '',
  categories text[] not null default array['Groceries', 'Home & Kitchen', 'Fashion', 'Electronics', 'Beauty', 'Other']
);
insert into public.store_settings (id) values (1);

create table public.cart_items (
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create table public.orders (
  id text primary key,
  customer_id uuid references auth.users(id) on delete set null,
  items jsonb not null,
  subtotal numeric not null default 0,
  shipping_fee numeric not null default 0,
  total numeric not null default 0,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_address text not null default '',
  customer_city text not null default '',
  customer_notes text not null default '',
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  customer_name text not null default '',
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql security definer set search_path to 'public' as $function$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$function$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$function$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.compute_order_total() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  computed_subtotal numeric := 0;
  item jsonb;
  prod record;
  item_qty int;
begin
  for item in select * from jsonb_array_elements(new.items)
  loop
    item_qty := (item->>'qty')::int;

    select price, stock into prod
    from products
    where id = (item->>'productId')::uuid
    for update;

    if prod is null then
      raise exception 'Product % no longer exists', item->>'productId';
    end if;

    if prod.stock < item_qty then
      raise exception 'Not enough stock for one of the items in this order';
    end if;

    computed_subtotal := computed_subtotal + (prod.price * item_qty);

    update products set stock = stock - item_qty where id = (item->>'productId')::uuid;
  end loop;

  new.subtotal := computed_subtotal;
  new.total := computed_subtotal + coalesce(new.shipping_fee, 0);
  return new;
end;
$function$;
create trigger before_order_insert before insert on public.orders
  for each row execute function public.compute_order_total();

create or replace function public.restock_on_cancel() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  item jsonb;
begin
  if new.status = 'Cancelled' and old.status <> 'Cancelled' then
    for item in select * from jsonb_array_elements(new.items)
    loop
      update products set stock = stock + (item->>'qty')::int
      where id = (item->>'productId')::uuid;
    end loop;
  end if;
  return new;
end;
$function$;
create trigger after_order_status_update after update on public.orders
  for each row execute function public.restock_on_cancel();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;

create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

create policy products_public_read on public.products for select using (true);
create policy products_admin_write on public.products for insert with check (public.is_admin());
create policy products_admin_update on public.products for update using (public.is_admin());
create policy products_admin_delete on public.products for delete using (public.is_admin());

create policy settings_public_read on public.store_settings for select using (true);
create policy settings_admin_write on public.store_settings for update using (public.is_admin());

create policy cart_own_only on public.cart_items for all
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy orders_select_own_or_admin on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());
create policy orders_insert on public.orders for insert
  with check (customer_id is null or customer_id = auth.uid());
create policy orders_admin_update on public.orders for update using (public.is_admin());

create policy reviews_public_read on public.reviews for select using (true);
create policy reviews_anyone_insert on public.reviews for insert with check (true);
create policy reviews_admin_delete on public.reviews for delete using (public.is_admin());

-- The original bucket; the frontend actually uses 'product-images', created in 202609270002.
insert into storage.buckets (id, name, public) values ('Product Images', 'Product Images', true)
on conflict (id) do nothing;

commit;
