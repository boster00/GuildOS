import site from "@/libs/council/site";

export const getSEOTags = ({
  title,
  description,
  keywords,
  openGraph,
  canonicalUrlRelative,
  extraTags,
} = {}) => {
  return {
    title: title || site.appName,
    description: description || site.appDescription,
    keywords: keywords || [site.appName],
    applicationName: site.appName,
    icons: {
      icon: "/icon.png",
      apple: "/apple-touch-icon.png",
    },
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        (process.env.NODE_ENV === "development"
          ? `http://localhost:${process.env.PORT || 3002}/`
          : `https://${site.domainName}/`)
    ),
    openGraph: {
      title: openGraph?.title || site.appName,
      description: openGraph?.description || site.appDescription,
      url: openGraph?.url || `https://${site.domainName}/`,
      siteName: openGraph?.title || site.appName,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      title: openGraph?.title || site.appName,
      description: openGraph?.description || site.appDescription,
      card: "summary_large_image",
    },
    ...(canonicalUrlRelative && {
      alternates: { canonical: canonicalUrlRelative },
    }),
    ...extraTags,
  };
};
