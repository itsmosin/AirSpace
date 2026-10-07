import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { MapCard } from "@/components/landing/MapCard";
import { StatsStrip } from "@/components/landing/StatsStrip";

export default function Home() {
  return (
    <>
      <Hero />
      <MapCard />
      <StatsStrip />
      <HowItWorks />
    </>
  );
}
