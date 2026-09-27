import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const customer = {
  name: "Test buyer",
  phone: "03001234567",
  address: "Test address",
  city: "Karachi",
  notes: "",
};
await db.exec(`
create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table profiles(id uuid primary key,name text,phone text,is_admin boolean default false);
create table products(id text primary key,name text,price numeric,stock integer,created_at timestamptz default now());
create table store_settings(id integer primary key,shipping_fee numeric);
create table orders(id text primary key,customer_id uuid,items jsonb,subtotal numeric,shipping_fee numeric,total numeric,customer_name text,customer_phone text,customer_address text,customer_city text,customer_notes text,status text,created_at timestamptz default now());
create table cart_items(customer_id uuid,product_id text,qty integer);
create table reviews(id integer,product_id text,customer_name text,rating integer,comment text);
grant usage on schema public,auth to anon,authenticated;
grant all on all tables in schema public to anon,authenticated;
insert into profiles values ('11111111-1111-4111-8111-111111111111','Admin','',true),('22222222-2222-4222-8222-222222222222','Buyer','',false);
insert into products values('p1','Test item',100.25,10,now()),('p2','Second item',50,1,now());
insert into store_settings values(1,150);
-- Deliberately broad legacy policies: new restrictive guards must still protect data.
alter table orders enable row level security;create policy legacy_orders on orders for all using(true) with check(true);
alter table profiles enable row level security;create policy legacy_profiles on profiles for all using(true) with check(true);
alter table products enable row level security;create policy legacy_products on products for all using(true) with check(true);
`);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/202609270001_secure_store_orders.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
async function role(name = "anon", id = "") {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.role','${name}',false);select set_config('request.jwt.claim.sub','${id}',false);set role ${name};`,
  );
}
async function order(key, items) {
  return (
    await db.query(
      "select public.place_store_order($1::uuid,$2::jsonb,$3::jsonb) as result",
      [key, JSON.stringify(items), JSON.stringify(customer)],
    )
  ).rows[0].result;
}
await role();
const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let saved;
test("database calculates price, shipping and stock without trusting submitted prices", async () => {
  saved = await order(key, [
    { productId: "p1", qty: 2, price: 0.01, name: "tampered" },
  ]);
  assert.equal(saved.total, 350.5);
  assert.equal(saved.items[0].price, 100.25);
  assert.equal(saved.items[0].name, "Test item");
  assert.equal(
    (await db.query("select stock from products where id='p1'")).rows[0].stock,
    8,
  );
});
test("retries return the same order without consuming stock twice", async () => {
  assert.equal((await order(key, [{ productId: "p1", qty: 2 }])).id, saved.id);
  assert.equal(
    (await db.query("select stock from products where id='p1'")).rows[0].stock,
    8,
  );
});
test("insufficient stock rolls back every line in the transaction", async () => {
  await assert.rejects(
    () =>
      order("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", [
        { productId: "p1", qty: 1 },
        { productId: "p2", qty: 2 },
      ]),
    /stock/,
  );
  assert.equal(
    (await db.query("select stock from products where id='p1'")).rows[0].stock,
    8,
  );
});
test("fractional and negative quantities are rejected", async () => {
  await assert.rejects(
    () =>
      order("cccccccc-cccc-4ccc-8ccc-cccccccccccc", [
        { productId: "p1", qty: -1 },
      ]),
    /quantity/,
  );
  await assert.rejects(
    () =>
      order("cccccccc-cccc-4ccc-8ccc-cccccccccccc", [
        { productId: "p1", qty: 1.5 },
      ]),
    /quantity/,
  );
});
test("guest cannot read orders, insert directly, or change prices despite legacy policies", async () => {
  assert.equal((await db.query("select * from orders")).rows.length, 0);
  await assert.rejects(
    () =>
      db.query(
        "insert into orders(id,items,customer_name,customer_phone,customer_address,customer_city) values('bad',$1,'Test','03001234567','Road','Karachi')",
        [JSON.stringify([{ productId: "p1", qty: 1 }])],
      ),
    /row-level security/,
  );
  await db.exec("update products set price=1 where id='p1'");
  assert.equal(
    Number(
      (await db.query("select price from products where id='p1'")).rows[0]
        .price,
    ),
    100.25,
  );
});
test("customer cannot self-promote to admin or access another customer profile", async () => {
  await role("authenticated", "22222222-2222-4222-8222-222222222222");
  await assert.rejects(
    () =>
      db.exec(
        "update profiles set is_admin=true where id='22222222-2222-4222-8222-222222222222'",
      ),
    /self-assigned/,
  );
  assert.equal((await db.query("select * from profiles")).rows.length, 1);
});
test("admin cancellation restores reserved stock exactly once", async () => {
  await role("authenticated", "11111111-1111-4111-8111-111111111111");
  await db.query("update orders set status='Cancelled' where id=$1", [
    saved.id,
  ]);
  assert.equal(
    (await db.query("select stock from products where id='p1'")).rows[0].stock,
    10,
  );
  await db.query("update orders set status='Cancelled' where id=$1", [
    saved.id,
  ]);
  assert.equal(
    (await db.query("select stock from products where id='p1'")).rows[0].stock,
    10,
  );
  await assert.rejects(
    () =>
      db.query("update orders set status='Pending' where id=$1", [saved.id]),
    /transition/,
  );
  await assert.rejects(
    () => db.query("update orders set total=1 where id=$1", [saved.id]),
    /snapshots/,
  );
});
test("authenticated orders are visible only to their owner and admins", async () => {
  await role("authenticated", "22222222-2222-4222-8222-222222222222");
  const own = await order("dddddddd-dddd-4ddd-8ddd-dddddddddddd", [
    { productId: "p1", qty: 1 },
  ]);
  const rows = (await db.query("select id from orders")).rows;
  assert.deepEqual(
    rows.map((r) => r.id),
    [own.id],
  );
  await role();
  assert.equal((await db.query("select id from orders")).rows.length, 0);
  await assert.rejects(
    () => order("dddddddd-dddd-4ddd-8ddd-dddddddddddd", []),
    /access denied/,
  );
  await role("authenticated", "11111111-1111-4111-8111-111111111111");
  await assert.rejects(
    () => db.query("update orders set status=null where id=$1", [own.id]),
    /transition/,
  );
});
test.after(async () => {
  await db.close();
});
