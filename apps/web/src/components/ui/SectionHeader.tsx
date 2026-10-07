"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OrbitArcs } from "./OrbitArcs";

const ease = [0.22, 1, 0.36, 1] as const;

/** Huge centered page title with one or two lines of muted explanation and a faint orbit arc behind. */
export function SectionHeader({ eyebrow, title, description, children, className, size = "lg" }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; size?: "lg" | "md" }) {
  return (
    <div className={cn("relative isolate overflow-hidden px-4 pb-10 pt-14 text-center sm:px-6 md:pb-14 md:pt-20", className)}>
      <OrbitArcs variant="section" className="-z-10" />
      <div className="mx-auto max-w-3xl">
        {eyebrow ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-5 flex justify-center">
            {eyebrow}
          </motion.div>
        ) : null}
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.06, ease }} className={cn("display font-semibold leading-[1.05] text-fg", size === "lg" ? "text-[40px] sm:text-[48px]" : "text-[32px] sm:text-[40px]")}>
          {title}
        </motion.h1>
        {description ? (
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12, ease }} className="mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-fg-muted">
            {description}
          </motion.p>
        ) : null}
        {children ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18, ease }} className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {children}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
