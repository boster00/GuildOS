import { NextResponse } from "next/server";
import * as vercel from "@/libs/weapon/vercel";

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "checkCredentials") {
      return json(await vercel.checkCredentials());
    }
    if (action === "searchProjects") {
      return json(await vercel.searchProjects({ limit: searchParams.get("limit") || 20 }));
    }
    if (action === "searchDeployments") {
      return json(
        await vercel.searchDeployments({
          projectId: searchParams.get("projectId"),
          limit: searchParams.get("limit") || 20,
        }),
      );
    }
    if (action === "searchDomains") {
      return json(await vercel.searchDomains());
    }
    if (action === "readUser") {
      return json(await vercel.readUser());
    }
    if (action === "searchTeams") {
      return json(await vercel.searchTeams());
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const body = await req.json().catch(() => ({}));

  try {
    if (action === "readProject") {
      return json(await vercel.readProject(body));
    }
    if (action === "readDeployment") {
      return json(await vercel.readDeployment(body));
    }
    if (action === "searchEnvVars") {
      return json(await vercel.searchEnvVars(body));
    }
    if (action === "writeEnvVar") {
      return json(await vercel.writeEnvVar(body));
    }
    if (action === "redeploy") {
      return json(await vercel.redeploy(body));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
