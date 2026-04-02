import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Privacy Policy | ${config.appName}`,
  canonicalUrlRelative: "/privacy-policy",
});

const baseUrl = `https://${config.domainName}`;
const contactEmail = config.resend?.supportEmail || "support@example.com";

const PrivacyPolicy = () => {
  return (
    <main className="max-w-2xl mx-auto">
      <div className="p-6 md:p-8">
        <Link href="/" className="btn btn-ghost btn-sm gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z" clipRule="evenodd" />
          </svg>
          Back
        </Link>
        <h1 className="text-3xl font-extrabold mt-4 mb-6">
          Privacy Policy
        </h1>
        <p className="text-sm text-base-content/70 mb-6">
          Last updated: {new Date().toISOString().split("T")[0]}
        </p>

        <div className="prose prose-sm max-w-none text-base-content/90 space-y-4">
          <p>
            Thank you for using {config.appName} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). This Privacy Policy describes how we collect, use, and protect your information when you use our website and services at {baseUrl} (the &quot;Service&quot;).
          </p>
          <p>
            By using the Service, you agree to this Privacy Policy. If you do not agree, please do not use the Service.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">1. Information we collect</h2>
          <h3 className="text-lg font-medium mt-4 mb-1">1.1 Account and identity</h3>
          <p>
            When you sign up or log in, we collect your name, email address, and profile information (e.g. avatar) from the authentication provider (e.g. Google, email magic link). We use this to create and manage your account and to communicate with you.
          </p>
          <h3 className="text-lg font-medium mt-4 mb-1">1.2 Content and usage data</h3>
          <p>
            We store the content you create in the Service, such as campaigns, outlines, articles, prompts, keywords, and settings. We use this to provide the product (e.g. saving your work, running research and AI-assisted writing) and to improve our services.
          </p>
          <h3 className="text-lg font-medium mt-4 mb-1">1.3 Payment information</h3>
          <p>
            If you subscribe to a paid plan, payment is processed by a third-party provider (e.g. Stripe). We do not store your full card details on our servers. We may store billing-related identifiers and subscription status to manage your plan.
          </p>
          <h3 className="text-lg font-medium mt-4 mb-1">1.4 Technical and usage data</h3>
          <p>
            We may collect technical data such as IP address, browser type, device information, and general usage (e.g. pages visited, features used). We may use cookies or similar technologies for authentication, preferences, and analytics. This helps us operate, secure, and improve the Service.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">2. How we use your information</h2>
          <p>
            We use the information we collect to: provide, operate, and improve the Service; authenticate you and manage your account; process payments; send service-related and product updates (including by email where you have not opted out); respond to support requests; and comply with legal obligations. We may use aggregated or anonymized data for analytics and product improvement.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">3. AI and third-party processing</h2>
          <p>
            To provide research, outlines, and content generation, we send relevant text (e.g. prompts, keywords, your content) to AI and data providers. These providers process data according to their own policies. We choose providers that commit to appropriate data handling and do not use your content to train their public models for marketing purposes, where we have contractual assurance to that effect.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">4. Data sharing and disclosure</h2>
          <p>
            We do not sell your personal information. We may share data with: service providers that help us run the Service (hosting, auth, email, payments, AI/data APIs); legal or regulatory authorities when required; or a successor entity in a merger or sale. We require providers to use data only for the purposes we specify and to protect it appropriately.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">5. Data retention and security</h2>
          <p>
            We retain your account and content data for as long as your account is active or as needed to provide the Service and comply with law. We implement reasonable technical and organizational measures to protect your data; no system is completely secure, and you use the Service at your own risk.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">6. Your rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, delete, or port your personal data, or to object to or restrict certain processing. To exercise these rights or ask questions, contact us at {contactEmail}. You can also delete your account and associated data from the Service where we provide that option.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">7. Children</h2>
          <p>
            The Service is not directed at children under 13 (or the applicable age in your jurisdiction). We do not knowingly collect personal information from children. If you believe we have collected such data, please contact us at {contactEmail}.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">8. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated policy on this page and may notify you of material changes by email or through the Service. Your continued use after changes constitutes acceptance of the updated policy.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">9. Contact</h2>
          <p>
            For privacy-related questions or requests, contact us at:{" "}
            <a href={`mailto:${contactEmail}`} className="link link-primary">{contactEmail}</a>.
          </p>
          <p className="mt-6">
            By using {config.appName}, you consent to the practices described in this Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
