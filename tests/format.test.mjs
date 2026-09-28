import test from "node:test";
import assert from "node:assert/strict";
import { formatOrderTime } from "../lib/format.js";

test("order times are shown in Pakistan time with date and time", () => {
  // 10:46 UTC is 3:46 pm in Karachi (UTC+5).
  // Browsers print "Sep" or "Sept" depending on their locale data.
  assert.match(
    formatOrderTime("2026-09-27T10:46:00Z"),
    /^27 Sept? 2026, 3:46 pm$/i,
  );
  assert.equal(formatOrderTime("not a date"), "");
});

test("search matches name, category or description, with symbols taken literally", async () => {
  const { searchFilter } = await import("../lib/format.js");
  assert.equal(
    searchFilter("wallet"),
    'name.ilike."%wallet%",category.ilike."%wallet%",description.ilike."%wallet%"',
  );
  // %, _ and \ are escaped for ILIKE; " and \ again for the quoted value.
  assert.ok(
    searchFilter('50% "off", a_b').startsWith(
      String.raw`name.ilike."%50\\% \"off\", a\\_b%"`,
    ),
  );
});

test("orders export as a spreadsheet-safe CSV", async () => {
  const { ordersCsv } = await import("../lib/format.js");
  const csv = ordersCsv([
    {
      id: "AA-10001",
      createdAt: "2026-09-28T10:00:00Z",
      status: "Pending",
      customer: {
        name: '=HYPERLINK("x")',
        phone: "+923001234567",
        address: "House 1, Street 2",
        city: "Lahore",
        notes: "",
      },
      items: [{ name: "Wallet", variant: "Black", qty: 2, price: 10 }],
      subtotal: 20,
      discount: 0,
      couponCode: "",
      shippingFee: 150,
      total: 170,
    },
  ]);
  const [header, row] = csv.replace("\uFEFF", "").trim().split("\r\n");
  assert.ok(csv.startsWith("\uFEFFOrder,Date,Status"));
  assert.match(header, /Delivery,Total$/);
  assert.match(row, /^AA-10001,/);
  assert.match(
    row,
    /,"'=HYPERLINK\(""x""\)",\+923001234567,"House 1, Street 2",Lahore,/,
  );
  assert.match(row, /,Wallet \(Black\) x 2,20,0,,150,170$/);
});
