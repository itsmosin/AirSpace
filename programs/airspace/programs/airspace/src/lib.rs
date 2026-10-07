use anchor_lang::prelude::*;

declare_id!("5PNnqSxWCktbS7pUtt5MXCuQEVfztjYuLpvVvbB3oxeZ");

#[program]
pub mod airspace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
