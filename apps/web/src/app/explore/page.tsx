import type { Metadata } from "next";
import { ExploreView } from "@/components/parcel/ExploreView";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return <ExploreView />;
}
