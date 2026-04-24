import { redirect } from "next/navigation";

export default async function WeaponsWeaponRedirectPage({ params, searchParams }) {
  const { weaponId } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp && typeof sp === "object") {
    for (const [k, v] of Object.entries(sp)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((item) => q.append(k, item));
      else q.set(k, v);
    }
  }
  const path = `/town-square/forge/${weaponId}`;
  redirect(q.size ? `${path}?${q.toString()}` : path);
}
