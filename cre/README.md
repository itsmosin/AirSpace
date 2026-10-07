# AirSpace — Chainlink CRE verifier

A Chainlink Runtime Environment (CRE) workflow that verifies NYC air-rights
(unused floor area / TDR) submissions and records a signed verdict on the
AirSpace Solana program.

```
HTTP trigger { bbl, submitted? }  ─┐
                                   ├─► [TEE] PLUTO lookup ─► unused FAR + flags ─► LLM audit (Anthropic)
cron (every 5 min, pending queue) ─┘        ─► verdict rule ─► sha256(audit JSON)
                                                    │  usingTheDons()
                                                    ▼
                                   signed VerdictReport ─► SolanaClient.writeReport ─► keystone forwarder
                                                                                      └─► airspace::on_report (Verdict PDA)
```

## Layout

| Path | Purpose |
|---|---|
| `project.yaml` | CRE targets (`simulation-settings`, `staging-settings`, `production-settings`) with the Solana devnet RPC |
| `secrets.yaml` | secret id `ANTHROPIC_API_KEY` → env var `ANTHROPIC_API_KEY` |
| `.env.example` | `CRE_SOLANA_PRIVATE_KEY`, `CRE_ETH_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, `MOCK_PORT` |
| `airspace-verifier/` | the workflow (`main.ts`, `pluto.ts`, `sha256.ts`, `workflow.yaml`, `config.*.json`) |
| `bindings/AirspaceReceiver.ts` | `VerdictReport` Borsh codec, `Verdict` account decoder, `writeVerdictReport` / `readVerdict` |
| `mock-llm/server.js` | offline Anthropic Messages stand-in + `GET /api/verify/pending` stub |
| `payloads/` | HTTP trigger payloads (`esb.json`, `west59.json`) and the cron stub data (`pending.json`) |
| `scripts/keypair-to-base58.ts` | dependency-free helper to turn a Solana JSON keypair into `CRE_SOLANA_PRIVATE_KEY` |

## Prerequisites

- CRE CLI (`cre version` → v1.37.0 used here) and a logged-in account (`cre whoami`)
- Bun ≥ 1.2
- `cre/.env` (gitignored) — copy `.env.example` and fill in:
  - `CRE_SOLANA_PRIVATE_KEY` — base58 of the deployer keypair:
    `bun run scripts/keypair-to-base58.ts ~/.config/solana/airspace-deployer.json`
  - `CRE_ETH_PRIVATE_KEY` — any well-formed placeholder (required by the CLI loader, unused)
  - `ANTHROPIC_API_KEY` — a real key when `llmUrl` is `https://api.anthropic.com/v1/messages`;
    any non-empty dummy (e.g. `mock-anthropic-key`) when using the mock

## Run

```bash
cd cre
bun install --cwd ./airspace-verifier      # or `bun install` from the repo root
bun run --cwd ./airspace-verifier typecheck

# terminal 1 — offline LLM + pending-queue stub
bun run --cwd ./mock-llm start             # http://127.0.0.1:8787

# terminal 2 — on-demand verification (handler 0, HTTP trigger)
cre workflow simulate ./airspace-verifier --target staging-settings --non-interactive \
  --trigger-index 0 --http-payload ./payloads/esb.json

# pending-queue sweep (handler 1, cron). simulation-settings points the queue at the mock stub;
# staging-settings points it at the web app (http://localhost:3000/api/verify/pending)
cre workflow simulate ./airspace-verifier --target simulation-settings --non-interactive --trigger-index 1
```

Note: CRE CLI v1.37.0 takes `--http-payload` as a JSON string **or a plain file path**
(`./payloads/esb.json`, no `@` prefix).

Add `--broadcast` to send the real devnet transaction once the program is deployed
and the registry is initialised (see "On-chain prerequisites").

## Configuration (`airspace-verifier/config.*.json`)

| Key | Meaning |
|---|---|
| `webBaseUrl` | web app base URL; the cron handler polls `${webBaseUrl}/api/verify/pending` |
| `llmUrl` | `https://api.anthropic.com/v1/messages` or the mock `http://127.0.0.1:8787/v1/messages` |
| `llmModel` | `claude-sonnet-5` |
| `llmSecretId` | secret id requested inside the enclave (`ANTHROPIC_API_KEY`) |
| `plutoUrl` | NYC PLUTO Socrata endpoint |
| `pendingSchedule` | 6-field cron, `0 */5 * * * *` |
| `maxPendingPerRun` | parcels processed per cron run (2) |
| `solana.*` | `chainSelectorName`, `programId`, `forwarderProgramId`, `forwarderState` |

### Which forwarder?

`cre workflow simulate` (with or without `--broadcast`) always builds the Solana
transaction through **CRE's simulator mock forwarder**, never through the DON
forwarder. Because the web app triggers verification by spawning
`cre workflow simulate … --broadcast`, the targets used by the app point at the mock
forwarder, and the on-chain `Registry.forwarder_program` must be initialised with it:

| Target | `forwarderProgramId` | `forwarderState` | Used by |
|---|---|---|---|
| `simulation-settings`, `staging-settings` | `7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK` | `5Tipz3yhTBdVsDbaBxZkrp7Gjf3brGq5SKkxReefPMP7` | `cre workflow simulate` (web app, local dev) |
| `production-settings` | `CXsKEJcs25TQEYU2e5jZ8QTPE3ffMLZhH6BWHrdcCCB5` | `8QoomCQyPSkJ8WopJbX9B4HyvrFzziwvJdU8hZE6DCr9` | a real `cre workflow deploy` to a DON |

`on_report` checks `forwarderState.owner == registry.forwarder_program` and that the
signer is `find_pda(["forwarder", forwarderState, programId], forwarderProgramId)`, so a
registry initialised for one forwarder rejects reports relayed by the other.

Derived addresses (program `5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ`):

- registry PDA `8MPfyf4eXcTHVfDr5fbunFGTCJPF5yT2MUHhuzXZMrzg`
- forwarder authority (mock forwarder) `4soexVbUSmtQ4CGsMFehE9AF1EPptu4svnD9swqMkKNv`
- forwarder authority (DON forwarder) `CoLFRJpTyoUm14Q4CC97QcGYLLcB2cCf56po5yA7UvvQ`
- verdict PDA for `1008350041`: `8DWP4JrmoYBoQQSo7k9HUL5PaDg4fLFJpAVnQqAabMpo`

## On-chain prerequisites for a successful write

1. The AirSpace program is deployed at `5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ`
   (until then the forwarder fails with Anchor error 2007 `ConstraintExecutable`).
2. `initialize_registry` was called with `forwarder_program` = the forwarder the target uses (table above).
3. `open_verdict(bbl)` was called so the Verdict PDA exists (the forwarder CPI cannot pay rent).
4. `CRE_SOLANA_PRIVATE_KEY` holds devnet SOL (it pays the simulate `--broadcast` fee).

## Verdict logic

- `unusedSqft = max(residfar, commfar, facilfar) × lotarea − bldgarea`, floored at 0.
- Base estimate = `unusedSqft × $/sqft` (Manhattan core 350, Manhattan 250, Brooklyn 180,
  Queens 120, Bronx 90, Staten Island 70), then adjusted by the LLM's `valueAdjustmentPct`
  clamped to ±20 %.
- Flags: `LANDMARK=1`, `HISTORIC_DISTRICT=2`, `NO_UNUSED_FAR=4`, `DATA_MISMATCH=8`,
  `LOW_CONFIDENCE=16` (< 7000 bps), `SPECIAL_DISTRICT=32`, `OWNER_MISMATCH=64`.
- Status: `NO_UNUSED_FAR` or `DATA_MISMATCH` → Deny (2); `LOW_CONFIDENCE` or the model does
  not say `allow` → Review (3); otherwise Allow (1).
- `report_hash = sha256(canonical audit JSON)` where the canonical JSON is
  `{"recommendation","confidence","flags":{"dataMismatch","ownerMismatch"},"valueAdjustmentPct","reasoning"}`
  in that key order; the handler result echoes that `audit` object so the hash can be re-derived.

Handler result (HTTP trigger):

```json
{ "bbl", "status", "confidenceBps", "flags", "unusedSqft", "estValueUsd",
  "txSignature", "explorerUrl", "verdictPda", "reportHash", "audit", "parcel" }
```

The cron handler returns `{ "processed", "results": [ …same shape, or { "bbl", "error" } ] }`.

## Confidentiality path

Both handlers are registered with `cre.handlerInTee(trigger, fn, {})` and receive a
`TeeRuntime`. Inside the enclave the workflow fetches PLUTO, resolves the
`ANTHROPIC_API_KEY` secret with `runtime.getSecret(...)` (released by the Vault DON only
into an attested enclave), calls the Anthropic Messages API through
`HTTPClient.sendRequest(teeRuntime, …)`, and computes the verdict. It then crosses back
with `runtime.usingTheDons()` and only the derived verdict (status, confidence, flags,
unused sqft, estimate, report hash) is used for the signed report and the Solana write.

This TEE + HTTP-trigger combination simulates fine with CRE CLI v1.37.0 / SDK 1.18.0
(the simulator prints its "Handler requested TEE Execution" notice), so the fallbacks
(`ConfidentialHTTPClient` in a plain handler, or `HTTPClient` + `runtime.getSecret` +
`consensusIdenticalAggregation`) were not needed. Enclave `runtime.log` lines are for
simulation only and should be removed before a production deployment. Live TEE
deployment requires Confidential Workflows private-beta access.

## Sample parcels

| Payload | BBL | Expected |
|---|---|---|
| `payloads/esb.json` | 1008350041 (Empire State Building) | Deny — PLUTO shows 2.8M sqft built on a 15 FAR × 91k sqft lot: no unused FAR (flags 37 = LANDMARK + NO_UNUSED_FAR + SPECIAL_DISTRICT) |
| `payloads/west59.json` | 1011310016 (405 W 59th St) | Allow — ~136k unused sqft at FAR 10 |

The mock LLM returns `allow` (confidence 0.91) unless the prompt contains `"unusedSqft":0`,
in which case it returns `deny` (0.95).

## Deploying to a DON (later)

```bash
cre secrets create ./airspace-verifier --target production-settings   # uploads ANTHROPIC_API_KEY to the Vault DON
cre workflow deploy ./airspace-verifier --target production-settings
```

Requires CRE early access, a linked funded wallet, and (for the TEE handlers)
Confidential Workflows access.
