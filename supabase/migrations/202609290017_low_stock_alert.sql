-- Low stock alert: the store's alert devices are told when a product, or one of its
-- options, drops from more than 2 to 2 or fewer (usually because of an order), so
-- there is time to restock. Changes the admin makes themselves are not announced.
begin;

create or replace function public.store_low_stock_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  subs text[];
  low text[] := '{}';
  v jsonb;
  was integer;
  now_left integer;
begin
  begin
    if public.is_store_admin() then return null; end if;
    if jsonb_array_length(new.variants) > 0 then
      for v in select value from jsonb_array_elements(new.variants) loop
        now_left := (v->>'stock')::integer;
        select (o->>'stock')::integer into was
        from jsonb_array_elements(old.variants) o where o->>'name' = v->>'name';
        if was > 2 and now_left <= 2 then
          low := low || ((v->>'name') || ': ' ||
            case when now_left = 0 then 'sold out' else now_left::text || ' left' end);
        end if;
      end loop;
    elsif old.stock > 2 and new.stock <= 2 then
      low := array[case when new.stock = 0 then 'Sold out' else 'Only ' || new.stock::text || ' left' end];
    end if;
    if cardinality(low) = 0 then return null; end if;
    select array_agg(endpoint) into subs from public.push_subscriptions where for_admin;
    perform public.store_queue_push(jsonb_build_object(
      'title', 'Low stock: ' || new.name,
      'body', array_to_string(low, ', ') || '. Time to restock.',
      'url', '/admin',
      'tag', 'stock-' || new.id), subs);
  exception when others then
    -- A notification problem must never stop an order.
    raise warning 'Low stock notification skipped: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.store_low_stock_push() from public, anon, authenticated;

drop trigger if exists store_low_stock_push on public.products;
create trigger store_low_stock_push after update of stock, variants on public.products
  for each row execute function public.store_low_stock_push();

commit;
