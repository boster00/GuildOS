import Link from "next/link";

const TEST_PAGES = [
  { href: "/tests/agent-kit", label: "Agent Kit Test" },
  { href: "/tests/chatid-capture", label: "Test chatId Capture" },
  { href: "/tests/cron", label: "Cron Test" },
  { href: "/tests/dataforseo", label: "Test DataForSEO" },
  { href: "/tests/eden", label: "Eden Test" },
  { href: "/tests/full-auto", label: "Full Auto Content Magic" },
  { href: "/tests/master-of-coins", label: "Test Master of Coins" },
  { href: "/tests/metering", label: "Test Metering" },
  { href: "/tests/metering-rollout", label: "Metering Rollout" },
  { href: "/tests/production", label: "Test Production" },
  { href: "/tests/draft-css-shadow", label: "Test Draft CSS Shadow DOM" },
  { href: "/tests/shadow-dom-styling", label: "Test Shadow DOM Styling" },
  { href: "/tests/stripe", label: "Test Stripe" },
  { href: "/tests/test-decide-status", label: "Test Decide Rendering Status" },
  { href: "/tests/visibility-tracker", label: "Test Visibility Tracker" },
  { href: "/tests/visibility-tracking", label: "Test Visibility Tracking" },
];

export default function TestsIndexPage() {
  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h1 className="card-title text-2xl">Test Pages</h1>
            <p className="text-base-content/70">
              Dev-only test and debugging pages. Only visible in development to admin emails.
            </p>
          </div>
        </div>
        <ul className="menu bg-base-100 rounded-box shadow overflow-hidden">
          {TEST_PAGES.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-2">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
