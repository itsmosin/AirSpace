# AirSpace program - devnet deployment record

Anchor 0.32.1 program `airspace`, deployed to Solana devnet on 2026-10-07.

## Addresses

| Thing | Value |
|---|---|
| Program id | `5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ` |
| Deploy tx | [4LnMz9JMMuYFaaZYcWMJNJXzYpJ6fCmYpVwe48oNmzLYB28jMrYDfkSqikiiWdZ1e4YvqNGjNcpbVs45S9apDubK](https://explorer.solana.com/tx/4LnMz9JMMuYFaaZYcWMJNJXzYpJ6fCmYpVwe48oNmzLYB28jMrYDfkSqikiiWdZ1e4YvqNGjNcpbVs45S9apDubK?cluster=devnet) |
| ProgramData | `DcEgEChhk8nMgLtxyK81vLqoqx37Hmffg412KV2ygbPx` (402,384 bytes, slot 508371020) |
| Upgrade authority / admin | `8qxj2favgzZBpZrnUdDf17woAyfWhqrLC89bmMcRAjid` |
| On-chain IDL account | `5wYYM9HyuonJSsud2V7Nf2ek8E3Eo5QxDgvpqzxK4MpE` |
| Registry PDA (`["registry"]`) | `8MPfyf4eXcTHVfDr5fbunFGTCJPF5yT2MUHhuzXZMrzg` |
| Escrow PDA (`["escrow"]`) | `HttmJrTxc2XQaWNqMVRkmajpisSuZTmcerBVe8qXYqZH` |
| Core collection ("AirSpace NYC Air Rights") | `ERWJ6d345HjKVGpT89gUmNGwmcmZeWjR97FeXWnXHc6L` |
| `initialize_registry` tx | [Y7eKCdhtmobQKkf9SKGeNZshxqWNvCHvnWRXRn1sV4GmZE9CM5Y3xBZT1cjojA7ENmEsg1FwbANaeucC2PrChcz](https://explorer.solana.com/tx/Y7eKCdhtmobQKkf9SKGeNZshxqWNvCHvnWRXRn1sV4GmZE9CM5Y3xBZT1cjojA7ENmEsg1FwbANaeucC2PrChcz?cluster=devnet) |
| `create_collection` tx | [gKCRBsU64CEttQcmAXimN7eLWPGX9qpEFXFdq3hehkeqEKbrPu8JNVQYADLdSLVQU6KACdy4xCtdT5nvtQu14tg](https://explorer.solana.com/tx/gKCRBsU64CEttQcmAXimN7eLWPGX9qpEFXFdq3hehkeqEKbrPu8JNVQYADLdSLVQU6KACdy4xCtdT5nvtQu14tg?cluster=devnet) |

Registry state after init:

| Field | Value |
|---|---|
| registrar | `ExgRPqMrP59Zo27oFziZi2dP9RAU7BdRrazDUQreCjG8` |
| treasury | `8qxj2favgzZBpZrnUdDf17woAyfWhqrLC89bmMcRAjid` |
| forwarder_program | `7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK` (CRE simulator mock forwarder; state `5Tipz3yhTBdVsDbaBxZkrp7Gjf3brGq5SKkxReefPMP7`) |
| forwarder authority PDA for `on_report` (mock) | `4soexVbUSmtQ4CGsMFehE9AF1EPptu4svnD9swqMkKNv` |
| forwarder authority PDA (production `CXsKEJcs…`, state `8QoomCQ…`) | `CoLFRJpTyoUm14Q4CC97QcGYLLcB2cCf56po5yA7UvvQ` |
| fee_bps | 100 |
| max_price_age_secs | 3600 |
| owner/kyc credential + schema | unset (set by `scripts/setup-sas.ts` via `set_attestation_config`) |

Deployer balance: 4.700 SOL before deploy, 2.617 SOL after deploy, 2.613 SOL after registry + collection init.

Switching to the production DON forwarder later: `set_forwarder(CXsKEJcs25TQEYU2e5jZ8QTPE3ffMLZhH6BWHrdcCCB5)` signed by the admin (no redeploy).

## Build / test / deploy

```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.bun/bin:$PATH"
cd programs/airspace
bun install
anchor build            # platform-tools v1.52 is pinned in programs/airspace/Cargo.toml
cargo test --lib --manifest-path programs/airspace/Cargo.toml   # host unit tests (sas, pyth, codec, helpers)
anchor test             # local validator cloning Core, SAS, Pyth receiver + SOL/USD feed, forwarder state from devnet
anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/airspace-deployer.json
bun run scripts/init-devnet.ts   # idempotent: initialize_registry, set_forwarder, create_collection
cp target/idl/airspace.json ../../packages/shared/idl/airspace.json
cp target/types/airspace.ts ../../packages/shared/idl/airspace.ts
```

Toolchain notes:
- `mpl-core = { version = "0.12.1", default-features = false, features = ["anchor-0-32"] }`. The `anchor-0-32` feature resolves against anchor-lang 0.32.1 (both use solana-program 2.x types), so the generated `CreateCollectionV2CpiBuilder`, `CreateV2CpiBuilder` and `TransferV1CpiBuilder` are used directly. `default-features = false` is required because `kaigan`'s `anchor` and `borsh-v1` features are mutually exclusive.
- The dependency graph (solana-pubkey 4.x, wincode, hashbrown 0.17, ...) needs rustc >= 1.89, while the Solana 3.0.0 release bundles platform-tools v1.51 (rustc 1.84). `[package.metadata.solana] tools-version = "v1.52"` makes `cargo build-sbf` fetch Rust 1.89 tooling automatically.
- `cargo build-sbf` reports a stack-offset warning in `mpl_core::hooked::plugin::registry_records_to_plugin_list`. That helper is only used when deserializing Core accounts; this program never calls it (CPI builders and plain types only).
- Agave 3.0's `solana-test-validator` panics on the default `0.0.0.0` bind address, hence `bind_address = "127.0.0.1"` in `[test.validator]`.
- Tests use `max_price_age_secs = 10_000_000` because the cloned Pyth account is frozen at clone time.

## `anchor test` summary

```
  airspace
    ✔ initializes the registry (468ms)
    ✔ rejects set_attestation_config from a non-admin
    ✔ set_forwarder is admin-only and updates the registry (939ms)
    ✔ creates the SAS credential and schemas, then stores the attestation config (941ms)
    ✔ creates the Core collection with the registry PDA as update authority (473ms)
    ✔ opens a verdict (registrar pays) (472ms)
    ✔ rejects a malformed bbl
    ✔ issues SAS owner attestations (seller for the BBL, plus a decoy for the buyer) (941ms)
    ✔ refuses to mint while the verdict is Pending
    ✔ rejects record_verdict_manual from a non-registrar
    ✔ records a Deny verdict and refuses to mint (464ms)
    ✔ records an Allow verdict (manual, source = registrar) (472ms)
    ✔ refuses to mint without a valid owner attestation
    ✔ mints the parcel as a Core asset in the collection (460ms)
    ✔ locks the verdict once a parcel exists
    ✔ re-opening an unminted verdict resets it to Pending (1393ms)
    ✔ lists the parcel (asset moves to escrow) (477ms)
    ✔ rejects cancel_listing from a non-seller
    ✔ cancels the listing (asset returns to seller, listing closed) (466ms)
    ✔ rejects a zero price and relists the parcel (475ms)
    ✔ refuses a purchase without a KYC attestation
    ✔ issues the KYC attestation for the buyer (452ms)
      SOL/USD 118.86761005 -> $100 = 0.841272066 SOL (fee 0.00841272 SOL)
    ✔ buys the parcel with Pyth-priced SOL settlement (473ms)
    ✔ refuses to buy a parcel that is no longer listed
    ✔ rejects on_report from anyone but the keystone forwarder

  25 passing (10s)
```

The SAS credential, both schemas and the attestations in the test are real accounts created through the cloned SAS program with `@solana/attestation` 2.1.0 instruction encoders (sent over web3.js). The purchase test asserts the seller and treasury lamport deltas against the Pyth formula from INTERFACES.md section 7.

Host unit tests (`cargo test --lib`): 16 passing, covering SAS parsing (truncation, overflowing `data_len`, owner/PDA/credential/schema/expiry mismatches, owner-payload and KYC-payload accept/reject), Pyth parsing (Full and Partial variants, bad tag, short buffers, feed/sign/staleness checks, lamport math for negative/zero/positive exponents, e8 normalization), the byte-exact `VerdictReport` codec, and attribute formatting.

## Deviations from docs/INTERFACES.md

1. **`open_verdict` has one extra trailing account**: `parcel` (unchecked, `seeds = ["parcel", bbl]`). The spec's `VerdictLocked` rule needs to know whether a Parcel exists, which is impossible without that account. Anchor clients resolve it automatically from the IDL (seeds derive from the `bbl` argument), so `program.methods.openVerdict(bbl).accounts({ payer })` keeps working; only hand-built instructions must append it. Account order is `payer, verdict, system_program, parcel`.
2. **Extra admin instruction `set_forwarder(forwarder_program: Pubkey)`** (accounts `admin` signer, `registry` mut). Added at the coordinator's request so devnet can run against the CRE simulator mock forwarder and switch to the production forwarder without redeploying. The forwarder PDA derivation (`["forwarder", state, program_id]` under `registry.forwarder_program`) is unchanged.
3. **Devnet `forwarder_program` is the mock forwarder** `7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK`, not `CXsKEJcs…` as in section 0 (same coordinator request). CRE remaining accounts for section 2 must therefore use the mock forwarder state `5Tipz3yhTBdVsDbaBxZkrp7Gjf3brGq5SKkxReefPMP7` and authority `4soexVbUSmtQ4CGsMFehE9AF1EPptu4svnD9swqMkKNv` until `set_forwarder` is called.
4. Core attribute values (section 6): `borough` is the two-letter code (`MN`/`BX`/`BK`/`QN`/`SI`), `max_far` is rendered with two decimals (`15.00`), `lat`/`lng` with six (`40.748400`), `verdict_hash` as 64 lowercase hex chars. Keys are exactly as listed.
5. Extra argument validation beyond the spec: `fee_bps <= 10000`, `max_price_age_secs > 0`, verdict `status` in 1..=3 and `confidence_bps <= 10000` (`InvalidReportPayload` for CRE, `InvalidArgs` for manual), bbl must be 10 ASCII digits, `borough` in 1..=5, `address <= 96`, `zoning <= 16`, asset `name <= 96`, `uri <= 200` bytes. `create_collection` may be re-run by the admin (overwrites `registry.collection`).
6. `on_report` decodes the `VerdictReport` leniently (trailing bytes after the struct are ignored, like the kv_store receiver pattern); everything else about the payload is byte-exact.
7. `Anchor.toml` additionally clones the production forwarder state `8QoomCQyPSkJ8WopJbX9B4HyvrFzziwvJdU8hZE6DCr9` so the `InvalidForwarderAuthority` path (right state owner, wrong signer) is covered in tests.
