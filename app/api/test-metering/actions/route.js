import { NextResponse } from "next/server";
import { getCostByPath } from "@/libs/monkey/tools/metering_costs";
import { ACTIONS } from "../run-action/actions.js";

/**
 * GET /api/test-metering/actions
 * Returns list of test actions with id, label, cost (for test page UI). Cost from path registry.
 */
export async function GET() {
  const list = Object.entries(ACTIONS).map(([id, config]) => ({
    id,
    label: config.label,
    cost: getCostByPath(config.path),
  }));
  return NextResponse.json(list);
}
