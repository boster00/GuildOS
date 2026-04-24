import { database } from "@/libs/council/database";
import { getSiteUrl } from "@/libs/council/auth/urls";

export async function POST(request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    return Response.redirect(`${getSiteUrl()}/signin?error=missing_email`);
  }

  const db = await database.init("server");
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/api/council/auth/callback?next=/tavern`,
    },
  });

  if (error) {
    return Response.redirect(`${getSiteUrl()}/signin?error=otp_failed`);
  }

  return Response.redirect(`${getSiteUrl()}/signin?sent=1`);
}
