import { POLICY } from "./policies.js";

// The shop's public address, without a trailing slash.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://alammarstore.vercel.app"
).replace(/\/$/, "");

// "2–5" → [2, 5]; "3" → [3, 3].
function dayRange(text) {
  const [min, max = min] = String(text).split(/[–-]/).map(Number);
  return { minValue: min, maxValue: max, unitCode: "DAY" };
}

// Schema.org data Google reads for product search results: the store, the shop's
// search box, a product with its price, delivery and returns, and breadcrumbs.
export function storeData(settings) {
  const name = settings.storeName || "Al Ammar Store";
  const phone = settings.contactPhone || settings.whatsapp;
  return [
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      name,
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
      ...(phone && {
        contactPoint: {
          "@type": "ContactPoint",
          telephone: phone,
          contactType: "customer service",
          areaServed: "PK",
        },
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export function productData(product, settings, reviews) {
  const ratings = reviews.filter((r) => r.rating >= 1 && r.rating <= 5);
  const url = `${SITE_URL}/product/${product.id}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description || undefined,
      image: product.images,
      sku: product.id,
      category: product.category || undefined,
      brand: { "@type": "Brand", name: settings.storeName || "Al Ammar Store" },
      offers: {
        "@type": "Offer",
        url,
        price: product.price,
        priceCurrency: "PKR",
        availability:
          product.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: {
            "@type": "MonetaryAmount",
            value: Number(settings.shippingFee) || 0,
            currency: "PKR",
          },
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "PK",
          },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: {
              "@type": "QuantitativeValue",
              ...dayRange(POLICY.dispatchWorkingDays),
            },
            transitTime: {
              "@type": "QuantitativeValue",
              ...dayRange(POLICY.deliveryWorkingDays),
            },
          },
        },
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "PK",
          returnPolicyCategory:
            "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: POLICY.returnDays,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
        },
      },
      ...(ratings.length && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: (
            ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          ).toFixed(1),
          reviewCount: ratings.length,
        },
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Home", item: SITE_URL },
        ...(product.category
          ? [
              {
                name: product.category,
                item: `${SITE_URL}/?category=${encodeURIComponent(product.category)}`,
              },
            ]
          : []),
        { name: product.name, item: url },
      ].map((crumb, i) => ({ "@type": "ListItem", position: i + 1, ...crumb })),
    },
  ];
}

// For <script type="application/ld+json">: "<" is escaped so text from the database
// cannot close the script tag.
export const jsonLd = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
