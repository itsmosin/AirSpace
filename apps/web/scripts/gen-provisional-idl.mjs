// Generates src/idl/airspace.provisional.json from docs/INTERFACES.md section 1.
// Discriminators follow Anchor 0.30+: sha256("global:<ix>")[0..8], sha256("account:<Name>")[0..8], sha256("event:<Name>")[0..8].
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const disc = (ns, name) => [...createHash('sha256').update(`${ns}:${name}`).digest().subarray(0, 8)];
const bytes = (s) => [...Buffer.from(s, 'utf8')];

const PROGRAM_ID = '5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ';
const MPL_CORE = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
const SYSTEM = '11111111111111111111111111111111';

const acc = (name, o = {}) => ({ name, ...o });
const pda = (seeds, program) => ({ seeds, ...(program ? { program } : {}) });
const seedConst = (s) => ({ kind: 'const', value: bytes(s) });
const seedArg = (path) => ({ kind: 'arg', path });
const seedAccount = (path, account) => ({ kind: 'account', path, ...(account ? { account } : {}) });

const registryPda = pda([seedConst('registry')]);
const escrowPda = pda([seedConst('escrow')]);

const instructions = [
  {
    name: 'initialize_registry',
    accounts: [
      acc('admin', { writable: true, signer: true }),
      acc('registry', { writable: true, pda: registryPda }),
      acc('system_program', { address: SYSTEM }),
    ],
    args: [
      { name: 'registrar', type: 'pubkey' },
      { name: 'treasury', type: 'pubkey' },
      { name: 'forwarder_program', type: 'pubkey' },
      { name: 'fee_bps', type: 'u16' },
      { name: 'max_price_age_secs', type: 'u32' },
    ],
  },
  {
    name: 'set_attestation_config',
    accounts: [acc('admin', { signer: true }), acc('registry', { writable: true, pda: registryPda })],
    args: [
      { name: 'owner_credential', type: 'pubkey' },
      { name: 'owner_schema', type: 'pubkey' },
      { name: 'kyc_credential', type: 'pubkey' },
      { name: 'kyc_schema', type: 'pubkey' },
    ],
  },
  {
    name: 'create_collection',
    accounts: [
      acc('admin', { writable: true, signer: true }),
      acc('registry', { writable: true, pda: registryPda }),
      acc('collection', { writable: true, signer: true }),
      acc('mpl_core_program', { address: MPL_CORE }),
      acc('system_program', { address: SYSTEM }),
    ],
    args: [
      { name: 'name', type: 'string' },
      { name: 'uri', type: 'string' },
    ],
  },
  {
    name: 'open_verdict',
    accounts: [
      acc('payer', { writable: true, signer: true }),
      acc('verdict', { writable: true, pda: pda([seedConst('verdict'), seedArg('bbl')]) }),
      acc('system_program', { address: SYSTEM }),
      acc('parcel', { pda: pda([seedConst('parcel'), seedArg('bbl')]) }),
    ],
    args: [{ name: 'bbl', type: 'string' }],
  },
  {
    name: 'set_forwarder',
    accounts: [acc('admin', { signer: true }), acc('registry', { writable: true, pda: registryPda })],
    args: [{ name: 'forwarder_program', type: 'pubkey' }],
  },
  {
    name: 'on_report',
    accounts: [
      acc('state'),
      acc('forwarder_authority', { signer: true }),
      acc('registry', { pda: registryPda }),
      acc('verdict', { writable: true }),
    ],
    args: [
      { name: '_metadata', type: 'bytes' },
      { name: 'report', type: 'bytes' },
    ],
  },
  {
    name: 'record_verdict_manual',
    accounts: [acc('registrar', { signer: true }), acc('registry', { pda: registryPda }), acc('verdict', { writable: true })],
    args: [
      { name: 'status', type: 'u8' },
      { name: 'confidence_bps', type: 'u16' },
      { name: 'flags', type: 'u32' },
      { name: 'unused_sqft', type: 'u64' },
      { name: 'est_value_usd', type: 'u64' },
      { name: 'report_hash', type: { array: ['u8', 32] } },
    ],
  },
  {
    name: 'mint_parcel',
    accounts: [
      acc('owner', { writable: true, signer: true }),
      acc('registry', { writable: true, pda: registryPda }),
      acc('verdict'),
      acc('owner_attestation'),
      acc('parcel', { writable: true, pda: pda([seedConst('parcel'), seedAccount('verdict.bbl', 'Verdict')]) }),
      acc('asset', { writable: true, signer: true }),
      acc('collection', { writable: true }),
      acc('mpl_core_program', { address: MPL_CORE }),
      acc('system_program', { address: SYSTEM }),
    ],
    args: [{ name: 'args', type: { defined: { name: 'MintParcelArgs' } } }],
  },
  {
    name: 'list_parcel',
    accounts: [
      acc('seller', { writable: true, signer: true }),
      acc('registry', { pda: registryPda }),
      acc('parcel', { writable: true }),
      acc('listing', { writable: true, pda: pda([seedConst('listing'), seedAccount('parcel')]) }),
      acc('asset', { writable: true }),
      acc('collection', { writable: true }),
      acc('escrow', { pda: escrowPda }),
      acc('mpl_core_program', { address: MPL_CORE }),
      acc('system_program', { address: SYSTEM }),
    ],
    args: [{ name: 'price_usd_cents', type: 'u64' }],
  },
  {
    name: 'cancel_listing',
    accounts: [
      acc('seller', { writable: true, signer: true }),
      acc('parcel', { writable: true }),
      acc('listing', { writable: true, pda: pda([seedConst('listing'), seedAccount('parcel')]) }),
      acc('asset', { writable: true }),
      acc('collection', { writable: true }),
      acc('escrow', { pda: escrowPda }),
      acc('mpl_core_program', { address: MPL_CORE }),
      acc('system_program', { address: SYSTEM }),
    ],
    args: [],
  },
  {
    name: 'buy_parcel',
    accounts: [
      acc('buyer', { writable: true, signer: true }),
      acc('registry', { pda: registryPda }),
      acc('parcel', { writable: true }),
      acc('listing', { writable: true, pda: pda([seedConst('listing'), seedAccount('parcel')]) }),
      acc('seller', { writable: true }),
      acc('treasury', { writable: true }),
      acc('buyer_attestation'),
      acc('price_update'),
      acc('asset', { writable: true }),
      acc('collection', { writable: true }),
      acc('escrow', { pda: escrowPda }),
      acc('mpl_core_program', { address: MPL_CORE }),
      acc('system_program', { address: SYSTEM }),
    ],
    args: [],
  },
].map((ix) => ({ ...ix, discriminator: disc('global', ix.name) }));

const struct = (fields) => ({ kind: 'struct', fields });
const f = (name, type) => ({ name, type });
const types = [
  {
    name: 'Registry',
    type: struct([
      f('admin', 'pubkey'), f('registrar', 'pubkey'), f('treasury', 'pubkey'), f('forwarder_program', 'pubkey'),
      f('collection', 'pubkey'), f('owner_credential', 'pubkey'), f('owner_schema', 'pubkey'),
      f('kyc_credential', 'pubkey'), f('kyc_schema', 'pubkey'), f('fee_bps', 'u16'), f('max_price_age_secs', 'u32'),
      f('parcel_count', 'u64'), f('bump', 'u8'),
    ]),
  },
  {
    name: 'Verdict',
    type: struct([
      f('bbl', 'string'), f('status', 'u8'), f('confidence_bps', 'u16'), f('flags', 'u32'), f('unused_sqft', 'u64'),
      f('est_value_usd', 'u64'), f('report_hash', { array: ['u8', 32] }), f('source', 'u8'), f('requester', 'pubkey'),
      f('requested_at', 'i64'), f('recorded_at', 'i64'), f('bump', 'u8'),
    ]),
  },
  {
    name: 'Parcel',
    type: struct([
      f('bbl', 'string'), f('owner', 'pubkey'), f('core_asset', 'pubkey'), f('address', 'string'), f('borough', 'u8'),
      f('lat_e6', 'i32'), f('lng_e6', 'i32'), f('lot_area_sqft', 'u32'), f('built_area_sqft', 'u32'), f('max_far_bps', 'u32'),
      f('unused_sqft', 'u64'), f('est_value_usd', 'u64'), f('zoning', 'string'), f('verdict_hash', { array: ['u8', 32] }),
      f('status', 'u8'), f('minted_at', 'i64'), f('bump', 'u8'),
    ]),
  },
  {
    name: 'Listing',
    type: struct([f('parcel', 'pubkey'), f('seller', 'pubkey'), f('price_usd_cents', 'u64'), f('created_at', 'i64'), f('bump', 'u8')]),
  },
  {
    name: 'MintParcelArgs',
    type: struct([
      f('address', 'string'), f('borough', 'u8'), f('lat_e6', 'i32'), f('lng_e6', 'i32'), f('lot_area_sqft', 'u32'),
      f('built_area_sqft', 'u32'), f('max_far_bps', 'u32'), f('zoning', 'string'), f('name', 'string'), f('uri', 'string'),
    ]),
  },
  {
    name: 'VerdictRecorded',
    type: struct([
      f('bbl', 'string'), f('status', 'u8'), f('source', 'u8'), f('confidence_bps', 'u16'), f('flags', 'u32'),
      f('unused_sqft', 'u64'), f('est_value_usd', 'u64'),
    ]),
  },
  { name: 'ParcelMinted', type: struct([f('bbl', 'string'), f('asset', 'pubkey'), f('owner', 'pubkey')]) },
  { name: 'ParcelListed', type: struct([f('bbl', 'string'), f('asset', 'pubkey'), f('seller', 'pubkey'), f('price_usd_cents', 'u64')]) },
  { name: 'ListingCancelled', type: struct([f('bbl', 'string'), f('asset', 'pubkey')]) },
  {
    name: 'ParcelSold',
    type: struct([
      f('bbl', 'string'), f('asset', 'pubkey'), f('buyer', 'pubkey'), f('seller', 'pubkey'), f('price_usd_cents', 'u64'),
      f('lamports_paid', 'u64'), f('sol_usd_price_e8', 'u64'),
    ]),
  },
];

const accounts = ['Registry', 'Verdict', 'Parcel', 'Listing'].map((name) => ({ name, discriminator: disc('account', name) }));
const events = ['VerdictRecorded', 'ParcelMinted', 'ParcelListed', 'ListingCancelled', 'ParcelSold'].map((name) => ({ name, discriminator: disc('event', name) }));
const errorNames = [
  'Unauthorized', 'VerdictNotAllowed', 'VerdictLocked', 'BblMismatch', 'InvalidAttestation', 'AttestationExpired',
  'InvalidForwarderProgram', 'InvalidForwarderAuthority', 'InvalidReportPayload', 'InvalidPriceAccount', 'StalePrice',
  'WrongFeed', 'ParcelNotListed', 'ParcelAlreadyListed', 'MathOverflow', 'InvalidArgs',
];
const errorMsgs = {
  Unauthorized: 'Signer is not authorized for this action',
  VerdictNotAllowed: 'Verdict status is not Allow',
  VerdictLocked: 'Verdict is locked because a parcel was already minted',
  BblMismatch: 'BBL in report does not match verdict',
  InvalidAttestation: 'Attestation account is invalid',
  AttestationExpired: 'Attestation has expired',
  InvalidForwarderProgram: 'Forwarder program mismatch',
  InvalidForwarderAuthority: 'Forwarder authority mismatch',
  InvalidReportPayload: 'Report payload could not be decoded',
  InvalidPriceAccount: 'Price account is invalid',
  StalePrice: 'Price is stale',
  WrongFeed: 'Wrong price feed',
  ParcelNotListed: 'Parcel is not listed',
  ParcelAlreadyListed: 'Parcel is already listed',
  MathOverflow: 'Arithmetic overflow',
  InvalidArgs: 'Invalid arguments',
};
const errors = errorNames.map((name, i) => ({ code: 6000 + i, name, msg: errorMsgs[name] }));

const idl = {
  address: PROGRAM_ID,
  metadata: { name: 'airspace', version: '0.1.0', spec: '0.1.0', description: 'AirSpace: verified NYC air-rights marketplace (provisional IDL generated from docs/INTERFACES.md)' },
  instructions,
  accounts,
  events,
  errors,
  types,
};

writeFileSync(join(here, '..', 'src', 'idl', 'airspace.provisional.json'), JSON.stringify(idl, null, 2) + '\n');
console.log('wrote src/idl/airspace.provisional.json', { instructions: instructions.length, types: types.length });
