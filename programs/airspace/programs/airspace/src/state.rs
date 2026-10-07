use anchor_lang::prelude::*;

use crate::constants::{BBL_LEN, MAX_ADDRESS_LEN, MAX_ZONING_LEN};

#[account]
#[derive(InitSpace)]
pub struct Registry {
    pub admin: Pubkey,
    /// May call `record_verdict_manual`; pays `open_verdict` from the web app.
    pub registrar: Pubkey,
    pub treasury: Pubkey,
    /// Chainlink keystone forwarder program id allowed to CPI `on_report`.
    pub forwarder_program: Pubkey,
    /// Metaplex Core collection (set by `create_collection`).
    pub collection: Pubkey,
    /// SAS credential pubkey for owner attestations.
    pub owner_credential: Pubkey,
    /// SAS schema "airspace_owner_v1".
    pub owner_schema: Pubkey,
    pub kyc_credential: Pubkey,
    /// SAS schema "airspace_kyc_v1".
    pub kyc_schema: Pubkey,
    /// Marketplace fee on sale, e.g. 100 = 1%.
    pub fee_bps: u16,
    /// Pyth staleness tolerance in seconds.
    pub max_price_age_secs: u32,
    pub parcel_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Verdict {
    #[max_len(BBL_LEN)]
    pub bbl: String,
    /// 0 Pending, 1 Allow, 2 Deny, 3 Review
    pub status: u8,
    /// 0..10000
    pub confidence_bps: u16,
    /// Bitmask, see docs/INTERFACES.md section 4.
    pub flags: u32,
    pub unused_sqft: u64,
    /// Whole dollars.
    pub est_value_usd: u64,
    /// sha256 of the LLM JSON report.
    pub report_hash: [u8; 32],
    /// 0 Manual (registrar), 1 CRE (forwarder)
    pub source: u8,
    pub requester: Pubkey,
    pub requested_at: i64,
    pub recorded_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Parcel {
    #[max_len(BBL_LEN)]
    pub bbl: String,
    pub owner: Pubkey,
    pub core_asset: Pubkey,
    #[max_len(MAX_ADDRESS_LEN)]
    pub address: String,
    /// 1 MN, 2 BX, 3 BK, 4 QN, 5 SI
    pub borough: u8,
    pub lat_e6: i32,
    pub lng_e6: i32,
    pub lot_area_sqft: u32,
    pub built_area_sqft: u32,
    /// FAR * 10000 (15.0 -> 150000)
    pub max_far_bps: u32,
    /// Copied from Verdict at mint.
    pub unused_sqft: u64,
    /// Copied from Verdict at mint.
    pub est_value_usd: u64,
    #[max_len(MAX_ZONING_LEN)]
    pub zoning: String,
    pub verdict_hash: [u8; 32],
    /// 0 Minted, 1 Listed
    pub status: u8,
    pub minted_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub parcel: Pubkey,
    pub seller: Pubkey,
    pub price_usd_cents: u64,
    pub created_at: i64,
    pub bump: u8,
}

/// Borsh payload written by the CRE workflow and delivered through the
/// keystone forwarder (`on_report`). Byte layout is fixed in docs/INTERFACES.md section 3.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct VerdictReport {
    pub bbl: String,
    pub status: u8,
    pub confidence_bps: u16,
    pub flags: u32,
    pub unused_sqft: u64,
    pub est_value_usd: u64,
    pub report_hash: [u8; 32],
}

/// Arguments for `mint_parcel`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct MintParcelArgs {
    pub address: String,
    pub borough: u8,
    pub lat_e6: i32,
    pub lng_e6: i32,
    pub lot_area_sqft: u32,
    pub built_area_sqft: u32,
    pub max_far_bps: u32,
    pub zoning: String,
    pub name: String,
    pub uri: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verdict_report_decodes_byte_exact_layout() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&10u32.to_le_bytes());
        buf.extend_from_slice(b"1008350041");
        buf.push(1); // Allow
        buf.extend_from_slice(&9100u16.to_le_bytes());
        buf.extend_from_slice(&(1u32 | 32).to_le_bytes());
        buf.extend_from_slice(&1_234_567u64.to_le_bytes());
        buf.extend_from_slice(&432_098_450u64.to_le_bytes());
        buf.extend_from_slice(&[7u8; 32]);

        let report = VerdictReport::deserialize(&mut buf.as_slice()).unwrap();
        assert_eq!(report.bbl, "1008350041");
        assert_eq!(report.status, 1);
        assert_eq!(report.confidence_bps, 9100);
        assert_eq!(report.flags, 33);
        assert_eq!(report.unused_sqft, 1_234_567);
        assert_eq!(report.est_value_usd, 432_098_450);
        assert_eq!(report.report_hash, [7u8; 32]);
        assert_eq!(report.try_to_vec().unwrap(), buf);
    }

    #[test]
    fn verdict_report_rejects_truncated_payload() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&10u32.to_le_bytes());
        buf.extend_from_slice(b"1008350041");
        buf.push(1);
        assert!(VerdictReport::deserialize(&mut buf.as_slice()).is_err());
    }
}
