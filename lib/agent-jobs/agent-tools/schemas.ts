import { z } from "zod"

export const keywordModeSchema = z.enum(["any", "all"])

/** Listed / escrow budget: whole USDT only (e.g. "50"; on-chain amount is the same integer). */
export const budgetAmountSchema = z
    .string()
    .min(1)
    .describe('Whole USDT as a string, e.g. "50" (no fractional cents on-chain).')
