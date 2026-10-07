//! Manual parsing of a Pyth `PriceUpdateV2` account (pyth-solana-receiver).
//!
//! ```text
//! [0..8]   anchor discriminator (ignored)
//! [8..40]  write_authority
//! [40]     verification_level tag: 0 = Partial { num_signatures: u8 at [41] }, 1 = Full
//! then     PriceFeedMessage: feed_id [32], price i64, conf u64, exponent i32,
//!          publish_time i64, prev_publish_time i64, ema_price i64, ema_conf u64
//! then     posted_slot u64
//! ```

use anchor_lang::prelude::*;

use crate::constants::{LAMPORTS_PER_SOL_U128, PYTH_RECEIVER_ID, SOL_USD_FEED_ID};
use crate::errors::AirspaceError;

const HEADER_LEN: usize = 8 + 32;
const MESSAGE_LEN: usize = 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
const MAX_ABS_EXPONENT: i32 = 18;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PriceView {
    pub feed_id: [u8; 32],
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
    pub prev_publish_time: i64,
    pub ema_price: i64,
    pub ema_conf: u64,
    pub posted_slot: u64,
}

fn le_i64(buf: &[u8], off: usize) -> i64 {
    i64::from_le_bytes(buf[off..off + 8].try_into().unwrap())
}

fn le_u64(buf: &[u8], off: usize) -> u64 {
    u64::from_le_bytes(buf[off..off + 8].try_into().unwrap())
}

pub fn parse_price_update(buf: &[u8]) -> Result<PriceView> {
    let tag = *buf
        .get(HEADER_LEN)
        .ok_or(AirspaceError::InvalidPriceAccount)?;
    let msg_start = match tag {
        0 => HEADER_LEN + 2, // Partial { num_signatures }
        1 => HEADER_LEN + 1, // Full
        _ => return err!(AirspaceError::InvalidPriceAccount),
    };
    let msg = buf
        .get(msg_start..msg_start + MESSAGE_LEN)
        .ok_or(AirspaceError::InvalidPriceAccount)?;

    let feed_id: [u8; 32] = msg[0..32].try_into().unwrap();
    let price = le_i64(msg, 32);
    let conf = le_u64(msg, 40);
    let exponent = i32::from_le_bytes(msg[48..52].try_into().unwrap());
    let publish_time = le_i64(msg, 52);
    let prev_publish_time = le_i64(msg, 60);
    let ema_price = le_i64(msg, 68);
    let ema_conf = le_u64(msg, 76);

    let slot_off = msg_start + MESSAGE_LEN;
    let slot_bytes = buf
        .get(slot_off..slot_off + 8)
        .ok_or(AirspaceError::InvalidPriceAccount)?;
    let posted_slot = u64::from_le_bytes(slot_bytes.try_into().unwrap());

    Ok(PriceView {
        feed_id,
        price,
        conf,
        exponent,
        publish_time,
        prev_publish_time,
        ema_price,
        ema_conf,
        posted_slot,
    })
}

/// Feed, sign and staleness checks.
pub fn validate_price(view: &PriceView, now: i64, max_age_secs: u32) -> Result<()> {
    require!(view.feed_id == SOL_USD_FEED_ID, AirspaceError::WrongFeed);
    require!(view.price > 0, AirspaceError::InvalidPriceAccount);
    require!(
        view.exponent.abs() <= MAX_ABS_EXPONENT,
        AirspaceError::InvalidPriceAccount
    );
    let age = now
        .checked_sub(view.publish_time)
        .ok_or(AirspaceError::MathOverflow)?;
    require!(age <= max_age_secs as i64, AirspaceError::StalePrice);
    Ok(())
}

fn pow10(exp: u32) -> Result<u128> {
    10u128
        .checked_pow(exp)
        .ok_or_else(|| error!(AirspaceError::MathOverflow))
}

/// `lamports = price_usd_cents * 10^9 * 10^(-exponent) / (100 * price)` in u128.
pub fn usd_cents_to_lamports(price_usd_cents: u64, price: i64, exponent: i32) -> Result<u64> {
    require!(price > 0, AirspaceError::InvalidPriceAccount);
    require!(
        exponent.abs() <= MAX_ABS_EXPONENT,
        AirspaceError::InvalidPriceAccount
    );
    let cents = price_usd_cents as u128;
    let price = price as u128;
    let base_num = cents
        .checked_mul(LAMPORTS_PER_SOL_U128)
        .ok_or(AirspaceError::MathOverflow)?;
    let base_den = price.checked_mul(100).ok_or(AirspaceError::MathOverflow)?;
    let (num, den) = if exponent <= 0 {
        let scale = pow10(exponent.unsigned_abs())?;
        (
            base_num.checked_mul(scale).ok_or(AirspaceError::MathOverflow)?,
            base_den,
        )
    } else {
        let scale = pow10(exponent as u32)?;
        (
            base_num,
            base_den.checked_mul(scale).ok_or(AirspaceError::MathOverflow)?,
        )
    };
    let lamports = num / den;
    u64::try_from(lamports).map_err(|_| error!(AirspaceError::MathOverflow))
}

/// Normalize `price * 10^exponent` to 8 decimals (USD * 1e8).
pub fn price_to_e8(price: i64, exponent: i32) -> Result<u64> {
    require!(price > 0, AirspaceError::InvalidPriceAccount);
    require!(
        exponent.abs() <= MAX_ABS_EXPONENT,
        AirspaceError::InvalidPriceAccount
    );
    let p = price as u128;
    let shift = exponent + 8;
    let e8 = if shift >= 0 {
        p.checked_mul(pow10(shift as u32)?)
            .ok_or(AirspaceError::MathOverflow)?
    } else {
        p / pow10(shift.unsigned_abs())?
    };
    u64::try_from(e8).map_err(|_| error!(AirspaceError::MathOverflow))
}

/// Full account-level verification used by `buy_parcel`.
pub fn verify_price_account(info: &AccountInfo, now: i64, max_age_secs: u32) -> Result<PriceView> {
    require_keys_eq!(
        *info.owner,
        PYTH_RECEIVER_ID,
        AirspaceError::InvalidPriceAccount
    );
    let data = info.try_borrow_data()?;
    let view = parse_price_update(&data)?;
    validate_price(&view, now, max_age_secs)?;
    Ok(view)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRICE: i64 = 11_853_821_127; // $118.53821127 at exponent -8
    const PUBLISH: i64 = 1_791_354_367;

    fn encode(full: bool, feed: [u8; 32], price: i64, exponent: i32, publish_time: i64) -> Vec<u8> {
        let mut buf = vec![0u8; 8];
        buf.extend_from_slice(&[9u8; 32]); // write_authority
        if full {
            buf.push(1);
        } else {
            buf.push(0);
            buf.push(5); // num_signatures
        }
        buf.extend_from_slice(&feed);
        buf.extend_from_slice(&price.to_le_bytes());
        buf.extend_from_slice(&2_178_873u64.to_le_bytes());
        buf.extend_from_slice(&exponent.to_le_bytes());
        buf.extend_from_slice(&publish_time.to_le_bytes());
        buf.extend_from_slice(&(publish_time - 1).to_le_bytes());
        buf.extend_from_slice(&(price - 10).to_le_bytes());
        buf.extend_from_slice(&1u64.to_le_bytes());
        buf.extend_from_slice(&508_363_566u64.to_le_bytes());
        if full {
            buf.push(0); // account is sized for the larger Partial variant
        }
        buf
    }

    #[test]
    fn parses_full_and_partial_variants() {
        for full in [true, false] {
            let buf = encode(full, SOL_USD_FEED_ID, PRICE, -8, PUBLISH);
            let v = parse_price_update(&buf).unwrap();
            assert_eq!(v.feed_id, SOL_USD_FEED_ID);
            assert_eq!(v.price, PRICE);
            assert_eq!(v.conf, 2_178_873);
            assert_eq!(v.exponent, -8);
            assert_eq!(v.publish_time, PUBLISH);
            assert_eq!(v.prev_publish_time, PUBLISH - 1);
            assert_eq!(v.ema_price, PRICE - 10);
            assert_eq!(v.ema_conf, 1);
            assert_eq!(v.posted_slot, 508_363_566);
        }
    }

    #[test]
    fn rejects_bad_tag_and_short_buffers() {
        let mut buf = encode(true, SOL_USD_FEED_ID, PRICE, -8, PUBLISH);
        buf[40] = 2;
        assert!(parse_price_update(&buf).is_err());
        let buf = encode(true, SOL_USD_FEED_ID, PRICE, -8, PUBLISH);
        for cut in [0usize, 40, 41, 100, 132] {
            assert!(parse_price_update(&buf[..cut]).is_err(), "cut {cut}");
        }
    }

    #[test]
    fn validation_paths() {
        let ok = parse_price_update(&encode(true, SOL_USD_FEED_ID, PRICE, -8, PUBLISH)).unwrap();
        assert!(validate_price(&ok, PUBLISH + 100, 3600).is_ok());
        // publish time slightly in the future is fine
        assert!(validate_price(&ok, PUBLISH - 5, 3600).is_ok());
        assert_eq!(
            validate_price(&ok, PUBLISH + 3601, 3600).unwrap_err(),
            AirspaceError::StalePrice.into()
        );
        let wrong = parse_price_update(&encode(true, [1u8; 32], PRICE, -8, PUBLISH)).unwrap();
        assert_eq!(
            validate_price(&wrong, PUBLISH, 3600).unwrap_err(),
            AirspaceError::WrongFeed.into()
        );
        let neg = parse_price_update(&encode(true, SOL_USD_FEED_ID, -5, -8, PUBLISH)).unwrap();
        assert_eq!(
            validate_price(&neg, PUBLISH, 3600).unwrap_err(),
            AirspaceError::InvalidPriceAccount.into()
        );
        let zero = parse_price_update(&encode(true, SOL_USD_FEED_ID, 0, -8, PUBLISH)).unwrap();
        assert!(validate_price(&zero, PUBLISH, 3600).is_err());
    }

    #[test]
    fn lamport_math_matches_formula() {
        // $1.00 at $118.53821127/SOL = 10^17 / 11853821127 = 8436098.9 lamports
        assert_eq!(usd_cents_to_lamports(100, PRICE, -8).unwrap(), 8_436_098);
        // $250,000.00
        let expected = (25_000_000u128 * 1_000_000_000 * 100_000_000) / (100 * PRICE as u128);
        assert_eq!(usd_cents_to_lamports(25_000_000, PRICE, -8).unwrap(), expected as u64);
        // $100 at exactly $100/SOL (price 100, exponent 0) -> 1 SOL
        assert_eq!(usd_cents_to_lamports(10_000, 100, 0).unwrap(), 1_000_000_000);
        // positive exponent: price 1 * 10^2 = $100/SOL
        assert_eq!(usd_cents_to_lamports(10_000, 1, 2).unwrap(), 1_000_000_000);
        assert!(usd_cents_to_lamports(100, 0, -8).is_err());
        assert!(usd_cents_to_lamports(100, PRICE, -40).is_err());
    }

    #[test]
    fn price_normalizes_to_e8() {
        assert_eq!(price_to_e8(PRICE, -8).unwrap(), PRICE as u64);
        assert_eq!(price_to_e8(118, 0).unwrap(), 11_800_000_000);
        assert_eq!(price_to_e8(1_185_382_112_700, -10).unwrap(), 11_853_821_127);
        assert!(price_to_e8(0, -8).is_err());
    }
}
