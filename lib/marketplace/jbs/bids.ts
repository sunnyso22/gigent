import { tool } from "ai"
import { z } from "zod"

import {
    acceptBid,
    listBidsForJob,
    listMyBids,
    placeBid,
    getBidStatusForUser,
    withdrawBid,
} from "@/lib/marketplace/service"

export const createBidsTools = (userId: string) => ({
    marketplace_listBidsOnJob: tool({
        description:
            "List all bids on a job (useful for the poster to review offers).",
        inputSchema: z.object({ jobId: z.string().min(1) }),
        execute: async ({ jobId }) => {
            const bids = await listBidsForJob(jobId)
            return {
                success: true as const,
                bids: bids.map((b) => ({
                    id: b.id,
                    bidderName: b.bidderName,
                    amount: `${b.amount} ${b.currency}`,
                    status: b.status,
                    createdAt: b.createdAt?.toISOString?.() ?? String(b.createdAt),
                })),
            }
        },
    }),

    marketplace_placeBid: tool({
        description:
            "Place a bid on an open job with your proposed amount (positive decimal string, same currency as the job). Each user can have at most one bid per job; withdraw first to change your offer.",
        inputSchema: z.object({
            jobId: z.string().min(1),
            amount: z.string().describe(
                "Your bid as a decimal string (any positive amount you propose)"
            ),
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

    marketplace_withdrawBid: tool({
        description:
            "Withdraw your pending bid on an open job before it is accepted. You must be the bidder; only pending bids on jobs that are still open can be removed.",
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

    marketplace_acceptBid: tool({
        description:
            "Accept one bid as the job poster. All other pending bids on that job are rejected automatically.",
        inputSchema: z.object({
            jobId: z.string().min(1),
            bidId: z.string().min(1),
        }),
        execute: async (input) => {
            const result = await acceptBid({ userId, ...input })
            if (!result.ok) {
                return { success: false as const, error: result.error }
            }
            return { success: true as const, message: "Bid accepted; job assigned." }
        },
    }),

    marketplace_listMyBids: tool({
        description: "List bids you placed and related job status.",
        inputSchema: z.object({}),
        execute: async () => {
            const rows = await listMyBids(userId)
            return {
                success: true as const,
                bids: rows.map((b) => ({
                    ...b,
                    createdAt: b.createdAt?.toISOString?.() ?? String(b.createdAt),
                })),
            }
        },
    }),

    marketplace_myBidStatus: tool({
        description:
            "Check status of your bids; optionally filter by job id to see if your bid was accepted.",
        inputSchema: z.object({
            jobId: z.string().optional(),
        }),
        execute: async ({ jobId }) => {
            const rows = await getBidStatusForUser({ userId, jobId })
            return { success: true as const, entries: rows }
        },
    }),
})
