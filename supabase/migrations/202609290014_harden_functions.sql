-- Hardening from the Supabase Security Advisor.
--
-- 1. Trigger functions run only as triggers. Postgres checks EXECUTE when a trigger is
--    created, not when it fires, so signed-out and signed-in visitors do not need to
--    call them directly through the API.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 2. The original "anyone can insert a review" policy is replaced by
--    store_reviews_submit (rating 1-5, name and comment length), so drop the old one.
drop policy if exists reviews_anyone_insert on public.reviews;
