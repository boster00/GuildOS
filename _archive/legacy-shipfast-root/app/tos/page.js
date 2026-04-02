import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Terms of Service | ${config.appName}`,
  canonicalUrlRelative: "/tos",
});

const baseUrl = `https://${config.domainName}`;
const contactEmail = config.resend?.supportEmail || "support@example.com";
const privacyUrl = `${baseUrl}/privacy-policy`;
const dataHandlingUrl = `${baseUrl}/data-handling`;

const TOS = () => {
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
          Terms of Service
        </h1>
        <p className="text-sm text-base-content/70 mb-6">
          Last updated: {new Date().toISOString().split("T")[0]}
        </p>

        <div className="prose prose-sm max-w-none text-base-content/90 space-y-4">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of the {config.appName} website and services at {baseUrl} (the &quot;Service&quot;). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">1. Description of the Service</h2>
          <p>
            {config.appName} is an SEO content and research platform that helps you decide what pages to build or improve, conduct keyword and competitor research, create outlines, and write SEO-optimized content with AI assistance. Features may change over time. We do not guarantee specific outcomes (e.g. rankings or traffic).
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">2. Account and eligibility</h2>
          <p>
            You must provide accurate information when signing up and keep your account secure. You must be at least 13 years old (or the age of consent in your jurisdiction) and able to form a binding contract. You are responsible for all activity under your account.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">3. Acceptable use</h2>
          <p>
            You agree not to use the Service to violate any law, infringe others&apos; rights, distribute malware, spam, or harmful content, or attempt to gain unauthorized access to our or others&apos; systems or data. We may suspend or terminate your access if we believe you have violated these Terms or our policies.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">4. Your content and our use of it</h2>
          <p>
            You keep ownership of the content you create and upload. You grant us a license to use, store, and process that content as necessary to provide and improve the Service (e.g. running research and AI tools). You represent that you have the rights to any content you provide and that it does not violate these Terms or any third-party rights.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">5. Subscriptions, fees, and refunds</h2>
          <p>
            Paid plans are billed according to the pricing shown at sign-up or on our website. Fees are non-refundable except where required by law or as stated in our refund policy (e.g. a stated trial or money-back period). We may change pricing with notice; continued use after a change constitutes acceptance. You may cancel your subscription in accordance with our billing process.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">6. Data and privacy</h2>
          <p>
            Our collection and use of your data is described in our{" "}
            <a href={privacyUrl} className="link link-primary">Privacy Policy</a> and in our{" "}
            <a href={dataHandlingUrl} className="link link-primary">Data handling note</a>. By using the Service, you agree to those documents.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">7. Disclaimers</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available.&quot; We disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. We do not guarantee uninterrupted, error-free, or secure operation or any particular business or SEO results.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we (and our affiliates, officers, and employees) are not liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill, arising from your use of the Service or these Terms. Our total liability for any claims related to the Service or these Terms is limited to the amount you paid us in the twelve (12) months before the claim (or one hundred dollars if greater).
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">9. Changes to the Terms</h2>
          <p>
            We may update these Terms from time to time. We will post the updated Terms on this page and may notify you of material changes by email or through the Service. Your continued use after the effective date of changes constitutes acceptance. If you do not agree, you must stop using the Service.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">10. General</h2>
          <p>
            These Terms, together with our Privacy Policy and Data handling note, constitute the entire agreement between you and us regarding the Service. If any part of these Terms is held invalid, the rest remains in effect. Our failure to enforce a right does not waive it. You may not assign these Terms without our consent; we may assign them in connection with a merger or sale of the business.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">11. Contact</h2>
          <p>
            For questions about these Terms, contact us at:{" "}
            <a href={`mailto:${contactEmail}`} className="link link-primary">{contactEmail}</a>.
          </p>
        </div>
      </div>
    </main>
  );
};

export default TOS;
