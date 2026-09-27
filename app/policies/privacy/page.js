import PolicyPage from "@/components/PolicyPage";
import { getSettings } from "@/lib/catalogue";
import { privacyPolicy } from "@/lib/policies";

export const revalidate = 300;
export const metadata = {
  title: "Privacy policy",
  description: "What information we collect, why, and how to delete it.",
};

export default async function PrivacyPolicyPage() {
  const settings = await getSettings();
  return (
    <PolicyPage
      eyebrow="PRIVACY POLICY"
      title="Your information, kept simple"
      intro="What we collect when you shop with us, why we need it, who else sees it, and how to delete it."
      sections={privacyPolicy(settings)}
      other={{ href: "/policies/delete-account", label: "Delete your account" }}
    />
  );
}
