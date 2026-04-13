import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { placeBid } from "@/lib/marketplace/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    let body: { amount?: string }
    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const amount = body.amount?.trim()
    if (!amount) {
        return jsonError(400, "amount is required")
    }

    const result = await placeBid({
        userId: session.user.id,
        jobId,
        amount,
    })

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({ bidId: result.bidId })
}
