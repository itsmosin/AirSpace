import { Glyph } from "@/components/brand/Logo";
import { AIRSPACE_PROGRAM_ID } from "@airspace/shared";
import { explorerAddress } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Glyph className="size-5" />
          <p className="text-sm text-fg-muted">
            <span className="font-medium text-fg">AirSpace</span> · verified NYC air rights, settled on Solana.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-faint">
          <span>Verification by Chainlink CRE</span>
          <span>Assets on Metaplex Core</span>
          <span>Pricing via Pyth</span>
          <a href={explorerAddress(AIRSPACE_PROGRAM_ID)} target="_blank" rel="noreferrer" className="font-mono hover:text-cyan">
            program {AIRSPACE_PROGRAM_ID.slice(0, 6)}…{AIRSPACE_PROGRAM_ID.slice(-4)}
          </a>
        </div>
      </div>
    </footer>
  );
}
