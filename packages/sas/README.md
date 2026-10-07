# @airspace/sas

Solana Attestation Service (SAS) helpers for the AirSpace registrar. The SAS program
(`22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`) has no Anchor IDL, so this package
encodes its instructions by hand and parses its accounts byte-by-byte, using
`@solana/web3.js` v1 `PublicKey` / `Keypair` types so the web app, scripts and tests
can all share it.

## What the registrar issues

| Thing | Value |
|---|---|
| Credential | `"AirSpace Registrar"` — authority = registrar, authorized signers = [registrar] |
| Schema `airspace_owner_v1` (v1) | layout `[12]` (String), fields `["bbl"]` — data = Borsh `String(bbl)` = u32 LE length + utf8 |
| Schema `airspace_kyc_v1` (v1) | layout `[0]` (U8), fields `["level"]` — data = `[level]`, 1 = verified |
| Expiry | now + 365 days by default (`expiryTs` overrides; `0` = never) |

Nonces: owner attestations use `ownerNoncePda(AIRSPACE_PROGRAM, wallet, bbl)`
(seeds `["owner-nonce", wallet, bbl]` under the AirSpace program); KYC attestations use
the wallet pubkey itself. Both are what the on-chain `airspace` program re-derives when
it checks `mint_parcel` / `buy_parcel`.

## API

```ts
import {
  CREDENTIAL_NAME, OWNER_SCHEMA, KYC_SCHEMA,
  deriveCredentialPda, deriveSchemaPda, deriveAttestationPda, ownerNoncePda,
  setupRegistrarSas, issueOwnerAttestation, issueKycAttestation,
  fetchAttestation, loadSasConfig,
  type SasContext, type SasConfig,
} from '@airspace/sas';

const ctx: SasContext = { rpcUrl, registrar /* Keypair */ };
const cfg: SasConfig = loadSasConfig('keys/sas-config.json'); // { credential, ownerSchema, kycSchema }

await setupRegistrarSas(ctx);                                        // idempotent; returns cfg + txs sent
await issueKycAttestation(ctx, cfg, { wallet });                     // { attestation, txSignature, alreadyExisted }
await issueOwnerAttestation(ctx, cfg, { wallet, bbl: '1008350041' });
const a = await fetchAttestation(rpcUrl, attestationPubkey);        // null when the account does not exist
// a = { nonce, credential, schema, data: Uint8Array, signer, expiry: bigint }
```

All issue/setup calls are idempotent: if the target PDA already exists nothing is sent and
`alreadyExisted` is `true` (`txSignature` is then `''`). Transient devnet failures (expired
blockhash, rate limits) are retried up to three times; the account's existence is the
source of truth, so a retry never double-creates.

`loadSasConfig` reads the filesystem through `process.getBuiltinModule('node:fs')`, so the
module has no static `node:` import and the PDA helpers remain usable in browser bundles.

## SAS wire formats used

| | |
|---|---|
| Instruction tags (u8) | `0` create_credential, `1` create_schema, `6` create_attestation |
| Account discriminators (u8) | `0` Credential, `1` Schema, `2` Attestation |
| `SchemaDataTypes` | `U8 = 0`, `String = 12` |
| PDAs | `["credential", authority, name]`, `["schema", credential, name, [version]]`, `["attestation", credential, schema, nonce]` |
| Attestation layout | `[0]` disc, `[1..33]` nonce, `[33..65]` credential, `[65..97]` schema, `[97..101]` data_len u32 LE, data, signer (32), expiry i64 LE, token_account (32) |

`create_schema` always creates version 1; the schema constants pin `version: 1`.

## Devnet deployment

Created by `scripts/setup-sas.ts`; the addresses live in `keys/sas-config.json` (gitignored).
Run `bun scripts/verify-sas.ts` for an end-to-end round-trip check.
