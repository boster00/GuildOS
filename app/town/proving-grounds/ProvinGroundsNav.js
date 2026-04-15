import Link from "next/link";

const TABS = [
  { key: "cloud-agents", label: "Cloud Agents", href: "/town/proving-grounds" },
  { key: "browserclaw", label: "Browserclaw", href: "/town/proving-grounds/browserclaw" },
  { key: "browserclaw-test", label: "Pigeon Test", href: "/town/proving-grounds/browserclaw-test" },
  { key: "bigquery", label: "BigQuery", href: "/town/proving-grounds/weapons/bigquery" },
  { key: "asana", label: "Asana Review", href: "/town/proving-grounds/asana" },
];

export default function ProvinGroundsNav({ active }) {
  return (
    <div className="mt-6 border-b border-base-300 overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-base-content/55 hover:text-base-content hover:border-base-300",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
