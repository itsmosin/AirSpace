"use client";

import { motion } from "framer-motion";
import { ArrowRight, Coins, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Panel";

const steps = [
  {
    icon: ShieldCheck,
    title: "Verify with Chainlink CRE",
    body: "A decentralized workflow pulls the lot's PLUTO record, computes unused FAR, runs a confidential audit and writes a signed verdict to the AirSpace program.",
    accent: "from-cyan/30 to-cyan/0",
  },
  {
    icon: Layers,
    title: "Mint on Solana",
    body: "With an Allow verdict and an owner attestation, the rights become a Metaplex Core asset carrying the verified attributes and a 5% royalty.",
    accent: "from-violet/30 to-violet/0",
  },
  {
    icon: Coins,
    title: "Trade instantly",
    body: "List in USD, settle in SOL at the live Pyth price. KYC-attested buyers receive the asset from escrow in the same transaction.",
    accent: "from-cyan/20 to-violet/0",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32">
      <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">From city records to a settled trade in three steps.</h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-fg-muted">
          Every number shown on a parcel traces back to an on-chain verdict whose report hash you can audit. No spreadsheets, no brokers, no waiting.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="group glass relative overflow-hidden rounded-3xl p-6 transition-colors hover:border-white/20"
          >
            <div className={`pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br ${s.accent} blur-2xl transition-opacity group-hover:opacity-100`} />
            <div className="flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan">
                <s.icon className="size-5" />
              </div>
              <span className="font-mono text-xs text-fg-faint">0{i + 1}</span>
            </div>
            <h3 className="mt-6 text-lg font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-14 flex flex-col items-start gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-cyan/10 via-transparent to-violet/10 p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Own a building with room to grow?</h3>
          <p className="mt-1 text-sm text-fg-muted">Find your lot, request verification and list in a few minutes. No account needed, just a wallet.</p>
        </div>
        <div className="flex gap-3">
          <Button href="/list" iconRight={<ArrowRight className="size-4" />}>Start listing</Button>
          <Button href="/explore" variant="secondary">Browse market</Button>
        </div>
      </div>
    </section>
  );
}
