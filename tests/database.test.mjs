import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const ADMIN = "11111111-1111-4111-8111-111111111111";
const BUYER = "22222222-2222-4222-8222-222222222222";
const P1 = "a1a1a1a1-0000-4000-8000-000000000001";
const P2 = "a1a1a1a1-0000-4000-8000-000000000002";
const customer = {
  name: "Test buyer",
  phone: "03001234567",
  address: "Test address",
  city: "Karachi",
  notes: "",
};
// Minimal stand-ins for the Supabase platform objects the migrations depend on.
await db.exec(`
create role anon;create role authenticated;create schema auth;create schema storage;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
alter table storage.objects enable row level security;
`);
// Apply every migration in order, exactly as a fresh project would.
const migrations = new URL("../supabase/migrations/", import.meta.url);
for (const file of (await readdir(migrations)).sort())
  await db.exec(await readFile(new URL(file, migrations), "utf8"));
await db.exec(`
grant usage on schema public,auth,storage to anon,authenticated;
grant all on all tables in schema public to anon,authenticated;
grant all on storage.objects to anon,authenticated;
insert into auth.users values ('${ADMIN}','{"name":"Admin"}'),('${BUYER}','{"name":"Buyer"}');
update profiles set is_admin=true where id='${ADMIN}';
insert into products(id,name,price,stock) values('${P1}','Test item',100.25,10),('${P2}','Second item',50,1);
-- Deliberately broad legacy policies: new restrictive guards must still protect data.
create policy legacy_orders on orders for all using(true) with check(true);
create policy legacy_profiles on profiles for all using(true) with check(true);
create policy legacy_products on products for all using(true) with check(true);
`);
async function role(name = "anon", id = "") {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.role','${name}',false);select set_config('request.jwt.claim.sub','${id}',false);set role ${name};`,
  );
}
async function order(key, items, who = customer) {
  return (
    await db.query(
      "select public.place_store_order($1::uuid,$2::jsonb,$3::jsonb) as result",
      [key, JSON.stringify(items), JSON.stringify(who)],
    )
  ).rows[0].result;
}
await role();
const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let saved;
test("database calculates price, shipping and stock without trusting submitted prices", async () => {
  saved = await order(key, [
    { productId: P1, qty: 2, price: 0.01, name: "tampered" },
  ]);
  assert.equal(saved.total, 350.5);
  assert.match(saved.id, /^AA-\d{5,}$/);
  assert.equal(saved.items[0].price, 100.25);
  assert.equal(saved.items[0].name, "Test item");
  assert.equal(
    (await db.query(`select stock from products where id='${P1}'`)).rows[0]
      .stock,
    8,
  );
});
test("retries return the same order without consuming stock twice", async () => {
  assert.equal((await order(key, [{ productId: P1, qty: 2 }])).id, saved.id);
  assert.equal(
    (await db.query(`select stock from products where id='${P1}'`)).rows[0]
      .stock,
    8,
  );
});
test("insufficient stock rolls back every line in the transaction", async () => {
  await assert.rejects(
    () =>
      order("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", [
        { productId: P1, qty: 1 },
        { productId: P2, qty: 2 },
      ]),
    /stock/,
  );
  assert.equal(
    (await db.query(`select stock from products where id='${P1}'`)).rows[0]
      .stock,
    8,
  );
});
test("fractional and negative quantities are rejected", async () => {
  await assert.rejects(
    () =>
      order("cccccccc-cccc-4ccc-8ccc-cccccccccccc", [
        { productId: P1, qty: -1 },
      ]),
    /quantity/,
  );
  await assert.rejects(
    () =>
      order("cccccccc-cccc-4ccc-8ccc-cccccccccccc", [
        { productId: P1, qty: 1.5 },
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
        [JSON.stringify([{ productId: P1, qty: 1 }])],
      ),
    /row-level security/,
  );
  await db.exec(`update products set price=1 where id='${P1}'`);
  assert.equal(
    Number(
      (await db.query(`select price from products where id='${P1}'`)).rows[0]
        .price,
    ),
    100.25,
  );
});
test("customer cannot self-promote to admin or access another customer profile", async () => {
  await role("authenticated", BUYER);
  await assert.rejects(
    () => db.exec(`update profiles set is_admin=true where id='${BUYER}'`),
    /self-assigned/,
  );
  assert.equal((await db.query("select * from profiles")).rows.length, 1);
});
test("admin cancellation restores reserved stock exactly once", async () => {
  await role("authenticated", ADMIN);
  await db.query("update orders set status='Cancelled' where id=$1", [
    saved.id,
  ]);
  assert.equal(
    (await db.query(`select stock from products where id='${P1}'`)).rows[0]
      .stock,
    10,
  );
  await db.query("update orders set status='Cancelled' where id=$1", [
    saved.id,
  ]);
  assert.equal(
    (await db.query(`select stock from products where id='${P1}'`)).rows[0]
      .stock,
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
  await role("authenticated", BUYER);
  const own = await order("dddddddd-dddd-4ddd-8ddd-dddddddddddd", [
    { productId: P1, qty: 1 },
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
  await role("authenticated", ADMIN);
  await assert.rejects(
    () => db.query("update orders set status=null where id=$1", [own.id]),
    /transition/,
  );
});
test("signup creates a non-admin profile through the auth trigger", async () => {
  await role();
  const { rows } = await db.query(
    "select name, is_admin from profiles where id = $1",
    [BUYER],
  );
  assert.equal(rows.length, 0); // guests cannot read profiles
  await db.exec("reset role");
  const own = (
    await db.query("select name, is_admin from profiles where id = $1", [BUYER])
  ).rows[0];
  assert.deepEqual(own, { name: "Buyer", is_admin: false });
});
test("only admins can upload product images", async () => {
  const upload = (name) =>
    db.query(
      "insert into storage.objects(bucket_id,name) values('product-images',$1)",
      [name],
    );
  await role("authenticated", BUYER);
  await assert.rejects(
    () => upload("products/buyer.jpg"),
    /row-level security/,
  );
  await role("authenticated", ADMIN);
  await upload("products/admin.jpg");
});
test("new reviews stay hidden until an admin approves them", async () => {
  const review = (approved) =>
    db.query(
      "insert into reviews(product_id,customer_name,rating,comment,approved) values($1,'Guest',5,'Great',$2)",
      [P1, approved],
    );
  await role();
  await assert.rejects(() => review(true), /row-level security/);
  await review(false);
  assert.equal((await db.query("select * from reviews")).rows.length, 0);
  await role("authenticated", ADMIN);
  await db.exec("update reviews set approved = true");
  await role();
  assert.equal((await db.query("select * from reviews")).rows.length, 1);
});
test("one phone number is limited to three open and five hourly orders", async () => {
  // The same number typed in every accepted format must count as one customer.
  const formats = [
    "0321 7654321",
    "+92 321 7654321",
    "0092-321-7654321",
    "3217654321",
    "+923217654321",
    "03217654321",
    "0321-7654321",
  ];
  const place = (n) =>
    order(
      `eeeeeeee-eeee-4eee-8eee-00000000000${n}`,
      [{ productId: P1, qty: 1 }],
      { ...customer, phone: formats[n - 1] },
    );
  await role();
  for (const n of [1, 2, 3]) await place(n);
  await assert.rejects(() => place(4), /Too many open orders/);
  await role("authenticated", ADMIN);
  await db.exec(
    "update orders set status = 'Cancelled' where public.store_phone_key(customer_phone) = '03217654321'",
  );
  await role();
  await place(5);
  await place(6);
  await assert.rejects(() => place(7), /Too many orders for this phone/);
});
test("guest orders are capped at twenty per ten minutes", async () => {
  await db.exec(
    `reset role; update products set stock = 1000 where id = '${P1}'`,
  );
  await role();
  let placed = 0;
  let error;
  for (let n = 10; n < 40 && !error; n++) {
    try {
      await order(
        `ffffffff-ffff-4fff-8fff-0000000000${n}`,
        [{ productId: P1, qty: 1 }],
        { ...customer, phone: `03330000${n}` },
      );
      placed++;
    } catch (e) {
      error = e;
    }
  }
  assert.match(error?.message ?? "", /Too many guest orders/);
  await db.exec("reset role");
  const { rows } = await db.query(
    "select count(*)::int as n from orders where customer_id is null",
  );
  assert.equal(rows[0].n, 20);
  assert.ok(placed > 0);
});
test("admin can cancel orders left pending too long and their stock returns", async () => {
  const buyer = { ...customer, phone: "0345 1111111" };
  const stock = async () =>
    (await db.query(`select stock from products where id='${P1}'`)).rows[0]
      .stock;
  await role("authenticated", BUYER);
  const old = await order(
    "abababab-abab-4bab-8bab-000000000001",
    [{ productId: P1, qty: 2 }],
    buyer,
  );
  const recent = await order(
    "abababab-abab-4bab-8bab-000000000002",
    [{ productId: P1, qty: 1 }],
    buyer,
  );
  await db.exec(`reset role;
    alter table orders disable trigger store_order_validation;
    update orders set created_at = now() - interval '5 days' where id = '${old.id}';
    alter table orders enable trigger store_order_validation;`);
  const before = await stock();
  const cancel = (days) =>
    db.query("select public.cancel_stale_orders($1) as n", [days]);
  await role("authenticated", BUYER);
  await assert.rejects(() => cancel(3), /Administrator/);
  await role("authenticated", ADMIN);
  await assert.rejects(() => cancel(0), /Invalid number of days/);
  assert.equal((await cancel(3)).rows[0].n, 1);
  const status = async (id) =>
    (await db.query("select status from orders where id = $1", [id])).rows[0]
      .status;
  assert.equal(await status(old.id), "Cancelled");
  assert.equal(await status(recent.id), "Pending");
  assert.equal(await stock(), before + 2);
});
test.after(async () => {
  await db.close();
});
