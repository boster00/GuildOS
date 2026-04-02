import { createClient } from "@/libs/supabase/server";
import monkey from "@/libs/monkey";
import { logActionTrigger, logTemplateCall, logFinalOutput, logStateUpdate } from "@/libs/monkey/ui/logger";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    // const supabase = await createClient();
    
    // Render the HTML as a string
    const user = await monkey.initUser();
    // 1. use user->id to fetch icp_profiles table. 
    // 1.1 if no rows, return the component "ICPSetupWizard"
    // 1.2 if rows, return the component "ICPList" with the rows as props.
    const aiResult = await monkey.AI("tell a cat joke");
    const html = `
        <main class="min-h-screen p-8 pb-24">
            <h1>Cat Joke</h1>
            <p>${aiResult}</p>
            <p>This API takes post requests.</p>
        </main>
    `;

    return new Response(html, {
        headers: { "Content-Type": "text/html" },
    });
}

export async function POST(request) {
    const externalRequestId = request.headers.get("x-external-request-id") ?? null;
    const startTime = Date.now();
    const supabase = await createClient();

    try {
        // Log raw request
        
        
        // Parse request body
        const requestBody = await request.json();
        const { query, vendor = "openai", model } = requestBody;
        
        // Validate query
        if (!query) {
            return new Response(
                JSON.stringify({ error: "Query parameter is required" }), 
                { 
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }
        
        // Determine mode: high/mid (non-agentic, uses template)
        const mode = model === "gpt-4o" || model === "high" ? "high" : "mid";
        
        // Log action trigger
        logActionTrigger("AI Generate (Template-based)", mode, undefined, {
            vendor: vendor || "default",
            model: model || "default",
            queryLength: query.length,
        });
        
        // Log template usage (this is a template-based call, not agentic)
        logTemplateCall("Direct AI Prompt", query.substring(0, 500));
        
        // Call monkey.AI
        const aiResult = await monkey.AI(query, { vendor, model });
        
        const duration = Date.now() - startTime;

        await finishExternalRequest(supabase, {
            externalRequestId,
            status: "success",
            responsePreview: typeof aiResult === "string" ? aiResult : JSON.stringify(aiResult),
            latencyMs: duration,
        });
        
        // Log final output
        logFinalOutput(aiResult);
        
        // Log state update (though this is API response, not state)
        logStateUpdate("API Response sent to client", aiResult);
        
        // Return response
        const response = {
            response: aiResult,
            result: aiResult, // For backward compatibility
            timestamp: new Date().toISOString(),
            duration: duration,
        };
        return NextResponse.json(response);
        
    } catch (error) {
        const latencyMs = Date.now() - startTime;
        await finishExternalRequest(supabase, {
            externalRequestId,
            status: "failed",
            errorMessage: error?.message ?? String(error),
            latencyMs,
        });
        return NextResponse.json(
            { 
                error: error.message || "AI generation failed",
                details: error.stack
            }, 
            { 
                status: 500
            }
        );
    }
}