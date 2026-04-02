import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Data Handling | ${config.appName}`,
  canonicalUrlRelative: "/data-handling",
});

const contactEmail = config.resend?.supportEmail || "support@example.com";
const privacyUrl = `/privacy-policy`;

const DataHandling = () => {
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
          Data Handling
        </h1>
        <p className="text-sm text-base-content/70 mb-6">
          A short note on how we handle your data in {config.appName}.
        </p>

        <div className="prose prose-sm max-w-none text-base-content/90 space-y-4">
          <p>
            This page summarizes how we handle your data when you use {config.appName}. For full details, see our{" "}
            <Link href={privacyUrl} className="link link-primary">Privacy Policy</Link>.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">What we store</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> email, name, and profile info from your sign-in provider.</li>
            <li><strong>Your content:</strong> campaigns, outlines, articles, keywords, prompts, and settings you create in the product.</li>
            <li><strong>Usage and billing:</strong> subscription status, usage metrics, and billing-related identifiers (payment details are held by our payment provider, not by us).</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-2">How we use it</h2>
          <p>
            We use your data to run the Service: to save your work, run keyword and competitor research, generate outlines and content with AI, send you product and account-related emails, and improve the product. We do not sell your personal information or your content to third parties.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">AI and external services</h2>
          <p>
            To provide research and content generation, we send relevant text (e.g. your prompts, keywords, and content) to AI and data providers. Those providers process data under their own policies and our agreements. We select providers that do not use your content to train their public models for marketing, where we have such commitments. For more on AI and third-party processing, see our Privacy Policy.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">Security and retention</h2>
          <p>
            We use industry-standard measures to protect your data (e.g. encryption, access controls). We retain your data while your account is active and as needed for the Service and legal obligations. You can request deletion of your account and associated data; see our Privacy Policy for how to exercise your rights.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">Your rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, delete, or port your data, or to object to certain processing. To exercise these or ask questions, contact us at{" "}
            <a href={`mailto:${contactEmail}`} className="link link-primary">{contactEmail}</a>.
          </p>

          <p className="mt-6 text-base-content/80">
            Last updated: {new Date().toISOString().split("T")[0]}
          </p>
        </div>
      </div>
    </main>
  );
};

export default DataHandling;
