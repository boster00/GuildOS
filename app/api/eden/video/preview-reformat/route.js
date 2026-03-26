import { NextResponse } from "next/server";
import { resizeToI2VFormat, I2V_IMAGE_SIZE } from "@/libs/ai/eden/videoGateway";

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Content-Type must be multipart/form-data" } },
      { status: 400 }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid form data" } },
      { status: 400 }
    );
  }

  const file = formData.get("image");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Image file required" } },
      { status: 400 }
    );
  }

  try {
    const buf = await file.arrayBuffer();
    const buffer = Buffer.from(buf);
    const resized = await resizeToI2VFormat(buffer);
    const imageBase64 = resized.toString("base64");
    const dimensions = `${I2V_IMAGE_SIZE.width}x${I2V_IMAGE_SIZE.height}`;

    return NextResponse.json({
      ok: true,
      data: { imageBase64, dimensions },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RESIZE_ERROR",
          message: err.message || "Failed to resize image",
        },
      },
      { status: 500 }
    );
  }
}
