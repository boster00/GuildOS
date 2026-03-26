import { redirect } from "next/navigation";

/** Alias for sign-in; preserves bookmark-friendly /login URL. */
export default async function LoginAliasPage({ searchParams }) {
  const sp = await searchParams;
  const next = sp?.next;
  const q = typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? `?next=${encodeURIComponent(next)}`
    : "";
  redirect(`/signin${q}`);
}
