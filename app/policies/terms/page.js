import PolicyPage from "@/components/PolicyPage";
import { getSettings } from "@/lib/catalogue";
import { termsPolicy } from "@/lib/policies";

export const revalidate = 300;
export const metadata = {
  title: "Terms & conditions",
  description: "The terms that apply when you shop with us.",
  alternates: { canonical: "/policies/terms" },
};

export default async function TermsPage() {
  const settings = await getSettings();
  return (
    <PolicyPage
      eyebrow="TERMS & CONDITIONS"
      title="The fine print, in plain words"
      intro="What you can expect from us, and what we ask of you, when you order."
      sections={termsPolicy(settings)}
      other={{ href: "/policies/returns", label: "Returns & refunds" }}
    />
  );
}
