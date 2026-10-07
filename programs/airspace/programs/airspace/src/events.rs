use anchor_lang::prelude::*;

#[event]
pub struct VerdictRecorded {
    pub bbl: String,
    pub status: u8,
    pub source: u8,
    pub confidence_bps: u16,
    pub flags: u32,
    pub unused_sqft: u64,
    pub est_value_usd: u64,
}

#[event]
pub struct ParcelMinted {
    pub bbl: String,
    pub asset: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct ParcelListed {
    pub bbl: String,
    pub asset: Pubkey,
    pub seller: Pubkey,
    pub price_usd_cents: u64,
}

#[event]
pub struct ListingCancelled {
    pub bbl: String,
    pub asset: Pubkey,
}

#[event]
pub struct ParcelSold {
    pub bbl: String,
    pub asset: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub price_usd_cents: u64,
    pub lamports_paid: u64,
    pub sol_usd_price_e8: u64,
}
