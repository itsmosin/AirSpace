"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Glyph } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { OrbitArcs } from "@/components/ui/OrbitArcs";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;
const fade = (i: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: i * 0.06, ease } });

const tiles = [
  { cls: "tile-steel", pos: "-left-12 top-10 size-[190px] lg:-left-6 lg:size-[220px]", depth: 18, delay: "0s" },
  { cls: "tile-diagonals", pos: "-right-14 top-6 size-[170px] lg:-right-8 lg:size-[200px]", depth: -24, delay: "-3s" },
  { cls: "tile-stripe", pos: "-left-10 bottom-6 size-[160px] lg:left-2 lg:size-[180px]", depth: -14, delay: "-5s" },
  { cls: "tile-chevron", pos: "-right-10 bottom-2 size-[180px] lg:-right-4 lg:size-[210px]", depth: 26, delay: "-7s" },
];

export function Hero() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });

  return (
    <section
      className="relative isolate overflow-hidden"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <div className="dot-field absolute inset-0 -z-20" />
      <OrbitArcs className="-z-10" />

      {tiles.map((t) => (
        <Tile key={t.cls} {...t} sx={sx} sy={sy} />
      ))}

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 md:pb-28 md:pt-28">
        <motion.div {...fade(0)}>
          <Glyph className="size-10" />
        </motion.div>
        <motion.h1 {...fade(2)} className="display mt-6 text-[40px] font-semibold leading-[1.02] text-fg sm:text-[56px] md:text-[72px] lg:text-[84px]">
          Trade the <span className="text-rainbow">sky</span>
          <br />
          above New York.
        </motion.h1>
        <motion.p {...fade(3)} className="mt-6 max-w-2xl text-[17px] leading-relaxed text-fg-muted sm:text-[19px]">
          Unused development rights, verified against the city&apos;s own records by Chainlink CRE, minted as Metaplex Core assets and settled on Solana in under a second.
        </motion.p>
        <motion.div {...fade(4)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button href="/explore" size="lg" iconRight={<ArrowRight className="size-4" />}>
            Explore parcels
          </Button>
          <Button href="/list" size="lg" variant="secondary">
            List your air rights
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function Tile({ cls, pos, depth, delay, sx, sy }: (typeof tiles)[number] & { sx: ReturnType<typeof useSpring>; sy: ReturnType<typeof useSpring> }) {
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  return (
    <motion.div style={{ x, y }} className={cn("pointer-events-none absolute -z-[5] hidden md:block", pos)} aria-hidden>
      <div className={cn("tile animate-float h-full w-full", cls)} style={{ animationDelay: delay }} />
    </motion.div>
  );
}
