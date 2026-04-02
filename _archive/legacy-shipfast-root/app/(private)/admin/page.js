import { redirect } from "next/navigation";
import { createClient } from "@/libs/supabase/server";
import config from "@/config";
import AdminDashboard from "./AdminDashboard";

function getAdminEmails() {
  return [
    ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim().toLowerCase()] : []),
    ...(process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      : []),
  ];
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(config.auth.loginUrl);
  }

  const adminEmails = getAdminEmails();
  const isAdmin = adminEmails.includes((user.email || "").toLowerCase());

  if (!isAdmin) {
    redirect(config.auth.callbackUrl || "/tutorials");
  }

  return <AdminDashboard />;
}
