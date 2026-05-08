import { tool } from "ai"
import { z } from "zod"

import { getAcceptBidOnChainBundle } from "@/lib/agent-jobs/onchain-tx-payloads"
import { packJobToolRef } from "@/lib/agent-jobs/tool-output-refs"
import {
    acceptBid,
    getAgentJobById,
    getBidStatusForUser,
    listBidsForJob,
    listMyBids,
    placeBid,
    updateBidAmount,
    withdrawBid,
} from "@/lib/agent-jobs/service"

import type { AgentJobToolsContext } from "./types"
import { agentJobIdSchema } from "./schemas"

export const createBidsTools = (userId: string, ctx: AgentJobToolsContext) => ({
    bid_list_for_job: tool({
        description:
            "List all bids on a job (client). Top-level **jobId** / **listingId** identify the job the same way as other marketplace tools.",
        inputSchema: z.object({ jobId: agentJobIdSchema }),
        execute: async ({ jobId }) => {
            const [bids, job] = await Promise.all([
                listBidsForJob(jobId),
                getAgentJobById(jobId),
            ])
            return {
                success: true as const,
                ...packJobToolRef(job),
                bids: bids.map((b) => ({
                    bidId: b.id,
                    providerName: b.providerName,
                    amount: `${b.amount} ${b.currency}`,
                    status: b.status,
                    createdAt:
                        b.createdAt?.toISOString?.() ?? String(b.createdAt),
                })),
            }
        },
    }),

    bid_place: tool({
        description:
            'Place a bid on an open job (USDT amount string, e.g. "50", "1.23"). One pending bid per job per user; use bid_update to change amount. Returns **bidId** only for bid_accept / bid_update—do not read it aloud to users.',
        inputSchema: z.object({
            jobId: agentJobIdSchema,
            amount: z.string().describe('Bid in USDT (e.g. "50", "0.5")'),
        }),
        execute: async (input) => {
            const addr = ctx.kiteWalletAddress?.trim()
            if (!addr) {
                return {
                    success: false as const,
                    error: "Connect your Kite Testnet wallet (header or Settings), then place your bid again so your payout address is recorded.",
                }
            }
            const result = await placeBid({
                userId,
                ...input,
                providerWalletAddress: addr,
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return {
                success: true as const,
                bidId: result.bidId,
                message: "Bid placed",
            }
        },
    }),

    bid_update: tool({
        description:
            "Update your pending bid amount on an open job. You must be the bidder and the job must still be open. Optionally set providerWalletAddress (0x…) if your payout address changed—defaults to your currently connected wallet when omitted.",
        inputSchema: z.object({
            jobId: agentJobIdSchema,
            bidId: z.string().min(1),
            amount: z.string().describe('New bid in USDT (e.g. "50", "1.23")'),
            providerWalletAddress: z
                .string()
                .min(1)
                .optional()
                .describe("Kite wallet for escrow payout (optional; uses connected wallet if omitted)."),
        }),
        execute: async (input) => {
            const fromCtx = ctx.kiteWalletAddress?.trim()
            const payout =
                input.providerWalletAddress?.trim() || fromCtx || undefined
            const result = await updateBidAmount({
                userId,
                jobId: input.jobId,
                bidId: input.bidId,
                amount: input.amount,
                ...(payout ? { providerWalletAddress: payout } : {}),
            })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return { success: true as const, message: "Bid updated." }
        },
    }),

    bid_withdraw: tool({
        description:
            "Withdraw your pending bid on an open job before it is accepted.",
        inputSchema: z.object({
            jobId: agentJobIdSchema,
            bidId: z.string().min(1),
        }),
        execute: async (input) => {
            const result = await withdrawBid({ userId, ...input })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return { success: true as const, message: "Bid withdrawn." }
        },
    }),

    bid_accept: tool({
        description:
            "As client: accept one bid only after the job is published on Kite (acp_job_id). The provider’s bid must include their Kite payout address (they connect wallet when bidding). Updates DB to funded and returns onChain.steps: USDT approve, setProvider, setBudget, fund—then job_sync_chain. After wallet completes the sequence, reply briefly—user already saw each tx.",
        inputSchema: z.object({
            jobId: agentJobIdSchema,
            bidId: z.string().min(1),
        }),
        execute: async (input) => {
            const result = await acceptBid({ userId, ...input })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            const bundle = await getAcceptBidOnChainBundle({
                userId,
                jobId: input.jobId,
            })
            const j = await getAgentJobById(input.jobId)
            const ref = packJobToolRef(j)
            if (!bundle.ok) {
                return {
                    success: true as const,
                    ...ref,
                    message: `Bid accepted (DB); wallet steps unavailable: ${bundle.error}`,
                }
            }
            return {
                success: true as const,
                ...ref,
                onChain: bundle.bundle,
                message: ref.jobId
                    ? `Bid accepted for job #${ref.jobId}; funding runs in app wallet flow—job_sync_chain after.`
                    : "Bid accepted; funding runs in app wallet flow—job_sync_chain after.",
            }
        },
    }),

    bid_list_mine: tool({
        description:
            "List bids you placed and related job status. **jobId** is the published Job ID when set; **listingId** appears only for unpublished listings (for tool arguments).",
        inputSchema: z.object({}),
        execute: async () => {
            const rows = await listMyBids(userId)
            return {
                success: true as const,
                bids: rows.map((b) => ({
                    bidId: b.bidId,
                    jobId: b.publishedJobId ?? null,
                    ...(b.publishedJobId?.trim()
                        ? {}
                        : { listingId: b.jobId }),
                    amount: `${b.amount} ${b.currency}`,
                    bidStatus: b.bidStatus,
                    jobTitle: b.jobTitle,
                    jobStatus: b.jobStatus,
                    createdAt:
                        b.createdAt?.toISOString?.() ?? String(b.createdAt),
                })),
            }
        },
    }),

    bid_status: tool({
        description:
            "Check your bid status; optionally pass jobId to filter to one job. **jobId** / **listingId** on each entry follow the same rules as bid_list_mine.",
        inputSchema: z.object({
            jobId: agentJobIdSchema.optional(),
        }),
        execute: async ({ jobId }) => {
            const rows = await getBidStatusForUser({ userId, jobId })
            return {
                success: true as const,
                entries: rows.map((r) => ({
                    bidId: r.bidId,
                    jobId: r.publishedJobId ?? null,
                    ...(r.publishedJobId?.trim()
                        ? {}
                        : { listingId: r.jobId }),
                    amount: `${r.amount} ${r.currency}`,
                    bidStatus: r.bidStatus,
                    jobTitle: r.jobTitle,
                    jobStatus: r.jobStatus,
                })),
            }
        },
    }),
})
