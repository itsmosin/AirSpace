use anchor_lang::prelude::*;

#[error_code]
pub enum AirspaceError {
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Verdict status is not Allow")]
    VerdictNotAllowed,
    #[msg("Verdict is locked because a parcel was already minted for this BBL")]
    VerdictLocked,
    #[msg("Report BBL does not match the verdict account")]
    BblMismatch,
    #[msg("Attestation account failed validation")]
    InvalidAttestation,
    #[msg("Attestation has expired")]
    AttestationExpired,
    #[msg("Forwarder state is not owned by the configured forwarder program")]
    InvalidForwarderProgram,
    #[msg("forwarder_authority is not the expected forwarder PDA")]
    InvalidForwarderAuthority,
    #[msg("Report payload is not a valid Borsh VerdictReport")]
    InvalidReportPayload,
    #[msg("Price update account failed validation")]
    InvalidPriceAccount,
    #[msg("Price update is older than the configured tolerance")]
    StalePrice,
    #[msg("Price update is for a different feed")]
    WrongFeed,
    #[msg("Parcel is not listed")]
    ParcelNotListed,
    #[msg("Parcel is already listed")]
    ParcelAlreadyListed,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Invalid instruction arguments")]
    InvalidArgs,
}
