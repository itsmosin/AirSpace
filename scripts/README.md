# @airspace/scripts

Operational scripts for the AirSpace devnet deployment. Run from the repo root with bun:

```sh
export PATH="$HOME/.bun/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
bun install
bun scripts/<name>.ts [flags]
```

Defaults (override with env vars): RPC `SOLANA_RPC_URL` (devnet), registrar keypair
`REGISTRAR_KEYPAIR_PATH` (`keys/registrar-keypair.json`), deployer/admin keypair
`DEPLOYER_KEYPAIR_PATH` (`~/.config/solana/airspace-deployer.json`), SAS config
`SAS_CONFIG_PATH` (`keys/sas-config.json`). The program IDL is read from
`packages/shared/idl/airspace.json` (produced by `bun run program:build`).

## Order of operations

1. `setup-sas.ts` — once per registrar; no program needed.
2. `verify-sas.ts` — optional round-trip check of the SAS deployment.
3. Program deployed + `initialize_registry` + `create_collection` (program side).
4. `set-attestation-config.ts` — stores the SAS keys in the Registry.
5. `manual-verdict.ts` / `seed-devnet.ts` — demo data.

## Scripts

### `setup-sas.ts`
Creates the `"AirSpace Registrar"` credential and the `airspace_owner_v1` / `airspace_kyc_v1`
schemas with the registrar as authority and authorized signer. Idempotent: existing accounts
are skipped. Reads every account back, checks authority/signers/layout/field names/version,
writes `keys/sas-config.json` and prints explorer links.

Pays with the registrar wallet (about 0.004 SOL for all three accounts).

### `verify-sas.ts [--wallet <pubkey>] [--bbl <bbl>]`
Issues a KYC attestation and an owner attestation for the wallet (default: deployer,
BBL `1008350041`), fetches both back with `fetchAttestation` and asserts the data bytes
(`[1]` and `u32le(10) + "1008350041"`), nonces, credential/schema, signer, expiry and that
`deriveAttestationPda` reproduces the on-chain address. Re-running reports `already existed`.

### `set-attestation-config.ts`
Calls `set_attestation_config(owner_credential, owner_schema, kyc_credential, kyc_schema)`
with the deployer as admin, using the credential for both `*_credential` fields. Verifies
the Registry afterwards. Needs the IDL and an initialized Registry.

### `manual-verdict.ts --bbl <bbl> --status allow|deny|review [--dry-run]`
Registrar fallback for the CRE path. Fetches the PLUTO row, runs `normalizePluto`
(unused sqft = max FAR × lot area − built area, floored at 0; value from the $/sqft table),
computes the §4 flags (`LANDMARK`, `HISTORIC_DISTRICT`, `NO_UNUSED_FAR`, `SPECIAL_DISTRICT`),
prints what the rule alone would decide, then sends `open_verdict` (idempotent; a locked
Allow+Parcel verdict is reported and skipped) followed by `record_verdict_manual` with
`status` from the flag, `confidence_bps = 10000`, and `report_hash = sha256(JSON.stringify(plutoRow))`.
`--dry-run` stops after the math.

### `seed-devnet.ts [--bbls a,b,c] [--dry-run] [--no-list]`
For each BBL: PLUTO → manual verdict **Allow** → owner attestation for the deployer →
`mint_parcel` (deployer as owner, fresh asset keypair, name `Air Rights · <address>`,
uri `https://airspace-nyc.vercel.app/api/metadata/<bbl>`) → `list_parcel` at
`est_value_usd` (in cents). Skips a BBL whose Parcel already exists; mints but does not list
when `est_value_usd` is 0. `--dry-run` runs the PLUTO fetch and all math without sending.

Default BBLs (all Manhattan, all resolve in PLUTO and carry unused FAR):

| BBL | Address | Unused sqft | Est. value |
|---|---|---|---|
| `1008300001` | 816 Avenue of the Americas | 5,190 | $1.8M |
| `1000160001` | 22 Battery Place (landmark warning flag) | 802,268 | $280.8M |
| `1008090069` | 144 West 34th Street | 221,205 | $77.4M |
| `1005650021` | 842 Broadway | 246,015 | $86.1M |
| `1007150059` | 442 West 18th Street | 178,030 | $62.3M |

Towers such as `1008350041` (350 Fifth Ave), `1012950001` (101 Park Ave) and `1013010001`
(245 Park Ave) are built past today's FAR, so the formula yields 0 unused sqft: the rule
says Deny and a $0 listing is rejected by `list_parcel`. Pass them with `--bbls` if you
want them minted anyway (verdict is forced to Allow; listing is skipped).

## Layout

```
scripts/
  lib/env.ts          paths, keypairs, RPC, explorer links, arg parsing
  lib/program.ts      Anchor Program loader, AirSpace PDAs, typed account accessor
  lib/verdict.ts      PLUTO fetch, §4 verdict math, open_verdict + record_verdict_manual
  lib/sas-inspect.ts  Credential / Schema account parsers (verification output)
```
