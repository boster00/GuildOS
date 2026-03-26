"use client";

import config from "@/config";

/**
 * CJGEO logo: single coin mark with “C” + app name.
 * Use size="md" for header, size="sm" for footer.
 */
export default function Logo({ size = "md" }) {
  const isSm = size === "sm";
  const coinSize = isSm ? "h-6 w-6 text-sm" : "h-8 w-8 text-lg";
  const textClass = isSm
    ? "font-extrabold tracking-tight text-base md:text-lg"
    : "font-extrabold text-lg";

  return (
    <>
      <span
        className={`${coinSize} shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/75 flex items-center justify-center font-extrabold text-primary-content shadow-sm ring-1 ring-primary/20`}
        aria-hidden
      >
        C
      </span>
      <span className={textClass}>{config.appName}</span>
    </>
  );
}
