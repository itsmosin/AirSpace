"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OrbitArcs } from "@/components/ui/OrbitArcs";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const steps = [
  {
    label: "Verify",
    title: "Verify",
    body: "A Chainlink CRE workflow pulls the lot's PLUTO record, computes unused FAR, audits it confidentially and writes a signed verdict on-chain.",
    card: "bg-tint-green",
    dot: "bg-green",
    text: "text-green-ink",
  },
  {
    label: "Mint",
    title: "Mint",
    body: "With an Allow verdict and an owner attestation, the rights become a Metaplex Core asset carrying the verified attributes and a 5% royalty.",
    card: "bg-tint-orange",
    dot: "bg-orange",
    text: "text-orange-ink",
  },
  {
    label: "Trade",
    title: "Trade",
    body: "List in USD, settle in SOL at the live Pyth price. KYC-attested buyers receive the asset from escrow in the same transaction.",
    card: "bg-tint-blue",
    dot: "bg-blue",
    text: "text-blue-ink",
  },
];

export function HowItWorks() {
  return (
    <section className="relative isolate mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32">
      <OrbitArcs variant="section" className="-z-10" />
      <div className="mx-auto max-w-3xl text-center">
        <motion.h2 initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease }} className="display text-[40px] font-semibold leading-[1.05] text-fg sm:text-[48px]">
          From city records to a settled trade.
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.06, ease }} className="mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-fg-muted">
          Every number shown on a parcel traces back to an on-chain verdict whose report hash you can audit. No spreadsheets, no brokers, no waiting.
        </motion.p>
      </div>

      {/* timeline connector */}
      <div className="relative mx-auto mt-14 hidden max-w-5xl md:block" aria-hidden>
        <div className="absolute inset-x-[16.6%] top-1/2 h-px -translate-y-1/2 bg-line-strong" />
        <div className="grid grid-cols-3">
          {steps.map((s) => (
            <div key={s.label} className="flex justify-center">
              <span className={cn("size-3 rounded-full ring-4 ring-bg", s.dot)} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06, ease }}
            className={cn("rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-0.5 md:p-8", s.card)}
          >
            <p className={cn("flex items-center gap-2 text-[13px] font-medium", s.text)}>
              <span className={cn("size-2 rounded-full", s.dot)} /> Step {i + 1}
            </p>
            <h3 className="display mt-4 text-[40px] font-semibold leading-none text-fg">{s.title}</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">{s.body}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-14 flex flex-col items-start gap-5 rounded-3xl border border-line bg-surface p-8 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="display text-[24px] font-semibold text-fg">Own a building with room to grow?</h3>
          <p className="mt-1 text-[15px] text-fg-muted">Find your lot, request verification and list in a few minutes. No account needed, just a wallet.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/list" iconRight={<ArrowRight className="size-4" />}>Start listing</Button>
          <Button href="/explore" variant="secondary">Browse market</Button>
        </div>
      </div>
    </section>
  );
}
