import Link from "next/link";
import { Hammer, Shield, FlaskConical, ShieldCheck } from "lucide-react";
import PlaceCard from "@/components/guildos/PlaceCard";

export const metadata = {
  title: "Town Square — GuildOS",
};

export default function TownSquarePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="guildos-title text-3xl font-bold text-amber-950">
            Town Square
          </h1>
          <p className="mt-1 text-sm text-base-content/65">
            Shops for tools, roles, credentials, and safeguards — the gear your
            guild runs on.
          </p>
        </div>
        <Link href="/town" className="btn btn-ghost btn-sm">
          ← Town Map
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlaceCard
          href="/town/town-square#smith"
          title="The Smith"
          subtitle="Tools & integrations"
          icon={<Hammer className="h-5 w-5" aria-hidden />}
        >
          Weapons are tools, APIs, and MCP integrations (
          <code>weapons</code>, <code>tool_integrations</code>,{" "}
          <code>tool_permissions</code>).
        </PlaceCard>
        <PlaceCard
          href="/town/town-square#armory"
          title="The Armory"
          subtitle="Hats / roles"
          icon={<Shield className="h-5 w-5" aria-hidden />}
        >
          Job types and capability bundles for adventurers (
          <code>hats</code>, <code>hat_capabilities</code>).
        </PlaceCard>
        <PlaceCard
          href="/town/town-square#apothecary"
          title="The Apothecary"
          subtitle="Temporary credentials"
          icon={<FlaskConical className="h-5 w-5" aria-hidden />}
        >
          Scoped, expiring tokens — never store raw secrets in browser (
          <code>potions</code>, <code>credential_tokens</code>).{" "}
          {/* TODO: vault / KMS integration */}
        </PlaceCard>
        <PlaceCard
          href="/town/town-square#shields"
          title="Shield Hall"
          subtitle="Safeguards & policy"
          icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
        >
          Rate limits, approvals, PII rules (
          <code>shields</code>, <code>safeguard_rules</code>).
        </PlaceCard>
      </div>
    </div>
  );
}
