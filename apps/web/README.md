# AirSpace web

Next.js 16 (App Router, Tailwind v4, Turbopack) front end and API layer for AirSpace, the NYC air-rights marketplace on Solana devnet with Chainlink CRE verification.

## Run

```bash
# from the repo root
bun install
cp apps/web/.env.example apps/web/.env.local   # then fill in the Mapbox tokens
bun run --cwd apps/web dev                     # http://localhost:3000
```

`bun run build` runs a production build (type-checked). `bun run typecheck` runs `tsc` only.

Before `dev`/`build`, `scripts/sync-idl.mjs` copies the Anchor IDL from `packages/shared/idl/airspace.json` into `src/idl/airspace.json`. When that file does not exist yet it falls back to `src/idl/airspace.provisional.json`, which mirrors `docs/INTERFACES.md` section 1 (regenerate it with `bun run idl:provisional`).

## Environment variables (`.env.local`)

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | browser | Solana RPC for the wallet adapter and client-side reads (default devnet). |
| `NEXT_PUBLIC_PROGRAM_ID` | browser | AirSpace program id. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | browser | Mapbox GL token for the 3D map. Without it the map shows a placeholder panel; everything else still works. |
| `MAPBOX_TOKEN` | server | Mapbox Geocoding for `/api/pluto?address=`. Without it the route falls back to a PLUTO text search. |
| `SOLANA_RPC_URL` | server | RPC used by API routes. |
| `REGISTRAR_KEYPAIR_PATH` | server | Registrar keypair: pays `open_verdict`, signs SAS attestations. |
| `SAS_CONFIG_PATH` | server | `keys/sas-config.json` with `{ credential, ownerSchema, kycSchema }` (written by `scripts/setup-sas.ts`). |
| `CRE_DIR` | server | Chainlink CRE project directory (`cre/`). |
| `CRE_BIN` | server | Path to the `cre` CLI. |

Paths are resolved relative to `apps/web`.

## Pages

| Route | What it does |
|---|---|
| `/` | Full-bleed 3D map hero, live stats strip, how-it-works. |
| `/explore` | Sticky map with extruded "air-rights volumes" + filterable parcel cards (listed only, borough, min sq ft, text). |
| `/parcel/[bbl]` | Hero facts and FAR bar, verification panel (verdict, confidence, flags, report hash, source, explorer links), PLUTO record, Core asset attributes, owner list/cancel, buyer flow with live Pyth SOL/USD and KYC gate. |
| `/list` | Six-step wizard: connect, identity (KYC attestation), find building (address/BBL), request Chainlink CRE verification with a live log, mint, list. Progress persists in `localStorage`. |
| `/portfolio` | Parcels owned by the connected wallet, list/cancel actions, Core asset cross-check via Umi. |
| `/activity` | Recent program transactions decoded with Anchor's `EventParser`. |

## API routes (Node runtime)

| Route | Method | Notes |
|---|---|---|
| `/api/pluto` | GET | `?bbl=`, `?lat=&lng=` (nearest lot) or `?address=` (Mapbox geocode, PLUTO text fallback). Returns a normalized `PlutoLot`. |
| `/api/kyc` | POST | `{ wallet, level }` → KYC attestation via `@airspace/sas` (registrar signs). |
| `/api/attest-owner` | POST | `{ wallet, bbl, docHash? }` → owner attestation after a mock title check against PLUTO. |
| `/api/verify` | POST | `{ bbl, wallet, submitted? }` → `open_verdict` (registrar pays), then spawns `cre workflow simulate … --broadcast` with the payload written to `.data/payloads/<jobId>.json`. Logs stream to `.data/logs/<jobId>.log`. |
| `/api/verify/[bbl]` | GET | Latest job (status, log tail, report tx) plus the decoded on-chain `Verdict`. |
| `/api/verify/pending` | GET | `{ pending: [{ bbl }] }` for the CRE cron handler. |
| `/api/metadata/[bbl]` | GET | Metaplex Core JSON metadata (image = `/api/og/[bbl]` SVG). |
| `/api/metadata/collection` | GET | Collection metadata. |
| `/api/parcels` | GET | All `Parcel` + `Listing` + `Verdict` accounts decoded, 15 s in-memory cache (`?refresh=1` busts it). |

The job store lives in `apps/web/.data/jobs.json` (gitignored).

## Code map

- `src/lib/airspace/` program client: IDL loader, PDAs, `getProgram`, typed instruction builders, account decoders, event parsing.
- `src/lib/pyth.ts` PriceUpdateV2 parsing and the USD-cents → lamports math used by `buy_parcel`.
- `src/lib/attestation.ts` client-side SAS attestation reads; `src/lib/sas.ts` server-side issuance via `@airspace/sas`.
- `src/lib/server/` RPC connection, registrar wallet, PLUTO client, CRE runner, parcels cache.
- `src/components/map/` Mapbox GL map (client only) with built-in 3D buildings and glowing parcel volumes.
