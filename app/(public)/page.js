import Hero from "@/components/Hero";
import DemoPages from "@/components/DemoPagesSection";
import ResultsProof from "@/components/ResultsProof";
import Problem from "@/components/Problem";
import Solution from "@/components/Solution";
// import RepurposeFeature from "@/components/RepurposeFeature";
import OurStory from "@/components/OurStory";

export default function Home() {
  return (
    <main>
      <Hero />
      <DemoPages />
      <ResultsProof />
      <Problem />
      <Solution />
      {/* <RepurposeFeature /> */}
      <OurStory />
    </main>
  );
}
