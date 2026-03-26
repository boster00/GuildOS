import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Image ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: image, error: fetchError } = await supabase
      .from("images")
      .select("id, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json(
        { error: "Image not found or access denied" },
        { status: 404 }
      );
    }

    if (image.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("images")
        .remove([image.storage_path]);
      if (storageError) {
        // Continue with DB delete; storage may have been already removed or path invalid
      }
    }

    const { error: deleteError } = await supabase
      .from("images")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error(`Database error: ${deleteError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete image" },
      { status: 500 }
    );
  }
}
