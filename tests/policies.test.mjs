import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICY,
  returnPolicy,
  shippingPolicy,
  billPolicySummary,
} from "../lib/policies.js";

const settings = {
  shippingFee: 250,
  currencySymbol: "Rs.",
  whatsapp: "03333386641",
  contactPhone: "03333386641",
};
const text = (sections) =>
  sections.flatMap((s) => [s.title, ...s.points]).join("\n");

test("policies use the store's own delivery fee, contact and terms", () => {
  const shipping = text(shippingPolicy(settings));
  assert.match(shipping, /Rs\. 250 per order/);
  assert.match(shipping, /WhatsApp at 03333386641/);
  assert.doesNotMatch(shipping, /by phone at 03333386641/); // same number once
  const returns = text(returnPolicy(settings));
  assert.match(returns, new RegExp(`within ${POLICY.returnDays} days`));
  assert.match(
    billPolicySummary(),
    new RegExp(`${POLICY.damageReportHours} hours`),
  );
});

test("policies still read well without contact details", () => {
  const shipping = text(shippingPolicy({ shippingFee: 150 }));
  assert.match(shipping, /Rs\. 150 per order/);
  assert.match(shipping, /through the contact details below/);
});
