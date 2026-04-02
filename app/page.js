import { redirect } from "next/navigation";
import { getCurrentUser } from "@/libs/council/auth/server";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/opening" : "/signin");
}
