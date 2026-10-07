import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ParcelDetail } from "@/components/parcel/ParcelDetail";

type Props = { params: Promise<{ bbl: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bbl } = await params;
  return { title: `Parcel ${bbl}` };
}

export default async function ParcelPage({ params }: Props) {
  const { bbl } = await params;
  if (!/^\d{10}$/.test(bbl)) notFound();
  return <ParcelDetail bbl={bbl} />;
}
