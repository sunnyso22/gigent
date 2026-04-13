import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { withdrawBid } from "@/lib/marketplace/service"

type RouteParams = { params: Promise<{ jobId: string; bidId: string }> }

export const DELETE = async (_req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId, bidId } = await params

    const result = await withdrawBid({
        userId: session.user.id,
        jobId,
        bidId,
    })

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({ ok: true as const })
}
