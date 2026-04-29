import { tool } from "ai"
import { z } from "zod"

import { getAcceptBidOnChainBundle } from "@/lib/agent-jobs/onchain-tx-payloads"
import {
    acceptBid,
    listBidsForJob,
    listMyBids,
    placeBid,
    getBidStatusForUser,
    updateBidAmount,
    withdrawBid,
} from "@/lib/agent-jobs/service"

export const createBidsTools = (userId: string) => ({
    bid_list_for_job: tool({
        description: "List all bids on a job (client reviewing provider offers).",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const bids = await listBidsForJob(jobId)
            return {
                success: true as const,
                bids: bids.map((b) => ({
                    id: b.id,
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
            'Place a bid on an open job (USDT amount string, e.g. "50", "1.23"). One pending bid per job per user; use bid_update to change amount.',
        inputSchema: z.object({
            jobId: z.string().min(1),
            amount: z.string().describe('Bid in USDT (e.g. "50", "0.5")'),
        }),
        execute: async (input) => {
            const result = await placeBid({ userId, ...input })
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
            "Update your pending bid amount on an open job. You must be the bidder and the job must still be open.",
        inputSchema: z.object({
            jobId: z.string().min(1),
            bidId: z.string().min(1),
            amount: z.string().describe('New bid in USDT (e.g. "50", "1.23")'),
        }),
        execute: async (input) => {
            const result = await updateBidAmount({ userId, ...input })
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
            jobId: z.string().min(1),
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
            "As client: accept one bid only after the job is published on Kite (acp_job_id). Updates DB to funded and returns onChain.steps: USDT approve, setProvider, setBudget, fund—then job_sync_chain.",
        inputSchema: z.object({
            jobId: z.string().min(1),
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
            if (!bundle.ok) {
                return {
                    success: true as const,
                    jobId: input.jobId,
                    message: `Bid accepted in the app (funded). On-chain bundle unavailable: ${bundle.error}`,
                }
            }
            return {
                success: true as const,
                jobId: input.jobId,
                onChain: bundle.bundle,
                message: `Bid accepted in the app. Confirm ${bundle.bundle.steps.length} wallet transactions on Kite (approve USDT, setProvider, setBudget, fund), then use job_sync_chain.`,
            }
        },
    }),

    bid_list_mine: tool({
        description: "List bids you placed and related job status.",
        inputSchema: z.object({}),
        execute: async () => {
            const rows = await listMyBids(userId)
            return {
                success: true as const,
                bids: rows.map((b) => ({
                    ...b,
                    createdAt:
                        b.createdAt?.toISOString?.() ?? String(b.createdAt),
                })),
            }
        },
    }),

    bid_status: tool({
        description:
            "Check your bid status; optionally pass jobId to filter to one job.",
        inputSchema: z.object({
            jobId: z.string().optional(),
        }),
        execute: async ({ jobId }) => {
            const rows = await getBidStatusForUser({ userId, jobId })
            return { success: true as const, entries: rows }
        },
    }),
})
