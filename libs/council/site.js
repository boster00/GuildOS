/** App-wide constants (branding, theme, fallbacks). Prefer env for URLs in production. */
const site = {
  appName: "GuildOS",
  appDescription:
    "Fantasy-themed control panel for agent workflows — quests, tools, and safeguards.",
  domainName: "cjgeoai.com",
  crisp: {
    id: "",
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    freeTrial: {
      freeCredits: 50,
    },
    plans: [],
  },
  aws: {
    bucket: "bucket-name",
    bucketUrl: "https://bucket-name.s3.amazonaws.com/",
    cdn: "https://cdn-id.cloudfront.net/",
  },
  resend: {
    fromNoReply: "GuildOS <noreply@example.com>",
    fromAdmin: "GuildOS <admin@example.com>",
    supportEmail: "",
  },
  colors: {
    theme: "light",
    main: "#570df8",
  },
  auth: {
    loginUrl: "/signin",
    callbackUrl: "/opening",
  },
};

export default site;
