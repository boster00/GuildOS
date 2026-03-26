import { ImageResponse } from "next/og";
import config from "@/config";

export const runtime = "edge";
export const alt = config.appName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #570df8 0%, #3b0ab0 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Globe decoration top-right */}
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "-60px",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.15)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.1)",
            display: "flex",
          }}
        />

        {/* App name */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-2px",
            lineHeight: 1,
            marginBottom: 24,
            display: "flex",
          }}
        >
          {config.appName}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.4,
            marginBottom: 48,
            maxWidth: 700,
            display: "flex",
          }}
        >
          {config.appDescription}
        </div>

        {/* Domain pill */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "rgba(255,255,255,0.6)",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 40,
            padding: "10px 28px",
            display: "flex",
          }}
        >
          {config.domainName}
        </div>
      </div>
    ),
    { ...size }
  );
}
