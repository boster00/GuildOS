import ButtonAccount from "@/components/ButtonAccount";
import TutorialVideos from "../dashboard/components/TutorialVideos";

export const dynamic = "force-dynamic";

export default async function TutorialsPage() {
  return (
    <main className="min-h-screen pb-24">
      <div className="flex justify-end p-4 sm:p-6">
        <ButtonAccount />
      </div>
      <TutorialVideos />
    </main>
  );
}
