import site from "@/libs/council/site";

export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:${process.env.PORT || 3002}`;
  }
  return `https://${site.domainName}`;
}
