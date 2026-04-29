import { z } from "zod"

export const keywordModeSchema = z.enum(["any", "all"])

/** Listed / escrow budget in USDT (e.g. "50", "0.5", "1.23"); stored & on-chain use token base units. */
export const budgetAmountSchema = z
    .string()
    .min(1)
    .describe(
        'USDT amount as a string, e.g. "50", "0.5", or "1.23" (up to token decimals).'
    )
