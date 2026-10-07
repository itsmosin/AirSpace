//! AirSpace: an on-chain registry and marketplace for NYC air rights.
//!
//! Flow: a BBL gets a `Verdict` (written by the Chainlink CRE workflow through the
//! keystone forwarder, or by the registrar as a fallback), the verified owner mints a
//! Metaplex Core asset into the AirSpace collection (`Parcel`), and parcels trade
//! through an escrow PDA with Pyth-priced SOL settlement and SAS KYC checks.

#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use mpl_core::instructions::{
    CreateCollectionV2CpiBuilder, CreateV2CpiBuilder, TransferV1CpiBuilder,
};
use mpl_core::types::{
    Attribute, Attributes, Creator, DataState, Plugin, PluginAuthorityPair, Royalties, RuleSet,
};

pub mod constants;
pub mod errors;
pub mod events;
pub mod pyth;
pub mod sas;
pub mod state;

use constants::*;
use errors::AirspaceError;
use events::*;
use state::*;

declare_id!("5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ");

#[program]
pub mod airspace {
    use super::*;

    /// Creates the singleton `Registry`.
    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        registrar: Pubkey,
        treasury: Pubkey,
        forwarder_program: Pubkey,
        fee_bps: u16,
        max_price_age_secs: u32,
    ) -> Result<()> {
        require!(
            (fee_bps as u64) <= BPS_DENOMINATOR,
            AirspaceError::InvalidArgs
        );
        require!(max_price_age_secs > 0, AirspaceError::InvalidArgs);
        require!(
            registrar != Pubkey::default() && treasury != Pubkey::default(),
            AirspaceError::InvalidArgs
        );
        require!(
            forwarder_program != Pubkey::default(),
            AirspaceError::InvalidForwarderProgram
        );

        let registry = &mut ctx.accounts.registry;
        registry.admin = ctx.accounts.admin.key();
        registry.registrar = registrar;
        registry.treasury = treasury;
        registry.forwarder_program = forwarder_program;
        registry.collection = Pubkey::default();
        registry.owner_credential = Pubkey::default();
        registry.owner_schema = Pubkey::default();
        registry.kyc_credential = Pubkey::default();
        registry.kyc_schema = Pubkey::default();
        registry.fee_bps = fee_bps;
        registry.max_price_age_secs = max_price_age_secs;
        registry.parcel_count = 0;
        registry.bump = ctx.bumps.registry;
        Ok(())
    }

    /// Stores the SAS credential / schema keys used to validate attestations.
    pub fn set_attestation_config(
        ctx: Context<SetAttestationConfig>,
        owner_credential: Pubkey,
        owner_schema: Pubkey,
        kyc_credential: Pubkey,
        kyc_schema: Pubkey,
    ) -> Result<()> {
        require!(
            owner_credential != Pubkey::default()
                && owner_schema != Pubkey::default()
                && kyc_credential != Pubkey::default()
                && kyc_schema != Pubkey::default(),
            AirspaceError::InvalidArgs
        );
        let registry = &mut ctx.accounts.registry;
        registry.owner_credential = owner_credential;
        registry.owner_schema = owner_schema;
        registry.kyc_credential = kyc_credential;
        registry.kyc_schema = kyc_schema;
        Ok(())
    }

    /// Admin-only: switches the keystone forwarder program allowed to call `on_report`
    /// (e.g. simulator mock forwarder <-> production DON forwarder) without redeploying.
    pub fn set_forwarder(ctx: Context<SetForwarder>, forwarder_program: Pubkey) -> Result<()> {
        require!(
            forwarder_program != Pubkey::default(),
            AirspaceError::InvalidForwarderProgram
        );
        ctx.accounts.registry.forwarder_program = forwarder_program;
        Ok(())
    }

    /// Creates the Metaplex Core collection; the registry PDA is its update authority.
    pub fn create_collection(
        ctx: Context<CreateCollection>,
        name: String,
        uri: String,
    ) -> Result<()> {
        require!(
            !name.is_empty() && name.len() <= MAX_ASSET_NAME_LEN,
            AirspaceError::InvalidArgs
        );
        require!(
            !uri.is_empty() && uri.len() <= MAX_ASSET_URI_LEN,
            AirspaceError::InvalidArgs
        );

        CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .collection(&ctx.accounts.collection.to_account_info())
            .update_authority(Some(&ctx.accounts.registry.to_account_info()))
            .payer(&ctx.accounts.admin.to_account_info())
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(name)
            .uri(uri)
            .invoke()?;

        ctx.accounts.registry.collection = ctx.accounts.collection.key();
        Ok(())
    }

    /// Opens (or re-opens) the verdict for a BBL. Safe to call repeatedly; a verdict
    /// that is `Allow` and already backed by a minted parcel cannot be reset.
    pub fn open_verdict(ctx: Context<OpenVerdict>, bbl: String) -> Result<()> {
        validate_bbl(&bbl)?;
        let now = Clock::get()?.unix_timestamp;
        let parcel_exists = ctx.accounts.parcel.owner == &crate::ID
            && !ctx.accounts.parcel.data_is_empty();

        let verdict = &mut ctx.accounts.verdict;
        if verdict.requested_at != 0 {
            require!(
                !(verdict.status == VERDICT_ALLOW && parcel_exists),
                AirspaceError::VerdictLocked
            );
        }

        verdict.bbl = bbl;
        verdict.status = VERDICT_PENDING;
        verdict.confidence_bps = 0;
        verdict.flags = 0;
        verdict.unused_sqft = 0;
        verdict.est_value_usd = 0;
        verdict.report_hash = [0u8; 32];
        verdict.source = SOURCE_MANUAL;
        verdict.requester = ctx.accounts.payer.key();
        verdict.requested_at = now;
        verdict.recorded_at = 0;
        verdict.bump = ctx.bumps.verdict;
        Ok(())
    }

    /// Entry point for the Chainlink keystone forwarder CPI. The forwarder has
    /// already verified the DON signatures; this only checks that the CPI really
    /// came from the configured forwarder program, then decodes the report.
    pub fn on_report(ctx: Context<OnReport>, _metadata: Vec<u8>, report: Vec<u8>) -> Result<()> {
        verify_forwarder_cpi(
            &ctx.accounts.state,
            &ctx.accounts.forwarder_authority,
            &ctx.accounts.registry,
        )?;

        let mut reader: &[u8] = report.as_slice();
        let decoded = VerdictReport::deserialize(&mut reader)
            .map_err(|_| error!(AirspaceError::InvalidReportPayload))?;
        require!(
            (VERDICT_ALLOW..=VERDICT_REVIEW).contains(&decoded.status),
            AirspaceError::InvalidReportPayload
        );
        require!(
            (decoded.confidence_bps as u64) <= BPS_DENOMINATOR,
            AirspaceError::InvalidReportPayload
        );
        require!(
            decoded.bbl == ctx.accounts.verdict.bbl,
            AirspaceError::BblMismatch
        );

        let now = Clock::get()?.unix_timestamp;
        apply_verdict(
            &mut ctx.accounts.verdict,
            decoded.status,
            decoded.confidence_bps,
            decoded.flags,
            decoded.unused_sqft,
            decoded.est_value_usd,
            decoded.report_hash,
            SOURCE_CRE,
            now,
        );
        Ok(())
    }

    /// Registrar fallback / demo path for recording a verdict.
    pub fn record_verdict_manual(
        ctx: Context<RecordVerdictManual>,
        status: u8,
        confidence_bps: u16,
        flags: u32,
        unused_sqft: u64,
        est_value_usd: u64,
        report_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            (VERDICT_ALLOW..=VERDICT_REVIEW).contains(&status),
            AirspaceError::InvalidArgs
        );
        require!(
            (confidence_bps as u64) <= BPS_DENOMINATOR,
            AirspaceError::InvalidArgs
        );
        let now = Clock::get()?.unix_timestamp;
        apply_verdict(
            &mut ctx.accounts.verdict,
            status,
            confidence_bps,
            flags,
            unused_sqft,
            est_value_usd,
            report_hash,
            SOURCE_MANUAL,
            now,
        );
        Ok(())
    }

    /// Mints the Core asset for an `Allow` verdict, gated by an SAS owner attestation.
    pub fn mint_parcel(ctx: Context<MintParcel>, args: MintParcelArgs) -> Result<()> {
        require!(
            !args.address.is_empty() && args.address.len() <= MAX_ADDRESS_LEN,
            AirspaceError::InvalidArgs
        );
        require!(
            args.zoning.len() <= MAX_ZONING_LEN,
            AirspaceError::InvalidArgs
        );
        require!(
            (1..=5).contains(&args.borough),
            AirspaceError::InvalidArgs
        );
        require!(
            !args.name.is_empty() && args.name.len() <= MAX_ASSET_NAME_LEN,
            AirspaceError::InvalidArgs
        );
        require!(
            !args.uri.is_empty() && args.uri.len() <= MAX_ASSET_URI_LEN,
            AirspaceError::InvalidArgs
        );

        let now = Clock::get()?.unix_timestamp;
        let bbl = ctx.accounts.verdict.bbl.clone();
        sas::verify_owner_attestation(
            &ctx.accounts.owner_attestation.to_account_info(),
            &ctx.accounts.registry,
            &ctx.accounts.owner.key(),
            &bbl,
            now,
        )?;

        let attributes = build_attributes(&bbl, &args, &ctx.accounts.verdict);
        let plugins = vec![
            PluginAuthorityPair {
                plugin: Plugin::Attributes(Attributes {
                    attribute_list: attributes,
                }),
                authority: None,
            },
            PluginAuthorityPair {
                plugin: Plugin::Royalties(Royalties {
                    basis_points: ROYALTY_BPS,
                    creators: vec![Creator {
                        address: ctx.accounts.registry.treasury,
                        percentage: 100,
                    }],
                    rule_set: RuleSet::None,
                }),
                authority: None,
            },
        ];

        let registry_bump = ctx.accounts.registry.bump;
        let registry_seeds: &[&[u8]] = &[REGISTRY_SEED, &[registry_bump]];
        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .authority(Some(&ctx.accounts.registry.to_account_info()))
            .payer(&ctx.accounts.owner.to_account_info())
            .owner(Some(&ctx.accounts.owner.to_account_info()))
            .update_authority(None)
            .system_program(&ctx.accounts.system_program.to_account_info())
            .data_state(DataState::AccountState)
            .name(args.name.clone())
            .uri(args.uri.clone())
            .plugins(plugins)
            .invoke_signed(&[registry_seeds])?;

        let verdict = &ctx.accounts.verdict;
        let parcel = &mut ctx.accounts.parcel;
        parcel.bbl = bbl.clone();
        parcel.owner = ctx.accounts.owner.key();
        parcel.core_asset = ctx.accounts.asset.key();
        parcel.address = args.address;
        parcel.borough = args.borough;
        parcel.lat_e6 = args.lat_e6;
        parcel.lng_e6 = args.lng_e6;
        parcel.lot_area_sqft = args.lot_area_sqft;
        parcel.built_area_sqft = args.built_area_sqft;
        parcel.max_far_bps = args.max_far_bps;
        parcel.unused_sqft = verdict.unused_sqft;
        parcel.est_value_usd = verdict.est_value_usd;
        parcel.zoning = args.zoning;
        parcel.verdict_hash = verdict.report_hash;
        parcel.status = PARCEL_MINTED;
        parcel.minted_at = now;
        parcel.bump = ctx.bumps.parcel;

        let registry = &mut ctx.accounts.registry;
        registry.parcel_count = registry
            .parcel_count
            .checked_add(1)
            .ok_or(AirspaceError::MathOverflow)?;

        emit!(ParcelMinted {
            bbl,
            asset: ctx.accounts.asset.key(),
            owner: ctx.accounts.owner.key(),
        });
        Ok(())
    }

    /// Lists a parcel: the Core asset moves into the escrow PDA.
    pub fn list_parcel(ctx: Context<ListParcel>, price_usd_cents: u64) -> Result<()> {
        require!(price_usd_cents > 0, AirspaceError::InvalidArgs);
        require!(
            ctx.accounts.parcel.status == PARCEL_MINTED,
            AirspaceError::ParcelAlreadyListed
        );

        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.seller.to_account_info())
            .authority(Some(&ctx.accounts.seller.to_account_info()))
            .new_owner(&ctx.accounts.escrow.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke()?;

        let now = Clock::get()?.unix_timestamp;
        let listing = &mut ctx.accounts.listing;
        listing.parcel = ctx.accounts.parcel.key();
        listing.seller = ctx.accounts.seller.key();
        listing.price_usd_cents = price_usd_cents;
        listing.created_at = now;
        listing.bump = ctx.bumps.listing;

        let parcel = &mut ctx.accounts.parcel;
        parcel.status = PARCEL_LISTED;

        emit!(ParcelListed {
            bbl: parcel.bbl.clone(),
            asset: parcel.core_asset,
            seller: ctx.accounts.seller.key(),
            price_usd_cents,
        });
        Ok(())
    }

    /// Cancels a listing: escrow PDA returns the asset to the seller.
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        require!(
            ctx.accounts.parcel.status == PARCEL_LISTED,
            AirspaceError::ParcelNotListed
        );

        let escrow_bump = ctx.bumps.escrow;
        let escrow_seeds: &[&[u8]] = &[ESCROW_SEED, &[escrow_bump]];
        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.seller.to_account_info())
            .authority(Some(&ctx.accounts.escrow.to_account_info()))
            .new_owner(&ctx.accounts.seller.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke_signed(&[escrow_seeds])?;

        let parcel = &mut ctx.accounts.parcel;
        parcel.status = PARCEL_MINTED;

        emit!(ListingCancelled {
            bbl: parcel.bbl.clone(),
            asset: parcel.core_asset,
        });
        Ok(())
    }

    /// Buys a listed parcel: Pyth SOL/USD converts the USD price into lamports,
    /// the fee goes to the treasury, the rest to the seller, and the escrow PDA
    /// hands the asset to the KYC-attested buyer.
    pub fn buy_parcel(ctx: Context<BuyParcel>) -> Result<()> {
        require!(
            ctx.accounts.parcel.status == PARCEL_LISTED,
            AirspaceError::ParcelNotListed
        );
        let now = Clock::get()?.unix_timestamp;
        let registry = &ctx.accounts.registry;

        sas::verify_kyc_attestation(
            &ctx.accounts.buyer_attestation.to_account_info(),
            registry,
            &ctx.accounts.buyer.key(),
            now,
        )?;

        let price = pyth::verify_price_account(
            &ctx.accounts.price_update.to_account_info(),
            now,
            registry.max_price_age_secs,
        )?;
        let price_usd_cents = ctx.accounts.listing.price_usd_cents;
        let lamports = pyth::usd_cents_to_lamports(price_usd_cents, price.price, price.exponent)?;
        require!(lamports > 0, AirspaceError::InvalidArgs);
        let sol_usd_price_e8 = pyth::price_to_e8(price.price, price.exponent)?;

        let fee = (lamports as u128)
            .checked_mul(registry.fee_bps as u128)
            .ok_or(AirspaceError::MathOverflow)?
            / BPS_DENOMINATOR as u128;
        let fee = u64::try_from(fee).map_err(|_| error!(AirspaceError::MathOverflow))?;
        let to_seller = lamports
            .checked_sub(fee)
            .ok_or(AirspaceError::MathOverflow)?;

        if fee > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                fee,
            )?;
        }
        if to_seller > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.seller.to_account_info(),
                    },
                ),
                to_seller,
            )?;
        }

        let escrow_bump = ctx.bumps.escrow;
        let escrow_seeds: &[&[u8]] = &[ESCROW_SEED, &[escrow_bump]];
        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.buyer.to_account_info())
            .authority(Some(&ctx.accounts.escrow.to_account_info()))
            .new_owner(&ctx.accounts.buyer.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke_signed(&[escrow_seeds])?;

        let parcel = &mut ctx.accounts.parcel;
        parcel.owner = ctx.accounts.buyer.key();
        parcel.status = PARCEL_MINTED;

        emit!(ParcelSold {
            bbl: parcel.bbl.clone(),
            asset: parcel.core_asset,
            buyer: ctx.accounts.buyer.key(),
            seller: ctx.accounts.seller.key(),
            price_usd_cents,
            lamports_paid: lamports,
            sol_usd_price_e8,
        });
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn validate_bbl(bbl: &str) -> Result<()> {
    require!(
        bbl.len() == BBL_LEN && bbl.bytes().all(|b| b.is_ascii_digit()),
        AirspaceError::InvalidArgs
    );
    Ok(())
}

fn verify_forwarder_cpi(
    state: &UncheckedAccount,
    forwarder_authority: &Signer,
    registry: &Account<Registry>,
) -> Result<()> {
    let forwarder_program = registry.forwarder_program;
    require!(
        forwarder_program != Pubkey::default(),
        AirspaceError::InvalidForwarderProgram
    );
    require_keys_eq!(
        *state.to_account_info().owner,
        forwarder_program,
        AirspaceError::InvalidForwarderProgram
    );

    let state_key = state.key();
    let seeds: &[&[u8]] = &[b"forwarder", state_key.as_ref(), crate::ID.as_ref()];
    let (expected_authority, _bump) = Pubkey::find_program_address(seeds, &forwarder_program);
    require_keys_eq!(
        expected_authority,
        forwarder_authority.key(),
        AirspaceError::InvalidForwarderAuthority
    );
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn apply_verdict(
    verdict: &mut Account<Verdict>,
    status: u8,
    confidence_bps: u16,
    flags: u32,
    unused_sqft: u64,
    est_value_usd: u64,
    report_hash: [u8; 32],
    source: u8,
    now: i64,
) {
    verdict.status = status;
    verdict.confidence_bps = confidence_bps;
    verdict.flags = flags;
    verdict.unused_sqft = unused_sqft;
    verdict.est_value_usd = est_value_usd;
    verdict.report_hash = report_hash;
    verdict.source = source;
    verdict.recorded_at = now;

    emit!(VerdictRecorded {
        bbl: verdict.bbl.clone(),
        status,
        source,
        confidence_bps,
        flags,
        unused_sqft,
        est_value_usd,
    });
}

fn hex32(bytes: &[u8; 32]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(64);
    for b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0x0f) as usize] as char);
    }
    s
}

/// Renders `value / 10^decimals` as a decimal string ("40.748400").
fn fixed_point(value: i64, decimals: u32) -> String {
    let scale = 10u64.pow(decimals);
    let abs = value.unsigned_abs();
    let sign = if value < 0 { "-" } else { "" };
    format!(
        "{}{}.{:0width$}",
        sign,
        abs / scale,
        abs % scale,
        width = decimals as usize
    )
}

fn borough_code(borough: u8) -> &'static str {
    match borough {
        1 => "MN",
        2 => "BX",
        3 => "BK",
        4 => "QN",
        5 => "SI",
        _ => "??",
    }
}

fn build_attributes(bbl: &str, args: &MintParcelArgs, verdict: &Verdict) -> Vec<Attribute> {
    let attr = |key: &str, value: String| Attribute {
        key: key.to_string(),
        value,
    };
    vec![
        attr("bbl", bbl.to_string()),
        attr("address", args.address.clone()),
        attr("borough", borough_code(args.borough).to_string()),
        attr("zoning", args.zoning.clone()),
        attr("lot_area_sqft", args.lot_area_sqft.to_string()),
        attr("built_area_sqft", args.built_area_sqft.to_string()),
        attr("max_far", fixed_point((args.max_far_bps / 100) as i64, 2)),
        attr("unused_sqft", verdict.unused_sqft.to_string()),
        attr("est_value_usd", verdict.est_value_usd.to_string()),
        attr("verdict_hash", hex32(&verdict.report_hash)),
        attr("lat", fixed_point(args.lat_e6 as i64, 6)),
        attr("lng", fixed_point(args.lng_e6 as i64, 6)),
        attr(
            "verified_by",
            if verdict.source == SOURCE_CRE {
                "Chainlink CRE"
            } else {
                "AirSpace Registrar"
            }
            .to_string(),
        ),
    ]
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Registry::INIT_SPACE,
        seeds = [REGISTRY_SEED],
        bump
    )]
    pub registry: Account<'info, Registry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAttestationConfig<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [REGISTRY_SEED],
        bump = registry.bump,
        has_one = admin @ AirspaceError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
}

#[derive(Accounts)]
pub struct SetForwarder<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [REGISTRY_SEED],
        bump = registry.bump,
        has_one = admin @ AirspaceError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
}

#[derive(Accounts)]
pub struct CreateCollection<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [REGISTRY_SEED],
        bump = registry.bump,
        has_one = admin @ AirspaceError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
    /// Fresh keypair; becomes the Core collection account.
    #[account(mut)]
    pub collection: Signer<'info>,
    /// CHECK: Metaplex Core program id is pinned.
    #[account(address = mpl_core::ID @ AirspaceError::InvalidArgs)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bbl: String)]
pub struct OpenVerdict<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Verdict::INIT_SPACE,
        seeds = [VERDICT_SEED, bbl.as_bytes()],
        bump
    )]
    pub verdict: Account<'info, Verdict>,
    pub system_program: Program<'info, System>,
    /// CHECK: Parcel PDA for this BBL. Only its existence is inspected (it may not
    /// exist yet); the address is enforced by the seeds constraint.
    #[account(seeds = [PARCEL_SEED, bbl.as_bytes()], bump)]
    pub parcel: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct OnReport<'info> {
    /// CHECK: keystone forwarder state; its owner must be `registry.forwarder_program`.
    pub state: UncheckedAccount<'info>,
    /// PDA signer supplied by the forwarder CPI; verified in `verify_forwarder_cpi`.
    pub forwarder_authority: Signer<'info>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        seeds = [VERDICT_SEED, verdict.bbl.as_bytes()],
        bump = verdict.bump
    )]
    pub verdict: Account<'info, Verdict>,
}

#[derive(Accounts)]
pub struct RecordVerdictManual<'info> {
    pub registrar: Signer<'info>,
    #[account(
        seeds = [REGISTRY_SEED],
        bump = registry.bump,
        has_one = registrar @ AirspaceError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        seeds = [VERDICT_SEED, verdict.bbl.as_bytes()],
        bump = verdict.bump
    )]
    pub verdict: Account<'info, Verdict>,
}

#[derive(Accounts)]
pub struct MintParcel<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [REGISTRY_SEED],
        bump = registry.bump,
        constraint = registry.collection != Pubkey::default() @ AirspaceError::InvalidArgs
    )]
    pub registry: Account<'info, Registry>,
    #[account(
        seeds = [VERDICT_SEED, verdict.bbl.as_bytes()],
        bump = verdict.bump,
        constraint = verdict.status == VERDICT_ALLOW @ AirspaceError::VerdictNotAllowed
    )]
    pub verdict: Account<'info, Verdict>,
    /// CHECK: SAS attestation; owner, PDA, credential, schema, expiry and payload
    /// are verified in `sas::verify_owner_attestation`.
    pub owner_attestation: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Parcel::INIT_SPACE,
        seeds = [PARCEL_SEED, verdict.bbl.as_bytes()],
        bump
    )]
    pub parcel: Account<'info, Parcel>,
    /// Fresh keypair; becomes the Core asset account.
    #[account(mut)]
    pub asset: Signer<'info>,
    /// CHECK: must be the registry collection; Core validates the rest.
    #[account(mut, address = registry.collection @ AirspaceError::InvalidArgs)]
    pub collection: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core program id is pinned.
    #[account(address = mpl_core::ID @ AirspaceError::InvalidArgs)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListParcel<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        seeds = [PARCEL_SEED, parcel.bbl.as_bytes()],
        bump = parcel.bump,
        constraint = parcel.owner == seller.key() @ AirspaceError::Unauthorized
    )]
    pub parcel: Account<'info, Parcel>,
    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [LISTING_SEED, parcel.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    /// CHECK: must be the parcel's Core asset; Core validates ownership.
    #[account(mut, address = parcel.core_asset @ AirspaceError::InvalidArgs)]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: must be the registry collection.
    #[account(mut, address = registry.collection @ AirspaceError::InvalidArgs)]
    pub collection: UncheckedAccount<'info>,
    /// CHECK: escrow authority PDA (no data).
    #[account(seeds = [ESCROW_SEED], bump)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core program id is pinned.
    #[account(address = mpl_core::ID @ AirspaceError::InvalidArgs)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        seeds = [PARCEL_SEED, parcel.bbl.as_bytes()],
        bump = parcel.bump,
        constraint = parcel.owner == seller.key() @ AirspaceError::Unauthorized
    )]
    pub parcel: Account<'info, Parcel>,
    #[account(
        mut,
        close = seller,
        seeds = [LISTING_SEED, parcel.key().as_ref()],
        bump = listing.bump,
        has_one = seller @ AirspaceError::Unauthorized,
        has_one = parcel @ AirspaceError::InvalidArgs
    )]
    pub listing: Account<'info, Listing>,
    /// CHECK: must be the parcel's Core asset.
    #[account(mut, address = parcel.core_asset @ AirspaceError::InvalidArgs)]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: Core validates that this is the asset's collection.
    #[account(mut)]
    pub collection: UncheckedAccount<'info>,
    /// CHECK: escrow authority PDA (no data); signs the transfer back.
    #[account(seeds = [ESCROW_SEED], bump)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core program id is pinned.
    #[account(address = mpl_core::ID @ AirspaceError::InvalidArgs)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyParcel<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        seeds = [PARCEL_SEED, parcel.bbl.as_bytes()],
        bump = parcel.bump
    )]
    pub parcel: Account<'info, Parcel>,
    #[account(
        mut,
        close = seller,
        seeds = [LISTING_SEED, parcel.key().as_ref()],
        bump = listing.bump,
        has_one = seller @ AirspaceError::Unauthorized,
        has_one = parcel @ AirspaceError::InvalidArgs
    )]
    pub listing: Account<'info, Listing>,
    /// CHECK: enforced to equal `listing.seller` via `has_one`.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,
    /// CHECK: enforced to equal `registry.treasury`.
    #[account(mut, address = registry.treasury @ AirspaceError::InvalidArgs)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: SAS KYC attestation; verified in `sas::verify_kyc_attestation`.
    pub buyer_attestation: UncheckedAccount<'info>,
    /// CHECK: Pyth PriceUpdateV2; owner, feed, sign and staleness verified in `pyth`.
    #[account(owner = PYTH_RECEIVER_ID @ AirspaceError::InvalidPriceAccount)]
    pub price_update: UncheckedAccount<'info>,
    /// CHECK: must be the parcel's Core asset.
    #[account(mut, address = parcel.core_asset @ AirspaceError::InvalidArgs)]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: must be the registry collection.
    #[account(mut, address = registry.collection @ AirspaceError::InvalidArgs)]
    pub collection: UncheckedAccount<'info>,
    /// CHECK: escrow authority PDA (no data); signs the transfer to the buyer.
    #[account(seeds = [ESCROW_SEED], bump)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core program id is pinned.
    #[account(address = mpl_core::ID @ AirspaceError::InvalidArgs)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_attribute_values() {
        assert_eq!(fixed_point(40_748_400, 6), "40.748400");
        assert_eq!(fixed_point(-73_985_700, 6), "-73.985700");
        assert_eq!(fixed_point(1500, 2), "15.00");
        assert_eq!(fixed_point(5, 2), "0.05");
        assert_eq!(hex32(&[0u8; 32]), "0".repeat(64));
        assert_eq!(&hex32(&[0xab; 32])[..4], "abab");
        assert_eq!(borough_code(1), "MN");
        assert_eq!(borough_code(5), "SI");
    }

    #[test]
    fn bbl_validation() {
        assert!(validate_bbl("1008350041").is_ok());
        assert!(validate_bbl("100835004").is_err());
        assert!(validate_bbl("10083500411").is_err());
        assert!(validate_bbl("10083500a1").is_err());
    }
}
