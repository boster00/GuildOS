/**
 * API endpoint for Step 1: Organize ICP and Offer
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { analyzeOfferType } from "@/libs/monkey/actions/analyzeOfferType";
import { extractTalkPoints } from "@/libs/monkey/actions/extractTalkPoints";
import { inferHookPoints } from "@/libs/monkey/actions/inferHookPoints";
import { log } from "@/libs/monkey/ui/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model = "high", icp, offer } = body;

    if (!icp) {
      return NextResponse.json(
        { error: "icp is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    log(`[step1 API] Starting Step 1 for ICP: ${icp.name}, Offer: ${offer?.name || "none"}`);

    // Use provided ICP and Offer data directly
    const icpData = icp;
    const offerData = offer || null;

    // Initialize step result structure
    const stepResult: {
      stepId: string;
      stepName: string;
      status: "running" | "done" | "error";
      payload: any;
      tools: any[];
      output: any;
      error: any;
    } = {
      stepId: "step1_organize",
      stepName: "Organize ICP and Offer",
      status: "running",
      payload: { model, icp: icpData, offer: offerData },
      tools: [],
      output: null,
      error: null,
    };

    try {
      // Tool 1: Analyze Offer Type
      const tool1Start = Date.now();
      log(`[step1 API] Tool 1: Analyzing offer type...`);
      
      let tool1Result;
      try {
        const analyzeResult = await analyzeOfferType(model, icpData, offerData || {});
        tool1Result = {
          toolId: "tool1",
          toolName: "Analyze Offer Type",
          input: { icp: icpData, offer: offerData },
          output: analyzeResult,
          outputRaw: JSON.stringify(analyzeResult, null, 2),
          error: null,
        };
        log(`[step1 API] Tool 1 completed: ${analyzeResult.offerType}`);
      } catch (error: any) {
        tool1Result = {
          toolId: "tool1",
          toolName: "Analyze Offer Type",
          input: { icp: icpData, offer: offerData },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step1 API] Tool 1 failed: ${error.message}`);
      }
      stepResult.tools.push(tool1Result);

      // Tool 2: Extract Talk Points
      const tool2Start = Date.now();
      log(`[step1 API] Tool 2: Extracting talk points...`);
      
      let tool2Result;
      try {
        const talkPointsResult = await extractTalkPoints(model, icpData, offerData || {});
        tool2Result = {
          toolId: "tool2",
          toolName: "Extract Talk Points",
          input: { icp: icpData, offer: offerData },
          output: talkPointsResult,
          outputRaw: JSON.stringify(talkPointsResult, null, 2),
          error: null,
        };
        log(`[step1 API] Tool 2 completed: ${talkPointsResult.uniqueSellingPoints.length} USPs`);
      } catch (error: any) {
        tool2Result = {
          toolId: "tool2",
          toolName: "Extract Talk Points",
          input: { icp: icpData, offer: offerData },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step1 API] Tool 2 failed: ${error.message}`);
      }
      stepResult.tools.push(tool2Result);

      // Tool 3: Infer Hook Points
      const tool3Start = Date.now();
      log(`[step1 API] Tool 3: Inferring hook points...`);
      
      let tool3Result;
      try {
        const organizedAssets = tool1Result.output && tool2Result.output ? {
          offerType: tool1Result.output,
          talkPoints: tool2Result.output,
        } : null;
        
        const hookPointsResult = await inferHookPoints(model, icpData, offerData || {}, organizedAssets);
        tool3Result = {
          toolId: "tool3",
          toolName: "Infer Hook Points",
          input: { icp: icpData, offer: offerData, organizedAssets },
          output: hookPointsResult,
          outputRaw: JSON.stringify(hookPointsResult, null, 2),
          error: null,
        };
        log(`[step1 API] Tool 3 completed: Selected ${hookPointsResult.selected.type} hook`);
      } catch (error: any) {
        tool3Result = {
          toolId: "tool3",
          toolName: "Infer Hook Points",
          input: { icp: icpData, offer: offerData },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step1 API] Tool 3 failed: ${error.message}`);
      }
      stepResult.tools.push(tool3Result);

      // Compile final output
      stepResult.output = {
        icp: icpData,
        offer: offerData,
        offerTypeAnalysis: tool1Result.output,
        talkPoints: tool2Result.output,
        hookPoints: tool3Result.output,
      };
      stepResult.status = "done";

      log(`[step1 API] Step 1 completed successfully`);

      return NextResponse.json({
        ok: true,
        tools: stepResult.tools,
        output: stepResult.output,
      });
    } catch (error: any) {
      log(`[step1 API] Step 1 failed: ${error.message}`);
      stepResult.status = "error";
      stepResult.error = { message: error.message, stack: error.stack };

      return NextResponse.json({
        ok: false,
        tools: stepResult.tools,
        output: null,
        error: error.message,
      });
    }
  } catch (error: any) {

    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
