import TownNavBar from "@/components/TownNavBar";

export default function TownLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TownNavBar />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
