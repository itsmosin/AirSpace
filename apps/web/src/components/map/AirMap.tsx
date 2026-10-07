"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Info, Pause, Play } from "lucide-react";
import { haversineMeters, MIDTOWN, squareAround } from "@/lib/geo";
import { cn, formatNumber } from "@/lib/utils";
import { MapPlaceholder } from "./MapPlaceholder";
import type { FeatureCollection } from "geojson";
import type { MapParcel, MapView } from "./types";

const STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
const DEFAULT_VIEW: MapView = { lng: MIDTOWN.lng, lat: MIDTOWN.lat, zoom: 15.5, pitch: 60, bearing: 20 };
const FLOOR_M = 3.2;
const EXPOSURE_M = 250;
const TOUR_MS = 5000;

/* Map-only paint constants. WebGL paint properties cannot read CSS custom properties and the
   satellite map keeps the same look in both UI themes; the status colors mirror the design tokens. */
const PAINT = {
  building: "#1f2024",
  context: "#e3e4e9",
  contextLow: "#c3c4cc",
  selected: "#0a84ff",
  green: "#30d158",
  orange: "#ff9f0a",
  red: "#ff453a",
  white: "#ffffff",
  ink: "#0b1a10",
  muted: "rgba(255,255,255,0.58)",
};

const LAYERS = ["parcel-built", "parcel-air", "parcel-air-hi"];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hasCoords = (p: MapParcel) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== 0;

/** Footprint and stacked heights for a parcel. Heights are slightly exaggerated so the blocks read at zoom 15. */
export function parcelMetrics(p: MapParcel) {
  const lotM2 = p.lotAreaSqft * 0.0929;
  const side = clamp(Math.sqrt(lotM2 || 0) * 1.25, 36, 72);
  const builtFloors = Math.max(1, Math.round(p.numFloors || 4));
  const builtReal = builtFloors * FLOOR_M;
  const built = clamp(builtReal * 1.3, 30, 170);
  const unusedFar = p.lotAreaSqft > 0 ? p.unusedSqft / p.lotAreaSqft : 0;
  const extraFloors = Math.max(0, Math.round(unusedFar));
  const cap = clamp(unusedFar * FLOOR_M * 1.3, 18, 140);
  return { side, built, top: built + cap, builtFloors, builtReal, extraFloors, unusedFar };
}

function statusColor(state: MapParcel["state"]) {
  return state === "denied" ? PAINT.red : state === "pending" ? PAINT.orange : PAINT.green;
}
function statusLabel(state: MapParcel["state"]) {
  return state === "listed" ? "Listed" : state === "verified" ? "Verified" : state === "pending" ? "Pending" : "Denied";
}

type Exposure = { exposed: boolean; nearest?: MapParcel; floors?: number };

/** A parcel's view is Exposed when another parcel with tradable rights sits within 250 m. */
function computeExposure(list: MapParcel[]) {
  const tradable = list.filter((p) => (p.state === "verified" || p.state === "listed") && p.unusedSqft > 0 && hasCoords(p));
  const out = new Map<string, Exposure>();
  for (const p of list) {
    if (!hasCoords(p)) continue;
    let best: MapParcel | undefined;
    let bestD = Infinity;
    for (const q of tradable) {
      if (q.bbl === p.bbl) continue;
      const d = haversineMeters(p.lat, p.lng, q.lat, q.lng);
      if (d <= EXPOSURE_M && d < bestD) {
        best = q;
        bestD = d;
      }
    }
    out.set(p.bbl, best ? { exposed: true, nearest: best, floors: parcelMetrics(best).extraFloors } : { exposed: false });
  }
  return out;
}

function cardHtml(p: MapParcel, ex: Exposure | undefined, viewer: string | null) {
  const m = parcelMetrics(p);
  const perSqft = p.unusedSqft > 0 ? (p.priceUsd ?? p.estValueUsd) / p.unusedSqft : 0;
  const isOwner = !!viewer && viewer === p.owner;
  const cta = p.state === "listed" && !isOwner ? "Buy air rights" : isOwner && p.state !== "listed" ? "List air rights" : "View parcel";
  const exposed = !!ex?.exposed;
  return `
    <div style="font-family:var(--font-sans);color:${PAINT.white}">
      <div style="font-size:17px;font-weight:600;letter-spacing:-.01em;line-height:1.25">${esc(p.address || `BBL ${p.bbl}`)}</div>
      <div style="margin-top:8px;font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1;color:${PAINT.green}">${perSqft > 0 ? `$${formatNumber(Math.round(perSqft))}` : "—"}<span style="margin-left:4px;font-size:13px;font-weight:500;color:${PAINT.muted}">/sq ft${p.priceUsd ? " ask" : ""}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;font-size:13px;line-height:1.35">
        <div><div style="color:${PAINT.muted}">Height</div><div style="font-weight:500">${m.builtFloors} floors · ${Math.round(m.builtReal)} m</div></div>
        <div><div style="color:${PAINT.muted}">Available</div><div style="font-weight:500">${formatNumber(p.unusedSqft)} sq ft</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:10px;font-size:13px">
        <div><span style="color:${PAINT.muted}">Status:</span> <span style="font-weight:500;color:${statusColor(p.state)}">${statusLabel(p.state)}</span></div>
        <div><span style="color:${PAINT.muted}">View:</span> <span style="font-weight:500;color:${exposed ? PAINT.orange : PAINT.green}">${exposed ? "Exposed" : "Protected"}</span></div>
        ${exposed && ex?.nearest ? `<div style="font-size:12px;color:${PAINT.muted}">${esc(ex.nearest.address)} could add +${ex.floors ?? 0} floors nearby</div>` : ""}
      </div>
      <a data-nav href="/parcel/${esc(p.bbl)}" style="display:flex;align-items:center;justify-content:center;margin-top:14px;height:40px;border-radius:999px;background:${PAINT.green};color:${PAINT.ink};font-size:14px;font-weight:600;text-decoration:none">${cta}</a>
    </div>`;
}

function toFeatureCollection(parcels: MapParcel[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcels.filter(hasCoords).map((p) => {
      const m = parcelMetrics(p);
      return {
        type: "Feature",
        id: Number(p.bbl),
        properties: { bbl: p.bbl, built: m.built, top: m.top, color: statusColor(p.state), state: p.state },
        geometry: { type: "Polygon", coordinates: [squareAround(p.lat, p.lng, m.side)] },
      };
    }),
  };
}

export type AirMapProps = {
  token: string;
  parcels: MapParcel[];
  selected?: string | null;
  onSelect?: (bbl: string) => void;
  /** Full interaction (default). `mini` keeps orbit-drag only, for the parcel page. */
  interactive?: boolean;
  mini?: boolean;
  view?: Partial<MapView>;
  className?: string;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Show the hover/click parcel card. */
  showPopups?: boolean;
  /** Overlay legend, hint and tour controls. */
  overlays?: boolean;
};

export default function AirMap({ token, parcels, selected, onSelect, interactive = true, mini = false, view, className, padding, showPopups = true, overlays = true }: AirMapProps) {
  const router = useRouter();
  const { publicKey } = useWallet();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const markersRef = useRef(new Map<string, mapboxgl.Marker>());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const pinnedRef = useRef<string | null>(null);
  const parcelsRef = useRef(parcels);
  parcelsRef.current = parcels;
  const exposure = useMemo(() => computeExposure(parcels), [parcels]);
  const exposureRef = useRef(exposure);
  exposureRef.current = exposure;
  const viewerRef = useRef<string | null>(null);
  viewerRef.current = publicKey?.toBase58() ?? null;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const showPopupsRef = useRef(showPopups);
  showPopupsRef.current = showPopups;
  const routerRef = useRef(router);
  routerRef.current = router;

  const [glError, setGlError] = useState<string | null>(null);
  const [airVisible, setAirVisible] = useState(true);
  const [touring, setTouring] = useState(false);
  const touringRef = useRef(false);
  touringRef.current = touring;

  const find = (bbl: string | null) => (bbl ? parcelsRef.current.find((p) => p.bbl === bbl) ?? null : null);

  function applyHighlight(map: mapboxgl.Map) {
    if (!map.getLayer("parcel-air")) return;
    const ids = [hoveredRef.current, pinnedRef.current].filter((x): x is string => !!x);
    const hi: mapboxgl.FilterSpecification = ids.length ? ["in", ["get", "bbl"], ["literal", ids]] : ["==", ["get", "bbl"], ""];
    const lo: mapboxgl.FilterSpecification = ids.length ? ["!", ["in", ["get", "bbl"], ["literal", ids]]] : ["!=", ["get", "bbl"], ""];
    map.setFilter("parcel-air-hi", hi);
    map.setFilter("parcel-air", lo);
  }

  function showCard(map: mapboxgl.Map, bbl: string) {
    if (!showPopupsRef.current) return;
    const p = find(bbl);
    if (!p || !hasCoords(p)) return;
    const m = parcelMetrics(p);
    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, closeOnMove: false, offset: 16, maxWidth: "320px", className: "air-popup" });
    }
    popupRef.current.setLngLat([p.lng, p.lat]).setAltitude(m.top).setHTML(cardHtml(p, exposureRef.current.get(bbl), viewerRef.current));
    if (!popupRef.current.isOpen()) popupRef.current.addTo(map);
  }

  function refreshCard(map: mapboxgl.Map) {
    const bbl = hoveredRef.current ?? pinnedRef.current;
    if (bbl) showCard(map, bbl);
    else popupRef.current?.remove();
  }

  function setHovered(map: mapboxgl.Map, bbl: string | null) {
    if (hoveredRef.current === bbl) return;
    hoveredRef.current = bbl;
    map.getCanvas().style.cursor = bbl ? "pointer" : mini ? "grab" : "";
    applyHighlight(map);
    refreshCard(map);
  }

  function select(map: mapboxgl.Map, bbl: string | null, fly: boolean) {
    const prev = pinnedRef.current;
    if (prev && map.getSource("parcels")) map.setFeatureState({ source: "parcels", id: Number(prev) }, { selected: false });
    pinnedRef.current = bbl;
    if (bbl && map.getSource("parcels")) map.setFeatureState({ source: "parcels", id: Number(bbl) }, { selected: true });
    applyHighlight(map);
    refreshCard(map);
    const p = find(bbl);
    if (fly && p && hasCoords(p)) {
      map.flyTo({ center: [p.lng, p.lat], zoom: 17, pitch: 65, bearing: map.getBearing() + 30, duration: 1600, essential: true, padding: padding as mapboxgl.PaddingOptions | undefined });
    }
  }

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const v = { ...DEFAULT_VIEW, ...view };
    if (!mapboxgl.supported?.()) {
      setGlError("This browser cannot render WebGL maps.");
      return;
    }
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLE,
        center: [v.lng, v.lat],
        zoom: v.zoom,
        pitch: v.pitch,
        bearing: v.bearing,
        antialias: true,
        interactive: interactive && !mini,
        attributionControl: false,
        cooperativeGestures: false,
        maxPitch: 75,
        logoPosition: "bottom-right",
      });
    } catch (e) {
      setGlError(e instanceof Error ? e.message : "Failed to initialize WebGL");
      return;
    }
    mapRef.current = map;
    if (interactive && !mini) map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    map.on("style.load", () => {
      const layers = map.getStyle()?.layers ?? [];
      const labelLayerId = layers.find((l) => l.type === "symbol" && (l.layout as { "text-field"?: unknown } | undefined)?.["text-field"])?.id;

      if (!map.getLayer("context-buildings")) {
        map.addLayer(
          {
            id: "context-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 13,
            paint: {
              "fill-extrusion-color": ["interpolate", ["linear"], ["get", "height"], 0, PAINT.context, 120, PAINT.contextLow],
              "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, ["get", "height"]],
              "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, ["get", "min_height"]],
              "fill-extrusion-opacity": 0.72,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          labelLayerId,
        );
      }

      if (!map.getSource("parcels")) {
        map.addSource("parcels", { type: "geojson", data: toFeatureCollection(parcelsRef.current) });
        map.addLayer({
          id: "parcel-built",
          type: "fill-extrusion",
          source: "parcels",
          paint: {
            "fill-extrusion-color": PAINT.building,
            "fill-extrusion-height": ["get", "built"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.85,
            "fill-extrusion-vertical-gradient": true,
          },
        });
        const airColor: mapboxgl.ExpressionSpecification = ["case", ["boolean", ["feature-state", "selected"], false], PAINT.selected, ["get", "color"]];
        map.addLayer({
          id: "parcel-air",
          type: "fill-extrusion",
          source: "parcels",
          paint: { "fill-extrusion-color": airColor, "fill-extrusion-height": ["get", "top"], "fill-extrusion-base": ["get", "built"], "fill-extrusion-opacity": 0.55, "fill-extrusion-vertical-gradient": false },
        });
        map.addLayer({
          id: "parcel-air-hi",
          type: "fill-extrusion",
          source: "parcels",
          filter: ["==", ["get", "bbl"], ""],
          paint: { "fill-extrusion-color": airColor, "fill-extrusion-height": ["get", "top"], "fill-extrusion-base": ["get", "built"], "fill-extrusion-opacity": 0.8, "fill-extrusion-vertical-gradient": false },
        });

        map.on("mousemove", LAYERS, (e) => {
          const bbl = e.features?.[0]?.properties?.bbl as string | undefined;
          if (bbl) setHovered(map, bbl);
        });
        map.on("mouseleave", LAYERS, () => setHovered(map, null));
        map.on("click", (e) => {
          const hit = map.queryRenderedFeatures(e.point, { layers: LAYERS.filter((l) => map.getLayer(l)) });
          const bbl = hit[0]?.properties?.bbl as string | undefined;
          if (touringRef.current) setTouring(false);
          if (bbl) {
            select(map, bbl, true);
            onSelectRef.current?.(bbl);
          } else {
            select(map, null, false);
          }
        });
        map.on("mousedown", () => touringRef.current && setTouring(false));
        map.on("wheel", () => touringRef.current && setTouring(false));
        map.on("touchstart", () => touringRef.current && setTouring(false));
      }
      loadedRef.current = true;
      syncMarkers(map, parcelsRef.current);
      applyHighlight(map);
      if (mini) map.getCanvas().style.cursor = "grab";
    });

    // In-card "View parcel" links navigate client-side.
    const container = containerRef.current;
    const onNav = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[data-nav]") as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      routerRef.current.push(a.getAttribute("href") ?? "/explore");
    };
    container.addEventListener("click", onNav);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      container.removeEventListener("click", onNav);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mini, interactive]);

  // Mini mode: left-drag orbits the camera around the parcel.
  useEffect(() => {
    const el = containerRef.current;
    if (!mini || !el) return;
    let drag: { x: number; y: number; bearing: number; pitch: number } | null = null;
    const down = (e: PointerEvent) => {
      const map = mapRef.current;
      if (!map || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, bearing: map.getBearing(), pitch: map.getPitch() };
      map.getCanvas().style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const map = mapRef.current;
      if (!map || !drag) return;
      map.jumpTo({ bearing: drag.bearing + (e.clientX - drag.x) * 0.4, pitch: clamp(drag.pitch - (e.clientY - drag.y) * 0.25, 20, 75) });
    };
    const up = (e: PointerEvent) => {
      drag = null;
      mapRef.current?.getCanvas().style.setProperty("cursor", "grab");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be released
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [mini]);

  function syncMarkers(map: mapboxgl.Map, list: MapParcel[]) {
    const seen = new Set<string>();
    for (const p of list) {
      if (!hasCoords(p)) continue;
      seen.add(p.bbl);
      const m = parcelMetrics(p);
      const ex = exposureRef.current.get(p.bbl);
      const dotStyle = `--c:${statusColor(p.state)};display:block;width:12px;height:12px;border-radius:999px;background:var(--c);box-shadow:0 0 0 2.5px ${PAINT.white},0 2px 8px rgba(0,0,0,.45)${ex?.exposed ? `,0 0 0 7px ${PAINT.orange}66` : ""};transition:transform .2s`;
      const existing = markersRef.current.get(p.bbl);
      if (existing) {
        existing.setLngLat([p.lng, p.lat]).setAltitude(m.top);
        (existing.getElement().firstElementChild as HTMLElement | null)?.style.setProperty("cssText", dotStyle);
        continue;
      }
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", p.address);
      el.innerHTML = `<span style="${dotStyle}"></span>`;
      el.style.cssText = "background:none;border:0;padding:8px;cursor:pointer;line-height:0";
      el.addEventListener("mouseenter", () => {
        (el.firstElementChild as HTMLElement).style.transform = "scale(1.3)";
        setHovered(map, p.bbl);
      });
      el.addEventListener("mouseleave", () => {
        (el.firstElementChild as HTMLElement).style.transform = "scale(1)";
        setHovered(map, null);
      });
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (touringRef.current) setTouring(false);
        select(map, p.bbl, true);
        onSelectRef.current?.(p.bbl);
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: "center", altitude: m.top }).setLngLat([p.lng, p.lat]);
      marker.addTo(map);
      markersRef.current.set(p.bbl, marker);
    }
    for (const [bbl, m] of markersRef.current) {
      if (!seen.has(bbl)) {
        m.remove();
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
    syncMarkers(map, parcels);
    if (pinnedRef.current) map.setFeatureState({ source: "parcels", id: Number(pinnedRef.current) }, { selected: true });
    refreshCard(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels]);

  // air-rights visibility toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    for (const id of ["parcel-air", "parcel-air-hi"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", airVisible ? "visible" : "none");
    markersRef.current.forEach((m) => (m.getElement().style.opacity = airVisible ? "1" : "0.35"));
  }, [airVisible]);

  // external selection -> fly + card
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected || selected === pinnedRef.current) return;
    const go = () => select(map, selected, true);
    if (loadedRef.current) go();
    else map.once("style.load", go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // tour
  useEffect(() => {
    const map = mapRef.current;
    if (!touring || !map) return;
    const list = () => parcelsRef.current.filter(hasCoords);
    let i = Math.max(0, list().findIndex((p) => p.bbl === pinnedRef.current));
    const step = () => {
      const l = list();
      if (!l.length) return;
      const p = l[i % l.length];
      i += 1;
      select(map, p.bbl, true);
      onSelectRef.current?.(p.bbl);
    };
    step();
    const t = setInterval(step, TOUR_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touring]);

  if (glError) return <MapPlaceholder className={className} compact reason="webgl" />;

  const full = interactive && !mini && overlays;
  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {overlays ? (
        <>
          {full ? (
            <div className="pointer-events-none absolute left-3 top-3 hidden sm:block">
              <span className="map-pill">
                <Info className="size-3.5 opacity-80" /> Hover over a building to see its air rights
              </span>
            </div>
          ) : null}
          {full ? (
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <button type="button" onClick={() => setTouring((t) => !t)} className="map-pill map-pill-button" aria-pressed={touring}>
                {touring ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} <span className="hidden sm:inline">{touring ? "Stop tour" : "Tour"}</span>
              </button>
              <button type="button" onClick={() => setAirVisible((v) => !v)} className="map-pill map-pill-button" role="switch" aria-checked={airVisible}>
                <span className={cn("relative inline-block h-4 w-7 rounded-full transition-colors", airVisible ? "bg-green" : "bg-white/25")}>
                  <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", airVisible ? "left-3.5" : "left-0.5")} />
                </span>
                <span className="hidden sm:inline">Show air rights</span><span className="sm:hidden">Air rights</span>
              </button>
            </div>
          ) : null}
          <div className={cn("pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-24px)] items-center gap-1.5", mini ? "flex-nowrap" : "flex-wrap")}>
            <span className={cn("map-pill", mini && "map-pill-sm")}><span className="inline-block size-3 rounded-[3px]" style={{ background: PAINT.building }} /> Existing building</span>
            <span className={cn("map-pill", mini && "map-pill-sm")}><span className="inline-block size-3 rounded-[3px]" style={{ background: PAINT.green, opacity: 0.6 }} /> Tradable air rights</span>
            {!mini ? <span className="map-pill"><span className="inline-block size-2.5 rounded-full" style={{ background: PAINT.orange, boxShadow: `0 0 0 3px ${PAINT.orange}66` }} /> Exposed view</span> : null}
          </div>
          {full ? (
            <div className="pointer-events-none absolute bottom-3 right-3 hidden sm:block">
              <span className="map-pill">Drag to orbit · Scroll to zoom</span>
            </div>
          ) : null}
          {mini ? <div className="map-pill map-pill-sm pointer-events-none absolute right-3 top-3">Drag to orbit</div> : null}
        </>
      ) : null}
    </div>
  );
}
