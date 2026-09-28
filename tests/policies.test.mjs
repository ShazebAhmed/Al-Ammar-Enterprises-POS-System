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

test("product data for Google has price, delivery, returns and breadcrumbs", async () => {
  const { productData, jsonLd } = await import("../lib/seo.js");
  const [product, crumbs] = productData(
    {
      id: "p1",
      name: "Wallet </script>",
      category: "Men",
      price: 1999,
      stock: 3,
      images: ["https://x/a.webp"],
    },
    { storeName: "Al Ammar Store", shippingFee: 150 },
    [{ rating: 5 }, { rating: 4 }, { rating: 0 }],
  );
  assert.equal(product.offers.price, 1999);
  assert.equal(product.offers.availability, "https://schema.org/InStock");
  assert.equal(product.offers.shippingDetails.shippingRate.value, 150);
  assert.deepEqual(product.offers.shippingDetails.deliveryTime.transitTime, {
    "@type": "QuantitativeValue",
    minValue: 2,
    maxValue: 5,
    unitCode: "DAY",
  });
  assert.equal(product.offers.hasMerchantReturnPolicy.merchantReturnDays, 7);
  assert.equal(product.aggregateRating.ratingValue, "4.5");
  assert.equal(product.aggregateRating.reviewCount, 2);
  assert.deepEqual(
    crumbs.itemListElement.map((c) => c.position + c.name),
    ["1Home", "2Men", "3Wallet </script>"],
  );
  assert.ok(!jsonLd(product).includes("</script>"));
});
