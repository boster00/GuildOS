import { redirect } from "next/navigation";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";
import Pricing from "@/components/Pricing";
import { createClient } from "@/libs/supabase/server";

export const metadata = getSEOTags({
  title: `Pricing | ${config.appName}`,
  canonicalUrlRelative: "/pricing",
});

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect("/billing/subscriptions");
  }
  return <Pricing variant="public" />;
}
