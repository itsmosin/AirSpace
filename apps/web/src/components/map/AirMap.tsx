"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MIDTOWN, squareAround, volumeHeights } from "@/lib/geo";
import { formatCompactUsd, formatNumber } from "@/lib/utils";
import type { FeatureCollection } from "geojson";
import type { MapParcel, MapView } from "./types";

const DEFAULT_VIEW: MapView = { lng: MIDTOWN.lng, lat: MIDTOWN.lat, zoom: 15.2, pitch: 60, bearing: -17 };

const COLORS: Record<MapParcel["state"], string> = {
  listed: "#22d3ee",
  verified: "#22d3ee",
  pending: "#8b5cf6",
  denied: "#fb7185",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function popupHtml(p: MapParcel) {
  const tone = COLORS[p.state];
  const label = p.state === "listed" ? "Listed" : p.state === "verified" ? "Verified" : p.state === "pending" ? "Pending verification" : "Denied";
  return `
    <div style="min-width:220px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:7px;height:7px;border-radius:999px;background:${tone};box-shadow:0 0 10px ${tone}"></span>
        <span style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${tone}">${label}</span>
      </div>
      <div style="font-weight:600;font-size:14px;letter-spacing:-.01em;line-height:1.2">${esc(p.address || "Unknown address")}</div>
      <div style="font-family:var(--font-mono);font-size:11px;color:#8b93a7;margin-top:2px">BBL ${esc(p.bbl)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <div><div style="font-size:10px;color:#8b93a7;letter-spacing:.1em;text-transform:uppercase">Unused</div><div style="font-weight:600">${formatNumber(p.unusedSqft)} <span style="font-size:11px;color:#8b93a7">sq ft</span></div></div>
        <div><div style="font-size:10px;color:#8b93a7;letter-spacing:.1em;text-transform:uppercase">${p.priceUsd ? "Price" : "Est. value"}</div><div style="font-weight:600;color:${p.priceUsd ? tone : "#e6e9f2"}">${formatCompactUsd(p.priceUsd ?? p.estValueUsd)}</div></div>
      </div>
      <a href="/parcel/${esc(p.bbl)}" style="display:inline-block;margin-top:10px;font-size:12px;color:#22d3ee;text-decoration:none">View parcel →</a>
    </div>`;
}

function toFeatureCollection(parcels: MapParcel[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcels
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== 0)
      .map((p) => {
        const { base, top } = volumeHeights(p.numFloors, p.unusedSqft, p.lotAreaSqft);
        return {
          type: "Feature",
          id: p.bbl,
          properties: { bbl: p.bbl, base, top, color: COLORS[p.state], state: p.state },
          geometry: { type: "Polygon", coordinates: [squareAround(p.lat, p.lng, 25)] },
        };
      }),
  };
}

export type AirMapProps = {
  token: string;
  parcels: MapParcel[];
  selected?: string | null;
  onSelect?: (bbl: string) => void;
  interactive?: boolean;
  view?: Partial<MapView>;
  className?: string;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  showPopups?: boolean;
};

export default function AirMap({ token, parcels, selected, onSelect, interactive = true, view, className, padding, showPopups = true }: AirMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const markersRef = useRef(new Map<string, { marker: mapboxgl.Marker; popup: mapboxgl.Popup }>());
  const parcelsRef = useRef(parcels);
  parcelsRef.current = parcels;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const v = { ...DEFAULT_VIEW, ...view };
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [v.lng, v.lat],
      zoom: v.zoom,
      pitch: v.pitch,
      bearing: v.bearing,
      antialias: true,
      interactive,
      attributionControl: false,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    if (interactive) map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    map.on("style.load", () => {
      map.setFog({ color: "#07090f", "high-color": "#0b1020", "horizon-blend": 0.08, "space-color": "#05070c", "star-intensity": 0.15 });
      const layers = map.getStyle()?.layers ?? [];
      const labelLayerId = layers.find((l) => l.type === "symbol" && (l.layout as { "text-field"?: unknown } | undefined)?.["text-field"])?.id;

      if (!map.getLayer("3d-buildings")) {
        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 13,
            paint: {
              "fill-extrusion-color": ["interpolate", ["linear"], ["zoom"], 13, "#10141f", 15, "#161c2b", 17, "#1d2538"],
              "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, ["get", "height"]],
              "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, ["get", "min_height"]],
              "fill-extrusion-opacity": 0.92,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          labelLayerId,
        );
      }

      if (!map.getSource("parcels")) {
        map.addSource("parcels", { type: "geojson", data: toFeatureCollection(parcelsRef.current) });
        map.addLayer({
          id: "parcel-volumes",
          type: "fill-extrusion",
          source: "parcels",
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["get", "top"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-opacity": 0.55,
            "fill-extrusion-vertical-gradient": false,
          },
        });
        map.addLayer({
          id: "parcel-footprints",
          type: "line",
          source: "parcels",
          paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": 0.9, "line-blur": 0.5 },
        });
        map.on("click", "parcel-volumes", (e) => {
          const bbl = e.features?.[0]?.properties?.bbl as string | undefined;
          if (bbl) onSelectRef.current?.(bbl);
        });
        map.on("mouseenter", "parcel-volumes", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "parcel-volumes", () => (map.getCanvas().style.cursor = ""));
      }
      loadedRef.current = true;
      syncMarkers(map, parcelsRef.current, showPopups);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function syncMarkers(map: mapboxgl.Map, list: MapParcel[], popups: boolean) {
    const seen = new Set<string>();
    for (const p of list) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || p.lat === 0) continue;
      seen.add(p.bbl);
      const existing = markersRef.current.get(p.bbl);
      if (existing) {
        existing.marker.setLngLat([p.lng, p.lat]);
        existing.popup.setHTML(popupHtml(p));
        (existing.marker.getElement().firstElementChild as HTMLElement | null)?.style.setProperty("--c", COLORS[p.state]);
        continue;
      }
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", p.address);
      el.innerHTML = `<span style="--c:${COLORS[p.state]};display:block;width:12px;height:12px;border-radius:999px;background:var(--c);box-shadow:0 0 0 4px color-mix(in oklab,var(--c) 25%,transparent),0 0 18px var(--c);transition:transform .2s"></span>`;
      el.style.cssText = "background:none;border:0;padding:6px;cursor:pointer";
      el.addEventListener("mouseenter", () => ((el.firstElementChild as HTMLElement).style.transform = "scale(1.35)"));
      el.addEventListener("mouseleave", () => ((el.firstElementChild as HTMLElement).style.transform = "scale(1)"));
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current?.(p.bbl);
      });
      const popup = new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: "300px" }).setHTML(popupHtml(p));
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]);
      if (popups) marker.setPopup(popup);
      marker.addTo(map);
      markersRef.current.set(p.bbl, { marker, popup });
    }
    for (const [bbl, m] of markersRef.current) {
      if (!seen.has(bbl)) {
        m.marker.remove();
        markersRef.current.delete(bbl);
      }
    }
  }

  // data updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("parcels") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(toFeatureCollection(parcels));
    syncMarkers(map, parcels, showPopups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels, showPopups]);

  // selection -> flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const p = parcels.find((x) => x.bbl === selected);
    if (!p || !Number.isFinite(p.lat) || p.lat === 0) return;
    const go = () => {
      map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16.4), pitch: 62, bearing: -17, duration: 1600, essential: true, padding: padding as mapboxgl.PaddingOptions | undefined });
      const m = markersRef.current.get(p.bbl);
      if (m && showPopups) {
        markersRef.current.forEach(({ popup }) => popup.isOpen() && popup.remove());
        setTimeout(() => m.marker.togglePopup(), 900);
      }
    };
    if (loadedRef.current) go();
    else map.once("style.load", go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
