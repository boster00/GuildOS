import { requireUser } from "@/libs/council/auth/server";
import { getZohoWeaponStatus } from "@/libs/weapon/zoho";

export async function handleZohoStatus() {
  const user = await requireUser();
  const status = await getZohoWeaponStatus(user.id);
  return Response.json(status);
}
