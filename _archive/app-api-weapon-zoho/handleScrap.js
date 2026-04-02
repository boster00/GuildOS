import { requireUser } from "@/libs/council/auth/server";
import { deleteZohoConnection } from "@/libs/weapon/zoho/connection.js";

export async function handleZohoScrap() {
  const user = await requireUser();
  const { error } = await deleteZohoConnection(user.id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
