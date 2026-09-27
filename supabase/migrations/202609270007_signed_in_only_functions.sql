-- Supabase grants EXECUTE on new public functions to anon (guests) directly, so the
-- earlier "revoke ... from public" did not remove it. These two are for signed-in users
-- only; both already refuse guests inside, this removes the grant as well.
begin;

revoke execute on function public.delete_my_account() from anon;
revoke execute on function public.cancel_stale_orders(integer) from anon;

commit;
