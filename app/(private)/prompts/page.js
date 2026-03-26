"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Prompts module removed; prompts are managed per project in Visibility Tracking.
 * Redirect to the projects list.
 */
export default function PromptsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/geo-seo-visibility-tracking");
  }, [router]);
  return null;
}
