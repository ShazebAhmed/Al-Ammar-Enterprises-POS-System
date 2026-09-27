-- Run immediately after 202609270001_secure_store_orders.sql on the live project.
begin;

-- The live project already had its own order triggers: compute_order_total (sets totals and
-- deducts stock on insert) and restock_on_cancel (restores stock on cancel). validate_store_order
-- now does both, so keeping them would deduct and restore stock twice.
drop trigger if exists before_order_insert on public.orders;
drop trigger if exists after_order_status_update on public.orders;

-- The admin uploads to the 'product-images' bucket, but the live project only had an empty
-- bucket named 'Product Images' and no storage policies, so uploads always failed.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

create policy store_image_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_store_admin());
create policy store_image_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_store_admin())
  with check (bucket_id = 'product-images' and public.is_store_admin());
create policy store_image_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_store_admin());

commit;
