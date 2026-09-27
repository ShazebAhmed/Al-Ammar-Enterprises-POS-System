import PolicyPage from "@/components/PolicyPage";
import { getSettings } from "@/lib/catalogue";
import { deleteAccountPolicy } from "@/lib/policies";

export const revalidate = 300;
export const metadata = {
  title: "Delete your account",
  description:
    "How to delete your Al Ammar Store account and what happens to your data.",
};

export default async function DeleteAccountPage() {
  const settings = await getSettings();
  return (
    <PolicyPage
      eyebrow="DELETE YOUR ACCOUNT"
      title="Delete your Al Ammar Store account"
      intro="You can delete your account on the website or in the Al Ammar Store app at any time."
      sections={deleteAccountPolicy(settings)}
      other={{ href: "/policies/privacy", label: "Privacy policy" }}
    />
  );
}
