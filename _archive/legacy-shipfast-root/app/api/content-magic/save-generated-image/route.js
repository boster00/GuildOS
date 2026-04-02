import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imageUrl, prompt, title, alt } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Save image metadata to database
    const { data: imageData, error: dbError } = await supabase
      .from("images")
      .insert({
        user_id: user.id,
        src: imageUrl,
        title: title || "AI Generated Image",
        alt: alt || "AI Generated Image",
        prompt: prompt || null,
        source: "generated",
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      image: imageData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to save generated image" },
      { status: 500 }
    );
  }
}
