import subscriptionTiers from "./libs/monkey/registry/subscriptionTiers.js";

const { TIERS } = subscriptionTiers;

function getStripePlanDescription(tierId) {
  const descriptions = {
    starter: "For solopreneurs and small teams getting started with SEO content.",
    pro: "For agencies and content operations at scale.",
  };
  return descriptions[tierId] || "";
}

function getStripePlanFeatures(tier) {
  const features = [];
  if (tier.monthlyCreditQuota) {
    features.push({ name: `${tier.monthlyCreditQuota} monthly credits` });
  }
  if (tier.paygPricePerCredit != null) {
    features.push({ name: `PAYG: $${tier.paygPricePerCredit}/credit` });
  }
  if (tier.concurrency != null && tier.concurrency > 0) {
    features.push({
      name: `${tier.concurrency} concurrent process${tier.concurrency > 1 ? "es" : ""}`,
    });
  }
  features.push({
    name: `${(tier.scheduledRuns || "monthly").replace("_", "/")} scheduled runs`,
  });
  return features;
}

const config = {
  // REQUIRED
  appName: "GuildOS",
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "Fantasy-themed control panel for agent workflows — quests, tools, and safeguards.",
  // REQUIRED (no https://, not trialing slash at the end, just the naked domain)
  domainName: "cjgeoai.com",
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: just remove this => Then add a support email in this config file (resend.supportEmail) otherwise customer support won't work.
    id: "",
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    // Free tier: no time limit, 50 free test credits (no card required; then user picks a plan)
    freeTrial: {
      freeCredits: 50,
    },
    // Plans derived from subscriptionTiers.js (DRY - single source of truth)
    plans: TIERS.filter((t) => t.stripePriceId).map((tier) => ({
      priceId: tier.stripePriceId,
      name: tier.name,
      description: getStripePlanDescription(tier.id),
      price: tier.monthlyPrice,
      features: getStripePlanFeatures(tier),
      ...(tier.id === "pro" ? { isFeatured: true } : {}),
    })),
  },
  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  resend: {
    // REQUIRED — Email 'From' field to be used when sending magic login links
    fromNoReply: `CJGEO <noreply@resend.cjgeo.com>`,
    // REQUIRED — Email 'From' field to be used when sending other emails, like abandoned carts, updates etc..
    fromAdmin: `CJGEO <admin@cjgeo.com>`,
    // Email shown to customer if need support. Leave empty if not needed => if empty, set up Crisp above, otherwise you won't be able to offer customer support."
    supportEmail: "marc.louvion@gmail.com",
  },
  colors: {
    // REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode).
    theme: "light",
    // REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..).
    // For DaisyUI v5, we use a standard primary color
    main: "#570df8",
  },
  auth: {
    // REQUIRED — the path to log in users. It's use to protect private routes (like /dashboard). It's used in apiClient (/libs/api.js) upon 401 errors from our API
    loginUrl: "/signin",
    // REQUIRED — the path you want to redirect users after successfull login (i.e. /dashboard, /private). This is normally a private page for users to manage their accounts. It's used in apiClient (/libs/api.js) upon 401 errors from our API & in ButtonSignin.js
    callbackUrl: "/opening",
  },
};

export default config;
