import Link from "next/link";
import { getSettings } from "@/lib/catalogue";
import { faq } from "@/lib/policies";
import { jsonLd } from "@/lib/seo";

export const revalidate = 300;
export const metadata = {
  title: "Questions & answers",
  description: "Payment, delivery, tracking, returns and discount codes.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const settings = await getSettings();
  const items = faq(settings);
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <main className="page-wrap policy-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
      />
      <div className="page-heading">
        <span className="eyebrow">HELP</span>
        <h1>
          Questions &amp; answers<span className="gold-dot">.</span>
        </h1>
        <p>Quick answers about ordering, delivery and returns.</p>
      </div>
      <div className="faq-list">
        {items.map(({ q, a }) => (
          <details className="faq-item" key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <p className="policy-other">
        Still need help? See <Link href="/policies/shipping">Shipping</Link>,{" "}
        <Link href="/policies/returns">Returns</Link> or{" "}
        <Link href="/track">Track your order</Link>.
      </p>
    </main>
  );
}
