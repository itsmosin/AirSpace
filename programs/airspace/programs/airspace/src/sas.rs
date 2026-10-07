//! Manual parsing and verification of Solana Attestation Service (SAS) accounts.
//!
//! SAS ships no Anchor CPI crate, so the attestation account is read byte-by-byte:
//!
//! ```text
//! [0]        discriminator u8 (2 = Attestation) -- not enforced; owner + PDA are
//! [1..33]    nonce: Pubkey
//! [33..65]   credential: Pubkey
//! [65..97]   schema: Pubkey
//! [97..101]  data_len: u32 LE
//! [101..]    data (data_len bytes)
//! then       signer: Pubkey (32), expiry: i64 LE (8), token_account: Pubkey (32)
//! ```

use anchor_lang::prelude::*;

use crate::constants::{OWNER_NONCE_SEED, SAS_PROGRAM_ID};
use crate::errors::AirspaceError;
use crate::state::Registry;

pub const ATTESTATION_SEED: &[u8] = b"attestation";

const NONCE_OFFSET: usize = 1;
const CREDENTIAL_OFFSET: usize = 33;
const SCHEMA_OFFSET: usize = 65;
const DATA_LEN_OFFSET: usize = 97;
const DATA_OFFSET: usize = 101;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttestationView<'a> {
    pub nonce: Pubkey,
    pub credential: Pubkey,
    pub schema: Pubkey,
    pub data: &'a [u8],
    pub signer: Pubkey,
    pub expiry: i64,
    pub token_account: Pubkey,
}

fn read_pubkey(buf: &[u8], offset: usize) -> Result<Pubkey> {
    let end = offset
        .checked_add(32)
        .ok_or(AirspaceError::InvalidAttestation)?;
    let bytes = buf
        .get(offset..end)
        .ok_or(AirspaceError::InvalidAttestation)?;
    let arr: [u8; 32] = bytes
        .try_into()
        .map_err(|_| AirspaceError::InvalidAttestation)?;
    Ok(Pubkey::new_from_array(arr))
}

/// Parse the raw account data of an SAS `Attestation`.
pub fn parse_attestation(buf: &[u8]) -> Result<AttestationView<'_>> {
    let nonce = read_pubkey(buf, NONCE_OFFSET)?;
    let credential = read_pubkey(buf, CREDENTIAL_OFFSET)?;
    let schema = read_pubkey(buf, SCHEMA_OFFSET)?;

    let len_bytes = buf
        .get(DATA_LEN_OFFSET..DATA_OFFSET)
        .ok_or(AirspaceError::InvalidAttestation)?;
    let data_len = u32::from_le_bytes(len_bytes.try_into().unwrap()) as usize;
    let data_end = DATA_OFFSET
        .checked_add(data_len)
        .ok_or(AirspaceError::InvalidAttestation)?;
    let data = buf
        .get(DATA_OFFSET..data_end)
        .ok_or(AirspaceError::InvalidAttestation)?;

    let signer = read_pubkey(buf, data_end)?;
    let expiry_offset = data_end + 32;
    let expiry_bytes = buf
        .get(expiry_offset..expiry_offset + 8)
        .ok_or(AirspaceError::InvalidAttestation)?;
    let expiry = i64::from_le_bytes(expiry_bytes.try_into().unwrap());
    let token_account = read_pubkey(buf, expiry_offset + 8)?;

    Ok(AttestationView {
        nonce,
        credential,
        schema,
        data,
        signer,
        expiry,
        token_account,
    })
}

/// SAS attestation PDA: `["attestation", credential, schema, nonce]` under the SAS program.
pub fn attestation_address(credential: &Pubkey, schema: &Pubkey, nonce: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[
            ATTESTATION_SEED,
            credential.as_ref(),
            schema.as_ref(),
            nonce.as_ref(),
        ],
        &SAS_PROGRAM_ID,
    )
    .0
}

/// Nonce used for owner attestations: `["owner-nonce", wallet, bbl]` under this program.
pub fn owner_nonce_address(wallet: &Pubkey, bbl: &str) -> Pubkey {
    Pubkey::find_program_address(
        &[OWNER_NONCE_SEED, wallet.as_ref(), bbl.as_bytes()],
        &crate::ID,
    )
    .0
}

/// Checks shared by every attestation: program ownership, PDA derivation,
/// credential / schema match and expiry.
pub fn check_common(
    view: &AttestationView,
    account_key: &Pubkey,
    account_owner: &Pubkey,
    expected_credential: &Pubkey,
    expected_schema: &Pubkey,
    now: i64,
) -> Result<()> {
    require_keys_eq!(
        *account_owner,
        SAS_PROGRAM_ID,
        AirspaceError::InvalidAttestation
    );
    require!(
        *expected_credential != Pubkey::default() && *expected_schema != Pubkey::default(),
        AirspaceError::InvalidAttestation
    );
    require_keys_eq!(
        view.credential,
        *expected_credential,
        AirspaceError::InvalidAttestation
    );
    require_keys_eq!(view.schema, *expected_schema, AirspaceError::InvalidAttestation);
    require_keys_eq!(
        *account_key,
        attestation_address(&view.credential, &view.schema, &view.nonce),
        AirspaceError::InvalidAttestation
    );
    require!(
        view.expiry == 0 || view.expiry > now,
        AirspaceError::AttestationExpired
    );
    Ok(())
}

/// Owner attestation payload: nonce is the owner-nonce PDA and data is the
/// Borsh string of the bbl (u32 LE length prefix + bytes).
pub fn check_owner_payload(view: &AttestationView, owner: &Pubkey, bbl: &str) -> Result<()> {
    require_keys_eq!(
        view.nonce,
        owner_nonce_address(owner, bbl),
        AirspaceError::InvalidAttestation
    );
    let expected_len = (bbl.len() as u32).to_le_bytes();
    require!(
        view.data.len() == 4 + bbl.len(),
        AirspaceError::InvalidAttestation
    );
    require!(view.data[..4] == expected_len, AirspaceError::InvalidAttestation);
    require!(
        &view.data[4..] == bbl.as_bytes(),
        AirspaceError::InvalidAttestation
    );
    Ok(())
}

/// KYC attestation payload: nonce is the buyer wallet and `data[0]` (level) >= 1.
pub fn check_kyc_payload(view: &AttestationView, buyer: &Pubkey) -> Result<()> {
    require_keys_eq!(view.nonce, *buyer, AirspaceError::InvalidAttestation);
    let level = *view
        .data
        .first()
        .ok_or(AirspaceError::InvalidAttestation)?;
    require!(level >= 1, AirspaceError::InvalidAttestation);
    Ok(())
}

pub fn verify_owner_attestation(
    info: &AccountInfo,
    registry: &Registry,
    owner: &Pubkey,
    bbl: &str,
    now: i64,
) -> Result<()> {
    let data = info.try_borrow_data()?;
    let view = parse_attestation(&data)?;
    check_common(
        &view,
        info.key,
        info.owner,
        &registry.owner_credential,
        &registry.owner_schema,
        now,
    )?;
    check_owner_payload(&view, owner, bbl)
}

pub fn verify_kyc_attestation(
    info: &AccountInfo,
    registry: &Registry,
    buyer: &Pubkey,
    now: i64,
) -> Result<()> {
    let data = info.try_borrow_data()?;
    let view = parse_attestation(&data)?;
    check_common(
        &view,
        info.key,
        info.owner,
        &registry.kyc_credential,
        &registry.kyc_schema,
        now,
    )?;
    check_kyc_payload(&view, buyer)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pk(n: u8) -> Pubkey {
        Pubkey::new_from_array([n; 32])
    }

    fn encode(
        nonce: &Pubkey,
        credential: &Pubkey,
        schema: &Pubkey,
        data: &[u8],
        signer: &Pubkey,
        expiry: i64,
    ) -> Vec<u8> {
        let mut buf = vec![2u8];
        buf.extend_from_slice(nonce.as_ref());
        buf.extend_from_slice(credential.as_ref());
        buf.extend_from_slice(schema.as_ref());
        buf.extend_from_slice(&(data.len() as u32).to_le_bytes());
        buf.extend_from_slice(data);
        buf.extend_from_slice(signer.as_ref());
        buf.extend_from_slice(&expiry.to_le_bytes());
        buf.extend_from_slice(Pubkey::default().as_ref());
        buf
    }

    fn borsh_string(s: &str) -> Vec<u8> {
        let mut v = (s.len() as u32).to_le_bytes().to_vec();
        v.extend_from_slice(s.as_bytes());
        v
    }

    const BBL: &str = "1008350041";

    #[test]
    fn parses_full_layout() {
        let data = borsh_string(BBL);
        let buf = encode(&pk(1), &pk(2), &pk(3), &data, &pk(4), 1_900_000_000);
        let view = parse_attestation(&buf).unwrap();
        assert_eq!(view.nonce, pk(1));
        assert_eq!(view.credential, pk(2));
        assert_eq!(view.schema, pk(3));
        assert_eq!(view.data, data.as_slice());
        assert_eq!(view.signer, pk(4));
        assert_eq!(view.expiry, 1_900_000_000);
        assert_eq!(view.token_account, Pubkey::default());
    }

    #[test]
    fn rejects_truncated_and_overflowing_buffers() {
        let buf = encode(&pk(1), &pk(2), &pk(3), &[1], &pk(4), 0);
        for cut in [0usize, 10, 100, 101, 102, 120, buf.len() - 1] {
            assert!(parse_attestation(&buf[..cut]).is_err(), "cut at {cut}");
        }
        // data_len claims more bytes than present
        let mut bad = buf.clone();
        bad[97..101].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(parse_attestation(&bad).is_err());
    }

    #[test]
    fn common_checks_accept_valid_and_reject_each_mismatch() {
        let credential = pk(2);
        let schema = pk(3);
        let nonce = pk(1);
        let buf = encode(&nonce, &credential, &schema, &[1], &pk(4), 2_000_000_000);
        let view = parse_attestation(&buf).unwrap();
        let key = attestation_address(&credential, &schema, &nonce);
        let now = 1_700_000_000;

        assert!(check_common(&view, &key, &SAS_PROGRAM_ID, &credential, &schema, now).is_ok());
        // wrong owner program
        assert!(check_common(&view, &key, &crate::ID, &credential, &schema, now).is_err());
        // wrong PDA
        assert!(check_common(&view, &pk(9), &SAS_PROGRAM_ID, &credential, &schema, now).is_err());
        // credential / schema mismatch
        assert!(check_common(&view, &key, &SAS_PROGRAM_ID, &pk(8), &schema, now).is_err());
        assert!(check_common(&view, &key, &SAS_PROGRAM_ID, &credential, &pk(8), now).is_err());
        // unconfigured registry
        assert!(check_common(&view, &key, &SAS_PROGRAM_ID, &Pubkey::default(), &schema, now).is_err());
        // expired
        let err = check_common(&view, &key, &SAS_PROGRAM_ID, &credential, &schema, 2_000_000_001)
            .unwrap_err();
        assert_eq!(err, AirspaceError::AttestationExpired.into());
        // expiry == 0 never expires
        let buf0 = encode(&nonce, &credential, &schema, &[1], &pk(4), 0);
        let view0 = parse_attestation(&buf0).unwrap();
        assert!(check_common(&view0, &key, &SAS_PROGRAM_ID, &credential, &schema, i64::MAX).is_ok());
    }

    #[test]
    fn owner_payload_accepts_matching_bbl_and_nonce() {
        let owner = pk(5);
        let nonce = owner_nonce_address(&owner, BBL);
        let data = borsh_string(BBL);
        let buf = encode(&nonce, &pk(2), &pk(3), &data, &pk(4), 0);
        let view = parse_attestation(&buf).unwrap();
        assert!(check_owner_payload(&view, &owner, BBL).is_ok());
        // different wallet -> nonce mismatch
        assert!(check_owner_payload(&view, &pk(6), BBL).is_err());
        // different bbl -> nonce mismatch
        assert!(check_owner_payload(&view, &owner, "1008350042").is_err());
    }

    #[test]
    fn owner_payload_rejects_bad_data_encoding() {
        let owner = pk(5);
        let nonce = owner_nonce_address(&owner, BBL);
        // raw bytes without the u32 length prefix
        let buf = encode(&nonce, &pk(2), &pk(3), BBL.as_bytes(), &pk(4), 0);
        let view = parse_attestation(&buf).unwrap();
        assert!(check_owner_payload(&view, &owner, BBL).is_err());
        // wrong bbl in data with the right nonce
        let buf = encode(&nonce, &pk(2), &pk(3), &borsh_string("1008350042"), &pk(4), 0);
        let view = parse_attestation(&buf).unwrap();
        assert!(check_owner_payload(&view, &owner, BBL).is_err());
        // wrong length prefix
        let mut data = borsh_string(BBL);
        data[0] = 9;
        let buf = encode(&nonce, &pk(2), &pk(3), &data, &pk(4), 0);
        let view = parse_attestation(&buf).unwrap();
        assert!(check_owner_payload(&view, &owner, BBL).is_err());
    }

    #[test]
    fn kyc_payload_checks_nonce_and_level() {
        let buyer = pk(7);
        for level in [1u8, 2, 255] {
            let buf = encode(&buyer, &pk(2), &pk(3), &[level], &pk(4), 0);
            let view = parse_attestation(&buf).unwrap();
            assert!(check_kyc_payload(&view, &buyer).is_ok());
        }
        let buf = encode(&buyer, &pk(2), &pk(3), &[0], &pk(4), 0);
        let view = parse_attestation(&buf).unwrap();
        assert!(check_kyc_payload(&view, &buyer).is_err());
        let buf = encode(&buyer, &pk(2), &pk(3), &[], &pk(4), 0);
        let view = parse_attestation(&buf).unwrap();
        assert!(check_kyc_payload(&view, &buyer).is_err());
        let buf = encode(&pk(8), &pk(2), &pk(3), &[1], &pk(4), 0);
        let view = parse_attestation(&buf).unwrap();
        assert!(check_kyc_payload(&view, &buyer).is_err());
    }
}
