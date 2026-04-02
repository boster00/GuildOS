import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "5");
    const search = searchParams.get("search") || "";

    // Build query
    let query = supabase
      .from("images")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Apply search filter if provided (search across all text columns)
    if (search.trim()) {
      query = query.or(
        `title.ilike.%${search}%,alt.ilike.%${search}%,src.ilike.%${search}%,file_name.ilike.%${search}%,storage_path.ilike.%${search}%,prompt.ilike.%${search}%`
      );
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: images, error, count } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      images: images || [],
      currentPage: page,
      totalPages,
      totalCount: count || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch images" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imageId, title, alt } = await request.json();

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    // Update image metadata
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (alt !== undefined) updateData.alt = alt;

    const { data: imageData, error: updateError } = await supabase
      .from("images")
      .update(updateData)
      .eq("id", imageId)
      .eq("user_id", user.id) // Ensure user owns the image
      .select()
      .single();

    if (updateError) {
      throw new Error(`Database error: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      image: imageData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update image" },
      { status: 500 }
    );
  }
}
