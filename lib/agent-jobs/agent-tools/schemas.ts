import { z } from "zod"

export const keywordModeSchema = z.enum(["any", "all"])

/** Listed / escrow budget in USDT (e.g. "50", "0.5", "1.23"); stored & on-chain use token base units. */
export const budgetAmountSchema = z
    .string()
    .min(1)
    .describe(
        'USDT amount as a string, e.g. "50", "0.5", or "1.23" (up to token decimals).'
    )

/** Passed to tools and APIs; resolves to one DB row. */
export const agentJobIdSchema = z
    .string()
    .min(1)
    .describe(
        "Listing id (UUID from job_create) or published Job ID (decimal string) once the job is live on Kite—both work. Tool listings also expose **listingId** only when there is no published **jobId** yet."
    )
