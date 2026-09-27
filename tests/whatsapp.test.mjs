import test from "node:test";
import assert from "node:assert/strict";
import {
  whatsappPhone,
  whatsappOrderMessage,
  whatsappOrderLink,
} from "../lib/whatsapp.js";

const settings = {
  whatsapp: "0321 7654321",
  currencySymbol: "Rs.",
  shippingFee: 250,
};
const lines = [
  { product: { name: "Tea 950g", price: 1450 }, qty: 2 },
  { product: { name: "Soap", price: 120.5 }, qty: 1 },
];

test("store WhatsApp numbers in any common format become wa.me numbers", () => {
  for (const input of [
    "0321 7654321",
    "+92 321 7654321",
    "0092-321-7654321",
    "3217654321",
    "923217654321",
  ])
    assert.equal(whatsappPhone(input), "923217654321", input);
  assert.equal(whatsappPhone(""), "");
  assert.equal(whatsappPhone("12345"), "");
});

test("order message lists items, delivery and total", () => {
  const text = whatsappOrderMessage(lines, settings);
  assert.match(text, /• 2 × Tea 950g \(Rs\. 1,450 each\)/);
  assert.match(text, /• 1 × Soap \(Rs\. 120\.5 each\)/);
  assert.match(text, /Delivery: Rs\. 250/);
  assert.match(text, /Total: Rs\. 3,270\.5/);
});

test("no link without a store number or without items", () => {
  assert.equal(whatsappOrderLink({ ...settings, whatsapp: "" }, lines), "");
  assert.equal(whatsappOrderLink(settings, []), "");
  assert.equal(whatsappOrderLink(settings, [{ product: null, qty: 1 }]), "");
  const link = whatsappOrderLink(settings, lines);
  assert.ok(link.startsWith("https://wa.me/923217654321?text="));
  assert.match(decodeURIComponent(link), /Tea 950g/);
});
