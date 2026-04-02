import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { parseSupabaseStoragePath } from "@/libs/content-magic/utils/parseSupabaseStoragePath";

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storagePaths = [], legacySrcUrls = [] } = await request.json();

    if (!Array.isArray(storagePaths) || !Array.isArray(legacySrcUrls)) {
      return NextResponse.json(
        { error: "storagePaths and legacySrcUrls must be arrays" },
        { status: 400 }
      );
    }

    // Build list of storage paths: direct paths + paths derived from legacy src URLs
    const pathsToFetch = [...storagePaths];
    const srcToPath = {}; // legacy src -> extracted path (for mapping results back)

    for (const src of legacySrcUrls) {
      const path = parseSupabaseStoragePath(src);
      if (path) {
        pathsToFetch.push(path);
        srcToPath[src] = path;
      }
    }

    if (pathsToFetch.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    // Generate signed URLs for all paths (expires in 1 hour)
    const { data: signedUrls, error } = await supabase.storage
      .from("images")
      .createSignedUrls(pathsToFetch, 3600); // 1 hour expiration

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create signed URLs" },
        { status: 500 }
      );
    }

    // Return a map of storage_path or legacy src -> signedUrl
    const urlMap = {};
    signedUrls.forEach((item, index) => {
      const path = pathsToFetch[index];
      if (item.signedUrl && path) {
        urlMap[path] = item.signedUrl;
      }
    });

    // Also key by legacy src for images that use src as lookup key
    Object.keys(srcToPath).forEach((src) => {
      const path = srcToPath[src];
      if (urlMap[path]) {
        urlMap[src] = urlMap[path];
      }
    });

    return NextResponse.json({
      urls: urlMap,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to generate signed URLs" },
      { status: 500 }
    );
  }
}
