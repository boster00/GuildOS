import { redirect } from "next/navigation";

/** Formulary lives in Council Hall; old Guildmaster URL forwards there. */
export default function GuildmasterFormularyRedirectPage() {
  redirect("/town/council-hall/formulary");
}
