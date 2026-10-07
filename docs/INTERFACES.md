# AirSpace — Interface Contract (single source of truth for program, CRE workflow, web, scripts)

Everything below is binding. If you must deviate, update this file in the same change.

## 0. Fixed identifiers

| Thing | Value |
|---|---|
| Cluster | Solana **devnet** (`https://api.devnet.solana.com`) |
| AirSpace program ID | `5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ` (keypair `keys/airspace-program-keypair.json`) |
| Deployer / admin wallet | `8qxj2favgzZBpZrnUdDf17woAyfWhqrLC89bmMcRAjid` (`~/.config/solana/airspace-deployer.json`) |
| Registrar wallet (SAS issuer + manual verdicts + verify-request payer) | `ExgRPqMrP59Zo27oFziZi2dP9RAU7BdRrazDUQreCjG8` (`keys/registrar-keypair.json`) |
| Metaplex Core program | `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d` |
| Solana Attestation Service (SAS) program | `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG` |
| Pyth receiver program | `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` |
| Pyth SOL/USD price update account (devnet, sponsored) | `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` |
| Pyth SOL/USD feed id | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| Chainlink keystone forwarder program (devnet) | `CXsKEJcs25TQEYU2e5jZ8QTPE3ffMLZhH6BWHrdcCCB5` |
| Chainlink keystone forwarder state (devnet) | `8QoomCQyPSkJ8WopJbX9B4HyvrFzziwvJdU8hZE6DCr9` |
| CRE chain selector name | `solana-devnet` |
| NYC PLUTO API | `https://data.cityofnewyork.us/resource/64uk-42ks.json?bbl=<10 digits>` (returns `bbl` as `"1008350041.00000000"`, strip decimals) |

**BBL** = NYC Borough-Block-Lot, always a **10-character ASCII digit string** (`"1008350041"`). It is the universal key across chain, CRE, web.

## 1. Program `airspace` (Anchor 0.32.1, Rust)

### PDAs (all under the AirSpace program)
| Account | Seeds |
|---|---|
| `Registry` | `[b"registry"]` |
| `Verdict` | `[b"verdict", bbl.as_bytes()]` |
| `Parcel` | `[b"parcel", bbl.as_bytes()]` |
| `Listing` | `[b"listing", parcel_pubkey]` |
| `escrow` authority (no data) | `[b"escrow"]` |
| owner-attestation nonce (no data, just a pubkey) | `[b"owner-nonce", wallet_pubkey, bbl.as_bytes()]` |

### Account structs (Borsh via Anchor `#[account]`, 8-byte discriminator)
```rust
pub struct Registry {
    pub admin: Pubkey,
    pub registrar: Pubkey,          // may call record_verdict_manual; pays open_verdict from web
    pub treasury: Pubkey,
    pub forwarder_program: Pubkey,  // Chainlink keystone forwarder program id
    pub collection: Pubkey,         // Metaplex Core collection (set by create_collection)
    pub owner_credential: Pubkey,   // SAS credential pubkey
    pub owner_schema: Pubkey,       // SAS schema "airspace_owner_v1"
    pub kyc_credential: Pubkey,
    pub kyc_schema: Pubkey,         // SAS schema "airspace_kyc_v1"
    pub fee_bps: u16,               // marketplace fee on sale, e.g. 100 = 1%
    pub max_price_age_secs: u32,    // Pyth staleness tolerance (devnet: 3600)
    pub parcel_count: u64,
    pub bump: u8,
}
pub struct Verdict {
    pub bbl: String,                // max_len 10
    pub status: u8,                 // 0 Pending, 1 Allow, 2 Deny, 3 Review
    pub confidence_bps: u16,        // 0..10000
    pub flags: u32,                 // bitmask, see §4
    pub unused_sqft: u64,
    pub est_value_usd: u64,         // whole dollars
    pub report_hash: [u8; 32],      // sha256 of the LLM JSON report
    pub source: u8,                 // 0 Manual(registrar), 1 CRE(forwarder)
    pub requester: Pubkey,
    pub requested_at: i64,
    pub recorded_at: i64,
    pub bump: u8,
}
pub struct Parcel {
    pub bbl: String,                // max_len 10
    pub owner: Pubkey,
    pub core_asset: Pubkey,
    pub address: String,            // max_len 96
    pub borough: u8,                // 1 MN, 2 BX, 3 BK, 4 QN, 5 SI
    pub lat_e6: i32,
    pub lng_e6: i32,
    pub lot_area_sqft: u32,
    pub built_area_sqft: u32,
    pub max_far_bps: u32,           // FAR * 10000 (15.0 → 150000)
    pub unused_sqft: u64,           // copied from Verdict at mint
    pub est_value_usd: u64,         // copied from Verdict at mint
    pub zoning: String,             // max_len 16
    pub verdict_hash: [u8; 32],
    pub status: u8,                 // 0 Minted, 1 Listed
    pub minted_at: i64,
    pub bump: u8,
}
pub struct Listing {
    pub parcel: Pubkey,
    pub seller: Pubkey,
    pub price_usd_cents: u64,
    pub created_at: i64,
    pub bump: u8,
}
```

### Instructions (names and arg order are binding; Anchor snake_case on-chain, camelCase in TS)
| # | Instruction | Signer | Args | Accounts (in order) | Effect |
|---|---|---|---|---|---|
| 1 | `initialize_registry` | admin | `registrar: Pubkey, treasury: Pubkey, forwarder_program: Pubkey, fee_bps: u16, max_price_age_secs: u32` | `admin(mut,signer)`, `registry(init)`, `system_program` | creates Registry |
| 2 | `set_attestation_config` | admin | `owner_credential, owner_schema, kyc_credential, kyc_schema: Pubkey` | `admin(signer)`, `registry(mut)` | stores SAS keys |
| 3 | `create_collection` | admin | `name: String, uri: String` | `admin(mut,signer)`, `registry(mut)`, `collection(mut,signer: fresh keypair)`, `mpl_core_program`, `system_program` | Core `CreateCollectionV2`, update authority = registry PDA; stores `registry.collection` |
| 4 | `open_verdict` | any (web uses registrar) | `bbl: String` | `payer(mut,signer)`, `verdict(init_if_needed)`, `system_program` | status=Pending, requester=payer, requested_at=now; **safe to call again** (resets to Pending unless status==Allow and a Parcel exists → error `VerdictLocked`) |
| 5 | `on_report` | forwarder PDA | `_metadata: Vec<u8>, report: Vec<u8>` | `state(unchecked)`, `forwarder_authority(signer)`, `registry`, `verdict(mut)` | verifies `state.owner == registry.forwarder_program` and `forwarder_authority == find_pda([b"forwarder", state, program_id], forwarder_program)`; Borsh-decodes `VerdictReport` (§3); requires `report.bbl == verdict.bbl`; writes fields, source=1, recorded_at=now; emits `VerdictRecorded` |
| 6 | `record_verdict_manual` | registrar | same fields as `VerdictReport` flattened: `status: u8, confidence_bps: u16, flags: u32, unused_sqft: u64, est_value_usd: u64, report_hash: [u8;32]` | `registrar(signer)`, `registry`, `verdict(mut)` | source=0; fallback/demo path |
| 7 | `mint_parcel` | owner | `MintParcelArgs { address: String, borough: u8, lat_e6: i32, lng_e6: i32, lot_area_sqft: u32, built_area_sqft: u32, max_far_bps: u32, zoning: String, name: String, uri: String }` | `owner(mut,signer)`, `registry(mut)`, `verdict` (status==Allow, bbl from verdict), `owner_attestation(unchecked, SAS check §5)`, `parcel(init, seeds [b"parcel", verdict.bbl])`, `asset(mut,signer: fresh keypair)`, `collection(mut, = registry.collection)`, `mpl_core_program`, `system_program` | Core `CreateV2` into collection (authority = registry PDA signs) with **Attributes plugin** (§6) and **Royalties 5% → treasury**; creates Parcel; `registry.parcel_count += 1`; emits `ParcelMinted` |
| 8 | `list_parcel` | owner | `price_usd_cents: u64` (> 0) | `seller(mut,signer)`, `registry`, `parcel(mut)`, `listing(init)`, `asset(mut)`, `collection(mut)`, `escrow(PDA, unchecked)`, `mpl_core_program`, `system_program` | Core `TransferV1` asset → escrow PDA (authority = seller); parcel.status=1; emits `ParcelListed` |
| 9 | `cancel_listing` | seller | — | `seller(mut,signer)`, `parcel(mut)`, `listing(mut, close=seller)`, `asset(mut)`, `collection(mut)`, `escrow`, `mpl_core_program`, `system_program` | `TransferV1` escrow → seller (escrow PDA signs); parcel.status=0; emits `ListingCancelled` |
| 10 | `buy_parcel` | buyer | — | `buyer(mut,signer)`, `registry`, `parcel(mut)`, `listing(mut, close=seller)`, `seller(mut)`, `treasury(mut, = registry.treasury)`, `buyer_attestation(unchecked, SAS KYC check §5)`, `price_update(unchecked, owner == Pyth receiver)`, `asset(mut)`, `collection(mut)`, `escrow`, `mpl_core_program`, `system_program` | Pyth parse (§7) → `lamports`; fee = lamports*fee_bps/10000 → treasury, rest → seller (system transfer from buyer); `TransferV1` escrow → buyer; parcel.owner=buyer, status=0; emits `ParcelSold { bbl, asset, buyer, seller, price_usd_cents, lamports_paid, sol_usd_price_e8 }` |

Errors (names binding): `Unauthorized, VerdictNotAllowed, VerdictLocked, BblMismatch, InvalidAttestation, AttestationExpired, InvalidForwarderProgram, InvalidForwarderAuthority, InvalidReportPayload, InvalidPriceAccount, StalePrice, WrongFeed, ParcelNotListed, ParcelAlreadyListed, MathOverflow, InvalidArgs`.

Events: `VerdictRecorded{bbl,status,source,confidence_bps,flags,unused_sqft,est_value_usd}`, `ParcelMinted{bbl,asset,owner}`, `ParcelListed{bbl,asset,seller,price_usd_cents}`, `ListingCancelled{bbl,asset}`, `ParcelSold{...}`.

## 2. CRE → Solana write path
CRE workflow calls `SolanaClient.writeReport` with `receiver = AirSpace program id` and remaining accounts **exactly**:
```
[0] forwarderState  (8QoomCQ…, writable)
[1] forwarderAuthority = findProgramAddressSync([utf8("forwarder"), forwarderState, airspaceProgramId], forwarderProgramId)
[2] registry PDA (readonly)
[3] verdict PDA for bbl (writable)
```
The forwarder strips [0],[1] and CPIs `on_report(metadata, report)` with `[state, forwarder_authority(signer), registry, verdict]`. The Verdict account **must already exist** (web calls `open_verdict` before triggering CRE, because the forwarder CPI cannot pay rent).

## 3. `VerdictReport` payload (Borsh, byte-exact on both sides)
```
struct VerdictReport {
  bbl: String,            // u32 LE length + utf8
  status: u8,             // 1 Allow, 2 Deny, 3 Review
  confidence_bps: u16,    // LE
  flags: u32,             // LE
  unused_sqft: u64,       // LE
  est_value_usd: u64,     // LE, whole dollars
  report_hash: [u8; 32],  // sha256 of canonical LLM JSON
}
```
TS codec: `getStructCodec([['bbl', addCodecSizePrefix(getUtf8Codec(), getU32Codec())], ['status', getU8Codec()], ['confidenceBps', getU16Codec()], ['flags', getU32Codec()], ['unusedSqft', getU64Codec()], ['estValueUsd', getU64Codec()], ['reportHash', fixCodecSize(getBytesCodec(), 32)]])`.

Anchor instruction discriminator for `on_report` = first 8 bytes of `sha256("global:on_report")` = `[214, 173, 18, 221, 173, 148, 151, 208]` (same as the kv_store template, same name).

## 4. Verdict flags bitmask
| bit | name | meaning |
|---|---|---|
| 1 | `LANDMARK` | PLUTO `landmark` non-empty |
| 2 | `HISTORIC_DISTRICT` | PLUTO `histdist` non-empty |
| 4 | `NO_UNUSED_FAR` | computed unused sqft ≤ 0 |
| 8 | `DATA_MISMATCH` | LLM found the submitted numbers inconsistent with PLUTO |
| 16 | `LOW_CONFIDENCE` | confidence < 7000 bps |
| 32 | `SPECIAL_DISTRICT` | PLUTO `spdist1` non-empty |
| 64 | `OWNER_MISMATCH` | submitted owner name clearly ≠ PLUTO `ownername` (informational) |
Verdict rule (both CRE and manual): `NO_UNUSED_FAR` or `DATA_MISMATCH` → Deny; `LOW_CONFIDENCE` or LLM says review → Review; else Allow. Landmark/historic/special are warnings, not blockers.

Unused sqft = `max(residfar, commfar, facilfar) * lotarea - bldgarea`, floored at 0. `est_value_usd` = unused_sqft × $/sqft comparables table (Manhattan core 350, Manhattan other 250, Brooklyn 180, Queens 120, Bronx 90, Staten Island 70) adjusted ±20% by LLM.

## 5. SAS attestation checks inside the program (manual byte parsing; SAS has no Anchor CPI crate)
Attestation account layout (owner must be SAS program):
```
[0]      discriminator u8 (= 2 for Attestation)  — do NOT hard-fail on value; check owner + PDA instead
[1..33]  nonce: Pubkey
[33..65] credential: Pubkey
[65..97] schema: Pubkey
[97..101] data_len: u32 LE
[101..101+len] data
then signer: Pubkey (32), expiry: i64 LE (8), token_account: Pubkey (32)
```
Checks:
- `attestation.owner == SAS_PROGRAM`
- PDA: `attestation.key == find_pda([b"attestation", credential, schema, nonce], SAS_PROGRAM)`
- `credential == registry.{owner|kyc}_credential`, `schema == registry.{owner|kyc}_schema`
- `expiry == 0 || expiry > clock.unix_timestamp` else `AttestationExpired`
- Owner attestation: `nonce == find_pda([b"owner-nonce", owner.key, bbl], AIRSPACE_PROGRAM)` and `data == borsh String(bbl)` (u32 len + bytes) → `InvalidAttestation` otherwise
- KYC attestation: `nonce == buyer.key` and `data[0] >= 1` (level u8)

SAS schemas (created by scripts, stored in Registry via `set_attestation_config`):
- Credential name `"AirSpace Registrar"`, authority = registrar, authorized_signers = [registrar]
- Schema `airspace_owner_v1`: layout `[String]`, field names `["bbl"]`, version 1
- Schema `airspace_kyc_v1`: layout `[U8]`, field names `["level"]`, version 1
- Attestation expiry = now + 365 days

## 6. Core Attributes plugin keys (strings) on each parcel asset
`bbl, address, borough, zoning, lot_area_sqft, built_area_sqft, max_far, unused_sqft, est_value_usd, verdict_hash (hex), lat, lng, verified_by ("Chainlink CRE" | "AirSpace Registrar")`. Asset name = `args.name` (e.g. "Air Rights · 350 Fifth Ave"), uri = `args.uri` (JSON metadata; web hosts at `/api/metadata/<bbl>`).

## 7. Pyth PriceUpdateV2 parsing in `buy_parcel`
```
[0..8]   anchor discriminator (ignore)
[8..40]  write_authority
[40]     verification_level tag: 0 = Partial{num_signatures: u8 at [41]}, 1 = Full
then PriceFeedMessage: feed_id [32], price i64, conf u64, exponent i32, publish_time i64, prev_publish_time i64, ema_price i64, ema_conf u64
then posted_slot u64
```
Require `owner == PYTH_RECEIVER`, `feed_id == SOL_USD_FEED`, `price > 0`, `now - publish_time <= registry.max_price_age_secs`. 
`lamports = price_usd_cents * 10^9 * 10^(-exponent) / (100 * price)` computed in u128 (exponent is negative, e.g. -8).

## 8. CRE workflow (TypeScript, `cre/airspace-verifier/`)
- Handler A: **HTTP trigger**, payload JSON `{ "bbl": "1008350041", "submitted": { "address"?: string, "ownerName"?: string, "lotAreaSqft"?: number, "builtAreaSqft"?: number } }`.
- Handler B: **cron** every 5 min → `GET {webBaseUrl}/api/verify/pending` → `{ pending: [{ bbl }] }` → process up to 2.
- Pipeline per bbl: HTTP GET PLUTO → compute (§4) → LLM audit (Anthropic Messages API, model `claude-sonnet-5`, secret id `ANTHROPIC_API_KEY`, structured JSON `{ "recommendation": "allow|deny|review", "confidence": 0..1, "flags": { "dataMismatch": bool, "ownerMismatch": bool }, "valueAdjustmentPct": -20..20, "reasoning": string }`) → sha256 → `VerdictReport` → Solana write (§2) → return `{ bbl, status, confidenceBps, flags, unusedSqft, estValueUsd, txSignature, explorerUrl }`.
- LLM call runs confidentially: prefer `cre.handlerInTee` + `TeeRuntime` HTTPClient (then `usingTheDons()` for report + write); fall back to `ConfidentialHTTPClient` in a plain handler if TEE + HTTP trigger does not simulate.
- `cre/mock-llm/server.js` replicates the Anthropic response shape for offline runs (`config.llmUrl` switches).
- Simulate: `cd cre && cre workflow simulate ./airspace-verifier --target staging-settings --non-interactive --trigger-index 0 --http-payload ./payloads/west59.json [--broadcast]`.

## 9. Web ↔ chain ↔ CRE API (Next.js route handlers, `apps/web`)
| Route | Method | Body / Query | Returns |
|---|---|---|---|
| `/api/pluto` | GET | `?bbl=` or `?lat=&lng=` (nearest lot) or `?address=` (Mapbox geocode → nearest) | normalized `PlutoLot` (§10) |
| `/api/kyc` | POST | `{ wallet, level }` | issues SAS KYC attestation (registrar signs) → `{ attestation, txSignature }` |
| `/api/attest-owner` | POST | `{ wallet, bbl, docHash? }` | issues owner attestation (mock title check) → `{ attestation, txSignature }` |
| `/api/verify` | POST | `{ bbl, wallet, submitted? }` | `open_verdict` (registrar pays) then spawns `cre workflow simulate … --broadcast` → `{ jobId, bbl, status: "queued" }` |
| `/api/verify/[bbl]` | GET | — | `{ job: {id,status:"queued"|"running"|"done"|"failed", log?, txSignature?}, verdict: on-chain Verdict | null }` |
| `/api/verify/pending` | GET | — | `{ pending: [{ bbl }] }` (verdict accounts with status Pending older than 30 s and no running job) |
| `/api/metadata/[bbl]` | GET | — | Core asset JSON metadata |
| `/api/parcels` | GET | — | all Parcel + Listing accounts decoded (server-side RPC, cached 15 s) |
Job store: `apps/web/.data/jobs.json` (simple file store). Server env: `REGISTRAR_KEYPAIR_PATH`, `SOLANA_RPC_URL`, `CRE_DIR` (abs path to `cre/`), `CRE_BIN` (`~/.cre/bin/cre`), `MAPBOX_TOKEN` (server) + `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_PROGRAM_ID`, `NEXT_PUBLIC_RPC_URL`.

## 10. Shared TS types (`packages/shared/src/types.ts`)
```ts
export type PlutoLot = { bbl: string; address: string; borough: 'MN'|'BX'|'BK'|'QN'|'SI'; zipcode: string;
  lotAreaSqft: number; builtAreaSqft: number; residFar: number; commFar: number; facilFar: number; maxFar: number;
  zoning: string; specialDistrict: string; numFloors: number; landmark: string; historicDistrict: string;
  ownerName: string; yearBuilt: number; lat: number; lng: number; unusedSqft: number; estValueUsd: number };
export type VerdictStatus = 0|1|2|3; // Pending, Allow, Deny, Review
export const FLAGS = { LANDMARK:1, HISTORIC_DISTRICT:2, NO_UNUSED_FAR:4, DATA_MISMATCH:8, LOW_CONFIDENCE:16, SPECIAL_DISTRICT:32, OWNER_MISMATCH:64 } as const;
export const BOROUGH_CODE = { MN:1, BX:2, BK:3, QN:4, SI:5 } as const;
export const PRICE_PER_SQFT = { MN_CORE:350, MN:250, BK:180, QN:120, BX:90, SI:70 } as const; // MN_CORE = zip 100xx with lat>40.70 && lat<40.80
```

## 11. Repo layout
```
airspace-origin/
  docs/INTERFACES.md            (this file)
  keys/                         (gitignored keypairs)
  programs/airspace/            Anchor workspace (Anchor.toml at this level), tests/, target/idl/airspace.json
  packages/shared/              types + constants (TS, no deps)
  packages/sas/                 SAS helpers: createCredential, createSchema, issueOwnerAttestation, issueKycAttestation, deriveAttestationPda, ownerNoncePda
  scripts/                      setup-sas.ts, init-registry.ts, seed-devnet.ts, manual-verdict.ts
  cre/                          project.yaml, secrets.yaml, .env.example, airspace-verifier/, mock-llm/, payloads/, bindings/AirspaceReceiver.ts
  apps/web/                     Next.js 15 app
```
Package manager: **bun** workspaces at repo root (`package.json` with `"workspaces": ["apps/*","packages/*","scripts","cre/airspace-verifier","cre/mock-llm"]`). Program IDL is copied to `packages/shared/idl/airspace.json` after `anchor build`.
