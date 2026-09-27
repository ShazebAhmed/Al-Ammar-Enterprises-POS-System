import PolicyPage from "@/components/PolicyPage";
import { getSettings } from "@/lib/catalogue";
import { shippingPolicy } from "@/lib/policies";

export const revalidate = 300;
export const metadata = {
  title: "Shipping & delivery",
  description:
    "Delivery charges, dispatch times and how your order reaches you.",
};

export default async function ShippingPolicyPage() {
  const settings = await getSettings();
  return (
    <PolicyPage
      eyebrow="SHIPPING & DELIVERY"
      title="From our shelf to your door"
      intro="What delivery costs, when your order leaves us, and how long it takes to reach you."
      sections={shippingPolicy(settings)}
      other={{ href: "/policies/returns", label: "Returns & refunds" }}
    />
  );
}
