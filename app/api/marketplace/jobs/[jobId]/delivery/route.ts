import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { submitJobDelivery } from "@/lib/marketplace/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    let body: { deliveryPayload?: unknown }
    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const result = await submitJobDelivery({
        userId: session.user.id,
        jobId,
        deliveryPayload: body.deliveryPayload,
    })

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({ ok: true })
}
