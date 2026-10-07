# AirSpace

**The sky above New York is a multi-billion-dollar asset nobody can trade. AirSpace makes it a verified on-chain market.**

Live: **https://airspace-nyc.vercel.app** · Program: [`5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ`](https://explorer.solana.com/address/5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ?cluster=devnet) on Solana devnet · Verified by a Chainlink CRE workflow

---

## The idea

Every building in New York City sits under a zoning cap: the city says how much floor area may be built on each lot. Most buildings use less than they are allowed. The gap between what is built and what is permitted is a real, legally transferable asset. New York calls it **unused development rights**; everyone else calls it **air rights**. A neighbor can buy it to build taller. A hotel can buy it to protect its view. Developers assemble it lot by lot to make towers possible.

It is one of the largest asset classes with no market. Air rights change hands in private deals that take months of lawyers, with no price discovery, no public record of what a lot actually has left to sell, and no way for a small owner to participate. The data to value these rights is public. The market to trade them does not exist.

AirSpace is that market. Every parcel on the platform is checked against the city's own records before it can exist, minted as a Solana asset that carries its verified facts, and traded in a single transaction that settles in under a second. The seller gets paid in SOL at a live USD price. The buyer gets the asset. Nobody takes anyone's word for anything.

## Why this unlocks a new asset class

- **Verification before existence.** A parcel cannot be minted until an independent oracle network has fetched the city's record for that lot, audited the claim, and signed a verdict. The program refuses anything self-reported.
- **Provenance built in.** Each asset carries the lot id, zoning district, allowed floor-area ratio, built area, unused square footage, and the hash of the audit report that approved it. Anyone can re-derive the number from the public record.
- **Identity without doxxing.** Owners and buyers hold attestations issued through the Solana Attestation Service. The program checks the attestation account bytes on-chain; it never sees a name or a document.
- **Instant, cheap, final.** A property-rights transfer that takes a quarter today settles atomically on Solana for a fraction of a cent.

## How it works

Nothing in this system is hard-coded or mocked. Every number on the site is read from Solana devnet, every verification is a real Chainlink CRE execution against live city data, and every step below links to the transaction that proves it.

```
owner enters an address
        │
        ▼
NYC PLUTO record ──► Chainlink CRE workflow ──► DON-signed verdict ──► Solana program
(public city data)    PLUTO fetch + FAR math      written through the    mint · list · buy
                      LLM audit inside a TEE      keystone forwarder     gated by attestations
```

### 1. The city's record

The source of truth is **NYC PLUTO**, the Department of City Planning's dataset of every tax lot, served by NYC Open Data with no API key. Each lot is keyed by its Borough-Block-Lot number (BBL) and gives lot area, built floor area, allowed floor-area ratios, zoning district, floors, owner of record, landmark and historic-district status, and coordinates.

Unused air rights are plain arithmetic on that record: highest allowed FAR × lot area − built area. For 405 West 59th Street that is 10.0 × 18,057 − 44,628 = **135,942 sq ft**. For the Empire State Building it is zero: the lot is fully built out, and the system denies it.

### 2. The Chainlink CRE verifier

When someone requests verification, the web app opens a pending `Verdict` account on-chain and the `airspace-verifier` CRE workflow takes over:

1. **Trigger.** An HTTP trigger for on-demand requests, plus a cron handler that sweeps the pending queue every five minutes.
2. **Fetch.** Inside a TEE handler, the workflow fetches the lot's PLUTO record over HTTP and computes unused floor area and risk flags (landmark, historic district, special district, no unused FAR).
3. **Audit.** Still inside the enclave, it calls Claude with the API key held as a CRE secret, asking for a structured JSON audit: is the submission consistent with the public record, does the owner name match, what confidence, what value adjustment. Confidence is grounded in the record, so the same lot gets the same verdict whether it arrives through the HTTP trigger or the sweep.
4. **Verdict.** Allow, Deny, or Review, with confidence in basis points, a flag bitmask, the unused square footage, the estimated value, and the SHA-256 of the audit report.
5. **Write.** The workflow crosses back to the DON, which signs the Borsh-encoded `VerdictReport` and delivers it through Chainlink's keystone forwarder into the program's `on_report` instruction. The program verifies the forwarder's PDA signature before accepting anything.

Proof on devnet:

| Run | Result | Transaction |
|---|---|---|
| 405 West 59th Street, HTTP trigger, real model | Allow, 92% confidence, 135,942 sq ft | [5ti2x3Vs…iBRY](https://explorer.solana.com/tx/5ti2x3VsGjb1o1xxoJjoemxS5HpKzAn4niuTxj4twkdatuDxeXSFoL5pcvzj59wnaqESn4JqZ2Akjpi2V378iBRY?cluster=devnet) |
| 405 West 59th Street, cron sweep from the hosted site | Allow, 93% confidence | [4xqaDk3U…gpRP](https://explorer.solana.com/tx/4xqaDk3UdJBxiHVGT5qDbbMDC2WbBQjnCPm4yUsVDY3NsNN7SpxjFRFCpEHva4jNemo7EtD2fgABQiVcNXxggpRP?cluster=devnet) |
| 350 Fifth Avenue (Empire State Building) | Deny, fully built out, flags: landmark + special district | see the parcel page on the site |

### 3. Ownership and identity

Before minting, the owner's wallet needs a **Solana Attestation Service** attestation binding it to that BBL. Before buying, the buyer's wallet needs a KYC attestation. Both are issued by the AirSpace registrar credential and expire after a year. The program parses the attestation account itself: owner program, PDA derivation, credential, schema, expiry, and the BBL inside the data. In the demo the registrar checks the owner name against the city's record; in production the registrar is a title company or the deed registry signing the same attestation.

| | Address |
|---|---|
| Registrar credential | [`B1AcsVJyHv55QWNeQCQwMx1FCXaEV8UQ9HxJYA8wbeF8`](https://explorer.solana.com/address/B1AcsVJyHv55QWNeQCQwMx1FCXaEV8UQ9HxJYA8wbeF8?cluster=devnet) |
| Schema `airspace_owner_v1` | [`34oBTRYqzffq3wquxFYrGDrkwpKvY4VWk7LDnu8kMe8c`](https://explorer.solana.com/address/34oBTRYqzffq3wquxFYrGDrkwpKvY4VWk7LDnu8kMe8c?cluster=devnet) |
| Schema `airspace_kyc_v1` | [`BdeshPHG8MyfvMTKdiuH14PZ1a2BjEDoNT3WxTLF4b6b`](https://explorer.solana.com/address/BdeshPHG8MyfvMTKdiuH14PZ1a2BjEDoNT3WxTLF4b6b?cluster=devnet) |

### 4. Mint, list, buy

- **Mint** (`mint_parcel`) requires an Allow verdict and the owner attestation. It creates a Metaplex Core asset in the AirSpace collection with the verified facts stored as on-chain attributes and a 5% royalty, and a `Parcel` account that mirrors them.
- **List** (`list_parcel`) moves the asset into program escrow at a USD price.
- **Buy** (`buy_parcel`) requires the buyer's KYC attestation, reads the live SOL/USD price from the Pyth feed, pays the seller and the treasury fee, and transfers the asset to the buyer. One transaction, atomic.

| Step | Transaction |
|---|---|
| `mint_parcel`, 22 Battery Place | [a34mR2ux…fkF5q](https://explorer.solana.com/tx/a34mR2uxL35m6UqVXVyDYAENqnGk8Zzjx8JUJoqnHGQpQhjk5TH5UBejArDkmBNxjqwbeTyeXkTT9kN7vSfkF5q?cluster=devnet) |
| `list_parcel`, 144 West 34th Street at $77.4M | [2CQD44gt…8ahH](https://explorer.solana.com/tx/2CQD44gtQhbEYtTLrfaMsLhJYdvp6rZGLe6RFRp2HncexF4xE8oHQDGeKvakBdJXrRZLdCeuQhi5YnZkMm6J8ahH?cluster=devnet) |
| KYC attestation issued to a buyer | [3W7SCzxj…8xXW](https://explorer.solana.com/tx/3W7SCzxjc5oLdkbuFCgGqnWo6Mf1Xjwp8Whi17GZMV7m8PPD3BvZpH1rh3xsjmT3PochBvjgsERh2SmJt5Fr8xXW?cluster=devnet) |
| `buy_parcel`, $25 listing settled in SOL at the Pyth price | [4xaGfAdj…rZeK](https://explorer.solana.com/tx/4xaGfAdjbincZ1Lg9WiC9b9j1SCdDf5HKmvLj37ADLJ1E9xTUS533v77WCs54oGrF1KfBwjL2BLeh2zvqNJirZeK?cluster=devnet) |

The same buyer was rejected with `InvalidAttestation` one transaction earlier, before the KYC attestation existed. The program, not the UI, enforces the rule.

---

## Solana track

**Requirement: the project must interact with Solana through a program you deploy or by meaningfully integrating existing programs, be functional on devnet or mainnet, and be demoable end to end.**

- **Our own program**, written in Anchor during the hackathon and deployed to devnet: [`5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ`](https://explorer.solana.com/address/5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ?cluster=devnet), deploy transaction [4LnMz9JM…DubK](https://explorer.solana.com/tx/4LnMz9JMMuYFaaZYcWMJNJXzYpJ6fCmYpVwe48oNmzLYB28jMrYDfkSqikiiWdZ1e4YvqNGjNcpbVs45S9apDubK?cluster=devnet). Registry [`8MPfyf4e…MrzG`](https://explorer.solana.com/address/8MPfyf4eXcTHVfDr5fbunFGTCJPF5yT2MUHhuzXZMrzg?cluster=devnet), collection [`ERWJ6d34…Hc6L`](https://explorer.solana.com/address/ERWJ6d345HjKVGpT89gUmNGwmcmZeWjR97FeXWnXHc6L?cluster=devnet).
- **Core logic lives on-chain.** Eleven instructions cover registry setup, verdict intake from the Chainlink forwarder, attestation-gated minting, escrow listings, and the Pyth-priced purchase. The web app only builds transactions; it cannot bypass a single check.
- **Four existing Solana programs composed by CPI or on-chain parsing:** Metaplex Core (asset creation and transfer), the Solana Attestation Service (ownership and KYC), the Pyth receiver (SOL/USD price with staleness and feed checks), and Chainlink's keystone forwarder (verified report delivery).
- **Only practical on Solana.** The purchase bundles a price lookup, two SOL transfers, an attestation check, and an NFT transfer into one atomic transaction for a fraction of a cent, with devnet already running Alpenglow finality.
- **Tested.** 25 localnet tests, including the negative paths: mint without attestation, mint on a Deny, buy without KYC, buy an unlisted parcel, and `on_report` from anyone but the forwarder. Full record in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **Judge-runnable.** The live site plus a Phantom wallet on devnet is enough; two parcels are listed at demo prices so faucet SOL covers a purchase. Walkthrough below.

## Chainlink CRE track

**Requirement: build, simulate, or deploy a CRE workflow used as an orchestration layer that integrates at least one blockchain with an external API, data source, LLM, or AI agent, and demonstrate a successful simulation.**

- **Orchestration layer.** The `airspace-verifier` workflow is the only path by which a parcel can become real. It coordinates a public data source (NYC PLUTO), an LLM (Claude), consensus, and a chain write; the app and the program both depend on it.
- **Triggers and capabilities used:** HTTP trigger (on-demand), cron trigger (queue sweep), HTTP capability for the city API and the model, TEE handler (`handlerInTee`) so the API key and the audit payloads never leave the enclave, CRE secrets for the key, DON consensus and report signing, and the Solana write capability through the keystone forwarder.
- **Successful simulation, with real effects.** `cre workflow simulate` runs the full pipeline and, with `--broadcast`, lands the signed verdict on devnet. The transactions in the table above came from exactly this command:

```bash
cd cre && cre workflow simulate ./airspace-verifier --target staging-settings --non-interactive \
  --trigger-index 0 --http-payload ./payloads/west59.json --broadcast
```

- **Deterministic by design.** The audit prompt grounds confidence in the public record, the verdict rule is fixed in code, and the report hash is SHA-256 of the canonical audit JSON, so the on-chain verdict is auditable after the fact.
- **Consumer contract.** `on_report` verifies the forwarder state's owner and the forwarder authority PDA before decoding the report, the Solana equivalent of a `ReceiverTemplate`.

Details, layout, and the mock server for offline runs: [`cre/README.md`](cre/README.md).

---

## Try it

### On the live site

1. Install Phantom, enable Testnet Mode in Developer Settings, select Solana Devnet, and get SOL from https://faucet.solana.com.
2. Open https://airspace-nyc.vercel.app/explore. Hover the buildings: the solid block is what exists, the colored volume above it is the tradable air rights.
3. Open **442 West 18th Street**, press **Verify identity** (a KYC attestation is issued to your wallet), then **Buy** for $30. One transaction, explorer link on confirmation.
4. Go to **List air rights** and enter `350 Fifth Avenue`. Request verification and watch the Chainlink verdict come back **Denied** within a minute: the Empire State Building has nothing left to sell.
5. Enter `405 West 59th Street` instead: **Verified**, 135,942 sq ft. Mint it, list it, and it appears on the map.

Verification requests from the site are queued on-chain and picked up by the CRE sweep, which runs wherever the CRE CLI is installed:

```bash
scripts/verifier-loop.sh 60 hosted-settings
```

### Locally

Prerequisites: Bun 1.2+, Solana CLI, Anchor 0.32.1, the Chainlink CRE CLI (`cre login` once), Phantom on devnet.

```bash
bun install
cp cre/.env.example cre/.env                   # CRE_SOLANA_PRIVATE_KEY, ANTHROPIC_API_KEY (see cre/README.md)
cp apps/web/.env.example apps/web/.env.local   # NEXT_PUBLIC_MAPBOX_TOKEN, MAPBOX_TOKEN
bun run --cwd apps/web dev                     # http://localhost:3000; verification runs the CRE CLI directly
```

Scripted end-to-end checks:

```bash
bun run --cwd scripts open-verdict.ts --bbl 1011310016        # open a pending verdict
cd cre && cre workflow simulate ./airspace-verifier --target staging-settings --non-interactive --trigger-index 0 --http-payload ./payloads/west59.json --broadcast
bun run --cwd scripts buy-test.ts --bbl 1007150059            # fresh buyer: rejected, KYC'd, purchase settled
```

## Repository

| Path | What it is |
|---|---|
| `programs/airspace` | Anchor program: registry, verdicts, Core minting, escrow listings, Pyth-priced purchase, attestation parsing, forwarder receiver; 25 tests |
| `cre/` | Chainlink CRE workflow, Solana receiver bindings, payloads, offline mock, README |
| `apps/web` | Next.js app: satellite 3D map of parcels, explore, parcel pages, listing wizard, portfolio, activity, API routes |
| `packages/sas` | Solana Attestation Service helpers: credential, schemas, owner and KYC attestations |
| `packages/shared` | Types, constants, PLUTO normalizer, program IDL |
| `scripts/` | Devnet operations: attestation setup, verdicts, seeding, relisting, purchase test, verifier loop |
| `docs/INTERFACES.md` | The binding contract between program, workflow, and app |
| `docs/DEPLOYMENT.md` | Every devnet address, transaction, and the test log |

## What comes next

- Fractional units per parcel with Token-2022 and a transfer gate for compliance.
- Zoning-lot-merger agreements generated from the verified record and anchored on-chain.
- Production DON forwarder (the program already has an admin `set_forwarder`) and a hosted verifier endpoint.
- Title-company registrars behind a multisig, and more cities with open parcel data.
