import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";
import AI_MODELS from "@/config/ai-models";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, context, assets } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Initialize Monkey for AI calls
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Build the prompt with context if provided
    let prompt = message;
    
    if (context) {
      // Add context information to the prompt if available
      if (context.icpId) {
        // Fetch ICP details if needed
        const { data: icp } = await supabase
          .from("icps")
          .select("*")
          .eq("id", context.icpId)
          .eq("user_id", user.id)
          .single();

        if (icp) {
          const icpFields = Object.entries(icp)
            .filter(([key, value]) => {
              return value && 
                     typeof value === 'string' && 
                     value.trim().length > 0 &&
                     !['id', 'user_id', 'created_at', 'updated_at'].includes(key);
            })
            .map(([key, value]) => {
              const label = key
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              return `• ${label}: ${value}`;
            });
          
          if (icpFields.length > 0) {
            prompt = `**ICP Profile Context:**\n${icpFields.join('\n')}\n\n${prompt}`;
          }
        }
      }

      // Add offer context if available
      if (context.offerId || context.offerName) {
        const offerInfo = [];
        if (context.offerName) offerInfo.push(`Offer: ${context.offerName}`);
        if (context.offerDescription) offerInfo.push(`Description: ${context.offerDescription}`);
        if (offerInfo.length > 0) {
          prompt = `**Offer Context:**\n${offerInfo.join('\n')}\n\n${prompt}`;
        }
      }
    }

    // Call AI to generate response
    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: AI_MODELS.ADVANCED || AI_MODELS.STANDARD || "gpt-4o",
      temperature: 0.7,
      userId: user.id,
      forceJson: false, // Let the caller handle JSON parsing if needed
    });

    if (!response) {
      return NextResponse.json(
        { error: "Failed to generate response from AI" },
        { status: 500 }
      );
    }

    // Return the response
    return NextResponse.json({ 
      message: typeof response === "string" ? response : JSON.stringify(response),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to process AI request" },
      { status: 500 }
    );
  }
}
