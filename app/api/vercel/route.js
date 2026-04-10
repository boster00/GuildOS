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
    if (action === "listProjects") {
      return json(await vercel.listProjects({ limit: searchParams.get("limit") || 20 }));
    }
    if (action === "listDeployments") {
      return json(
        await vercel.listDeployments({
          projectId: searchParams.get("projectId"),
          limit: searchParams.get("limit") || 20,
        }),
      );
    }
    if (action === "listDomains") {
      return json(await vercel.listDomains());
    }
    if (action === "getUser") {
      return json(await vercel.getUser());
    }
    if (action === "listTeams") {
      return json(await vercel.listTeams());
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
    if (action === "getProject") {
      return json(await vercel.getProject(body));
    }
    if (action === "getDeployment") {
      return json(await vercel.getDeployment(body));
    }
    if (action === "listEnvVars") {
      return json(await vercel.listEnvVars(body));
    }
    if (action === "createEnvVar") {
      return json(await vercel.createEnvVar(body));
    }
    if (action === "redeploy") {
      return json(await vercel.redeploy(body));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
