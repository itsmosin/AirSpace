//! Seeds, fixed program ids and enum-like constants shared across instructions.

use anchor_lang::prelude::*;

// PDA seeds
pub const REGISTRY_SEED: &[u8] = b"registry";
pub const VERDICT_SEED: &[u8] = b"verdict";
pub const PARCEL_SEED: &[u8] = b"parcel";
pub const LISTING_SEED: &[u8] = b"listing";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const OWNER_NONCE_SEED: &[u8] = b"owner-nonce";

// String bounds (also used by `#[max_len]` on account structs)
pub const BBL_LEN: usize = 10;
pub const MAX_ADDRESS_LEN: usize = 96;
pub const MAX_ZONING_LEN: usize = 16;
pub const MAX_ASSET_NAME_LEN: usize = 96;
pub const MAX_ASSET_URI_LEN: usize = 200;

// External programs
pub const SAS_PROGRAM_ID: Pubkey = pubkey!("22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG");
pub const PYTH_RECEIVER_ID: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

/// Pyth SOL/USD feed id (0xef0d...b56d).
pub const SOL_USD_FEED_ID: [u8; 32] = [
    0xef, 0x0d, 0x8b, 0x6f, 0xda, 0x2c, 0xeb, 0xa4,
    0x1d, 0xa1, 0x5d, 0x40, 0x95, 0xd1, 0xda, 0x39,
    0x2a, 0x0d, 0x2f, 0x8e, 0xd0, 0xc6, 0xc7, 0xbc,
    0x0f, 0x4c, 0xfa, 0xc8, 0xc2, 0x80, 0xb5, 0x6d,
];

// Marketplace economics
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const ROYALTY_BPS: u16 = 500;
pub const LAMPORTS_PER_SOL_U128: u128 = 1_000_000_000;

// Verdict.status
pub const VERDICT_PENDING: u8 = 0;
pub const VERDICT_ALLOW: u8 = 1;
pub const VERDICT_DENY: u8 = 2;
pub const VERDICT_REVIEW: u8 = 3;

// Verdict.source
pub const SOURCE_MANUAL: u8 = 0;
pub const SOURCE_CRE: u8 = 1;

// Parcel.status
pub const PARCEL_MINTED: u8 = 0;
pub const PARCEL_LISTED: u8 = 1;
