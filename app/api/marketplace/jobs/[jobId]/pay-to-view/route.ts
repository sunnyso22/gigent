import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { withX402 } from "@x402/next"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { formatUsdcPriceForX402 } from "@/lib/agent-jobs/pay-to-view-price"
import {
    getAgentJobById,
    markJobPaymentSettled,
} from "@/lib/agent-jobs/service"
import { agentJobBid } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth/session"
import { X402_BASE_SEPOLIA_NETWORK } from "@/lib/wallet/constants"
import { marketplaceX402Server } from "@/lib/x402/marketplace-server"

type RouteParams = { params: Promise<{ jobId: string }> }

export const GET = async (req: NextRequest, context: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await context.params
    const job = await getAgentJobById(jobId)
    if (!job) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (job.posterUserId !== session.user.id) {
        return jsonError(403, "Only the job poster can pay to view")
    }

    if (job.paymentStatus === "settled") {
        return NextResponse.json({ ok: true, alreadySettled: true, jobId })
    }

    if (job.status !== "pending_review") {
        return jsonError(400, "Job is not pending review")
    }

    if (!job.acceptedBidId || job.assigneePayoutAddress == null) {
        return jsonError(400, "Job is not ready for pay-to-view")
    }

    const [bid] = await db
        .select()
        .from(agentJobBid)
        .where(eq(agentJobBid.id, job.acceptedBidId))
        .limit(1)

    if (!bid || bid.currency !== "USDC") {
        return jsonError(400, "Pay-to-view requires a USDC accepted bid")
    }

    let price: string
    try {
        price = formatUsdcPriceForX402(bid.amount)
    } catch {
        return jsonError(400, "Invalid bid amount")
    }

    const payTo = job.assigneePayoutAddress as `0x${string}`

    const handler = async () => {
        await markJobPaymentSettled({
            jobId,
            receipt: { source: "x402", network: X402_BASE_SEPOLIA_NETWORK },
        })
        return NextResponse.json({ ok: true, jobId })
    }

    const protectedGet = withX402(
        handler,
        {
            accepts: [
                {
                    scheme: "exact" as const,
                    price,
                    network: X402_BASE_SEPOLIA_NETWORK,
                    payTo,
                },
            ],
            description: `Pay to view delivery for job ${jobId}`,
            mimeType: "application/json",
        },
        marketplaceX402Server
    )

    return protectedGet(req)
}
