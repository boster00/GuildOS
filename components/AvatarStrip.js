"use client";

const FRAME_BY_STATUS = {
  pending: 0,
  done: 1,
  blocked: 2,
  in_progress: 3,
};

export default function AvatarStrip({ src, status = "pending", size = 56, alt = "avatar" }) {
  const frame = FRAME_BY_STATUS[status] ?? 0;
  const position = `${(frame / 3) * 100}% 0%`;

  return (
    <div
      role="img"
      aria-label={alt}
      className="rounded-xl border border-base-300 bg-base-100 shadow-sm"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${src})`,
        backgroundSize: "400% auto",
        backgroundPosition: position,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
