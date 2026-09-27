import PolicyPage from "@/components/PolicyPage";
import { getSettings } from "@/lib/catalogue";
import { returnPolicy } from "@/lib/policies";

export const revalidate = 300;
export const metadata = {
  title: "Returns & refunds",
  description: "How to return, exchange or get a refund for your order.",
};

export default async function ReturnsPolicyPage() {
  const settings = await getSettings();
  return (
    <PolicyPage
      eyebrow="RETURNS & REFUNDS"
      title="Easy returns, honest refunds"
      intro="If something isn't right, we'll help you put it right. Here is how returns, exchanges and refunds work."
      sections={returnPolicy(settings)}
      other={{ href: "/policies/shipping", label: "Shipping & delivery" }}
    />
  );
}
