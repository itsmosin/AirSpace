# AirSpace

**Verified New York City air rights, tokenized on Solana, audited by Chainlink CRE.**

Every building in New York sits under a zoning cap on how much floor area may be built on its lot. Most buildings use less than the cap. The difference is a legally transferable asset called unused development rights, better known as air rights. Today those rights trade through months of lawyer time with no public price discovery and no easy way to prove what a lot actually has left to sell.

AirSpace turns each lot's unused rights into an on-chain asset that is verified before it can exist and settles in one transaction when it trades.

```
owner enters address ─► Chainlink CRE workflow ─► Solana program ─► buyer
                        PLUTO zoning record         mint gated by verdict + owner attestation
                        LLM audit inside a TEE      list into program escrow
                        DON-signed verdict          buy: KYC attestation + Pyth price + Core transfer
```

## How it works

1. **Verify.** The web app opens a pending `Verdict` account for the lot's Borough-Block-Lot id and triggers the `airspace-verifier` CRE workflow. Inside a TEE handler the workflow fetches the lot's official NYC PLUTO record, computes unused floor area from the allowed FAR, asks an LLM to audit the submission against the public record, and derives a verdict (Allow / Deny / Review) with a confidence score and risk flags. The DON signs the report and delivers it through Chainlink's keystone forwarder into the program's `on_report` instruction.
2. **Mint.** `mint_parcel` refuses unless the verdict is Allow and the caller holds a Solana Attestation Service attestation naming them as the verified owner of that lot. The parcel becomes a Metaplex Core asset in the AirSpace collection with the zoning facts, unused square footage, and the verdict hash stored as on-chain attributes.
3. **Trade.** `list_parcel` moves the asset into program escrow at a USD price. `buy_parcel` requires the buyer's KYC attestation, reads the live SOL/USD price from Pyth, pays the seller and the treasury fee, and transfers the asset, all atomically in one transaction.

Every rule lives in the program. The web app only builds transactions.

## Devnet deployment

| | |
|---|---|
| Program | [`5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ`](https://explorer.solana.com/address/5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ?cluster=devnet) (Solana devnet) |
| Deploy tx | [4LnMz9JM…DubK](https://explorer.solana.com/tx/4LnMz9JMMuYFaaZYcWMJNJXzYpJ6fCmYpVwe48oNmzLYB28jMrYDfkSqikiiWdZ1e4YvqNGjNcpbVs45S9apDubK?cluster=devnet) |
| Registry PDA | [`8MPfyf4eXcTHVfDr5fbunFGTCJPF5yT2MUHhuzXZMrzg`](https://explorer.solana.com/address/8MPfyf4eXcTHVfDr5fbunFGTCJPF5yT2MUHhuzXZMrzg?cluster=devnet) |
| Core collection | [`ERWJ6d345HjKVGpT89gUmNGwmcmZeWjR97FeXWnXHc6L`](https://explorer.solana.com/address/ERWJ6d345HjKVGpT89gUmNGwmcmZeWjR97FeXWnXHc6L?cluster=devnet) |
| SAS credential | [`B1AcsVJyHv55QWNeQCQwMx1FCXaEV8UQ9HxJYA8wbeF8`](https://explorer.solana.com/address/B1AcsVJyHv55QWNeQCQwMx1FCXaEV8UQ9HxJYA8wbeF8?cluster=devnet) |

Example transactions:

| Step | Transaction |
|---|---|
| CRE verdict written through the forwarder (405 W 59th St, Allow, 135,942 sq ft) | [64NWVmca…67of](https://explorer.solana.com/tx/64NWVmcaSkKrkBcp39NWMQ7bjkkBJwcrYWiR1L7bW8CSwSWRQMrN5KocHkvQTMqry5oGSNH4VJzA2RSUodxg67of?cluster=devnet) |
| `mint_parcel` (22 Battery Place) | [a34mR2ux…fkF5q](https://explorer.solana.com/tx/a34mR2uxL35m6UqVXVyDYAENqnGk8Zzjx8JUJoqnHGQpQhjk5TH5UBejArDkmBNxjqwbeTyeXkTT9kN7vSfkF5q?cluster=devnet) |
| `list_parcel` (144 W 34th St, $77.4M) | [2CQD44gt…8ahH](https://explorer.solana.com/tx/2CQD44gtQhbEYtTLrfaMsLhJYdvp6rZGLe6RFRp2HncexF4xE8oHQDGeKvakBdJXrRZLdCeuQhi5YnZkMm6J8ahH?cluster=devnet) |
| `buy_parcel` with KYC attestation and Pyth pricing | [4xaGfAdj…rZeK](https://explorer.solana.com/tx/4xaGfAdjbincZ1Lg9WiC9b9j1SCdDf5HKmvLj37ADLJ1E9xTUS533v77WCs54oGrF1KfBwjL2BLeh2zvqNJirZeK?cluster=devnet) |

Full record with every address and the test log: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Repository

| Path | What it is |
|---|---|
| `programs/airspace` | Anchor 0.32 program: registry, verdicts, Core minting, escrow listings, Pyth-priced purchase, SAS attestation checks, Chainlink forwarder receiver. 25 localnet tests. |
| `cre/` | Chainlink CRE workflow (TypeScript, TEE handlers): HTTP trigger + cron sweep, PLUTO fetch, LLM audit, DON-signed `VerdictReport`, Solana write. Includes an offline mock LLM. |
| `apps/web` | Next.js app: 3D Mapbox map of parcels, explore, parcel pages, listing wizard, portfolio, activity, and the API routes that bridge wallet, registrar, CRE, and chain. |
| `packages/sas` | Solana Attestation Service helpers: credential, schemas, owner and KYC attestations. |
| `packages/shared` | Types, constants, PLUTO normalizer, program IDL. |
| `scripts/` | Devnet operations: SAS setup, attestation config, verdicts, seeding, relisting, purchase test. |
| `docs/INTERFACES.md` | The binding contract between program, workflow, and app: PDAs, instruction signatures, byte layouts. |

## Run it

Prerequisites: Bun 1.2+, Solana CLI, Anchor 0.32.1, the Chainlink CRE CLI (`cre login` once), a Phantom wallet switched to devnet, and devnet SOL from https://faucet.solana.com.

```bash
bun install

# 1. Chainlink CRE verifier: offline LLM stand-in, or set ANTHROPIC_API_KEY in cre/.env
cp cre/.env.example cre/.env            # fill CRE_SOLANA_PRIVATE_KEY (see cre/README.md)
bun run --cwd cre/mock-llm start        # terminal 1

# 2. Web app
cp apps/web/.env.example apps/web/.env.local   # add NEXT_PUBLIC_MAPBOX_TOKEN and MAPBOX_TOKEN
bun run --cwd apps/web dev              # terminal 2 → http://localhost:3000
```

Verify a lot from the command line and watch the DON-signed verdict land on devnet:

```bash
bun run --cwd scripts open-verdict.ts --bbl 1011310016
cd cre && cre workflow simulate ./airspace-verifier --target staging-settings --non-interactive \
  --trigger-index 0 --http-payload ./payloads/west59.json --broadcast
```

Buy a listed parcel end to end with a fresh KYC'd wallet:

```bash
bun run --cwd scripts buy-test.ts --bbl 1007150059
```

### Judge walkthrough (about two minutes)

1. Open http://localhost:3000/explore. Five Manhattan lots are minted; two are listed at demo prices so faucet SOL is enough.
2. Connect Phantom on devnet. Open a listed parcel and press **Verify identity**. The registrar issues a KYC attestation to your wallet.
3. Press **Buy**. The quote is computed from the Pyth SOL/USD feed. One transaction pays the seller and transfers the Core asset. The explorer link appears when it confirms.
4. Try **List air rights** with the address `405 West 59th Street`: the wizard fetches the PLUTO record, requests a Chainlink verification, streams the CRE log, and lets you mint once the on-chain verdict is Allow. Try `350 Fifth Avenue` to watch the Empire State Building get denied: it is fully built out, so it has no rights to sell.

## Why this needs both chains of trust

A seller's own claim about their air rights is worthless, and a single server verifying it is a single point of fraud. The CRE workflow gives the verdict DON consensus and keeps the model credentials inside an enclave, and the program refuses to mint anything the workflow did not approve. Solana makes the resulting market real: an atomic property-rights transfer, gated by on-chain identity, for a fraction of a cent, in under a second.

## Roadmap

- Fractional units per parcel with Token-2022 and a transfer-gate program for compliance.
- Zoning-lot-merger contracts generated from the verified record and anchored on-chain.
- Production DON forwarder (`set_forwarder` is already an admin instruction) and a hosted verifier endpoint.
- More cities with open parcel data.
