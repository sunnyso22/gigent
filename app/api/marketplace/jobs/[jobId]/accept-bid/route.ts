import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { acceptBid } from "@/lib/agent-jobs/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    let body: { bidId?: string }
    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const bidId = body.bidId?.trim()
    if (!bidId) {
        return jsonError(400, "bidId is required")
    }

    const result = await acceptBid({
        userId: session.user.id,
        jobId,
        bidId,
    })

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({ ok: true })
}
