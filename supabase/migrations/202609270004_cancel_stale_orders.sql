-- Lets an admin cancel cash-on-delivery orders that have stayed Pending too long, so the stock
-- they reserve returns to the shop. Nothing is cancelled automatically.
begin;

create or replace function public.cancel_stale_orders(p_days integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare cancelled integer;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'Invalid number of days'; end if;
  -- Each update goes through validate_store_order, which restores reserved stock once.
  update public.orders set status = 'Cancelled'
  where status = 'Pending' and created_at < now() - make_interval(days => p_days);
  get diagnostics cancelled = row_count;
  return cancelled;
end;
$$;
revoke all on function public.cancel_stale_orders(integer) from public;
grant execute on function public.cancel_stale_orders(integer) to authenticated;

commit;
