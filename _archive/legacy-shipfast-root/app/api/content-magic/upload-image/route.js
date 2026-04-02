import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import sharp from "sharp";

/** Max file size (1MB). Compress until under this limit. */
const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;

/** 5 compression attempts: quality + dimension scale (aspect ratio preserved). */
const ATTEMPTS = [
  { quality: 80, scale: 1.0 },
  { quality: 65, scale: 0.85 },
  { quality: 50, scale: 0.7 },
  { quality: 38, scale: 0.55 },
  { quality: 28, scale: 0.4 },
];

/**
 * Compress image to fit within MAX_IMAGE_SIZE_BYTES, preserving aspect ratio.
 * Up to 5 attempts; stops early if under limit; otherwise returns best result.
 * @param {Buffer} buffer - Raw image buffer
 * @param {string} mimeType - e.g. image/jpeg, image/png
 * @returns {Promise<{ buffer: Buffer; mimeType: string; ext: string }>}
 */
async function compressImageIfNeeded(buffer, mimeType) {
  if (buffer.length <= MAX_IMAGE_SIZE_BYTES) {
    const ext = mimeType === "image/png" ? "png" : "jpg";
    return { buffer, mimeType, ext };
  }

  const meta = await sharp(buffer).metadata();
  const origW = meta.width || 1920;
  const origH = meta.height || 1080;

  let best = null;
  for (const { quality, scale } of ATTEMPTS) {
    const w = Math.max(160, Math.round(origW * scale));
    const h = Math.max(120, Math.round(origH * scale));
    const result = await sharp(buffer)
      .resize(w, h, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (!best || result.length < best.length) best = result;
    if (result.length <= MAX_IMAGE_SIZE_BYTES) break;
  }

  if (best.length > MAX_IMAGE_SIZE_BYTES) {
  }

  return { buffer: best, mimeType: "image/jpeg", ext: "jpg" };
}

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const uploadedImages = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        continue;
      }

      // Read file and compress if over limit (keeps aspect ratio)
      let buffer;
      let mimeType;
      let ext;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const rawBuffer = Buffer.from(arrayBuffer);
        const compressed = await compressImageIfNeeded(rawBuffer, file.type);
        buffer = compressed.buffer;
        mimeType = compressed.mimeType;
        ext = compressed.ext;
      } catch (err) {
        continue; // Skip this file, try next
      }

      // Generate unique filename (use compressed ext)
      const fileName = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${ext}`;

      // Upload compressed buffer to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        // Check if bucket doesn't exist
        if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
          return NextResponse.json(
            { error: "Storage bucket 'images' not found. Please create it in Supabase dashboard." },
            { status: 500 }
          );
        }
        continue;
      }

      // Save image metadata to database (uses compressed size/type)
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const { data: imageData, error: dbError } = await supabase
        .from("images")
        .insert({
          user_id: user.id,
          src: null, // Signed URLs will be generated on-demand from storage_path
          storage_path: fileName,
          file_name: `${baseName}.${ext}`,
          file_size: buffer.length,
          mime_type: mimeType,
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          alt: file.name.replace(/\.[^/.]+$/, ""),
          source: "upload",
        })
        .select()
        .single();

      if (dbError) {
        // Try to delete uploaded file if database insert fails
        await supabase.storage.from("images").remove([fileName]);
        continue;
      }

      uploadedImages.push(imageData);
    }

    if (uploadedImages.length === 0) {
      return NextResponse.json(
        { error: "Failed to upload any images" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      images: uploadedImages,
      message: `Successfully uploaded ${uploadedImages.length} image(s)`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to upload images" },
      { status: 500 }
    );
  }
}
