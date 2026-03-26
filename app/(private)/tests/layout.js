import { notFound, redirect } from "next/navigation";
import { createClient } from "@/libs/supabase/server";
import config from "@/config";

/**
 * Tests section: only available in development and only to users whose email
 * is in ADMIN_EMAIL or ADMIN_EMAILS.
 */
export default async function TestsLayout({ children }) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(config.auth.loginUrl);
  }

  const adminEmails = [
    ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim().toLowerCase()] : []),
    ...(process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      : []),
  ];
  const isAdmin = adminEmails.includes((user.email || "").toLowerCase());

  if (!isAdmin) {
    notFound();
  }

  return <>{children}</>;
}
