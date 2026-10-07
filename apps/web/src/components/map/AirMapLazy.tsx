"use client";

import dynamic from "next/dynamic";
import { PUBLIC_ENV } from "@/lib/env";
import { MapPlaceholder } from "./MapPlaceholder";
import type { AirMapProps } from "./AirMap";

const AirMap = dynamic(() => import("./AirMap"), {
  ssr: false,
  loading: () => (
    <div className="relative h-full w-full overflow-hidden bg-fill-2">
      <div className="skeleton absolute inset-0 rounded-none opacity-70" />
      <div className="dot-field absolute inset-0 opacity-50" />
    </div>
  ),
});

export function AirMapLazy(props: Omit<AirMapProps, "token"> & { placeholderCompact?: boolean }) {
  const token = PUBLIC_ENV.mapboxToken;
  if (!token) return <MapPlaceholder compact={props.placeholderCompact} className={props.className} reason="token" />;
  return <AirMap token={token} {...props} />;
}
