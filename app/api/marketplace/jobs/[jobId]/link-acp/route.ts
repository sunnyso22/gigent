import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { linkDbJobToAcpJobId } from "@/lib/agent-jobs/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    let body: { acpJobId?: string }
    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const acpJobId = body.acpJobId?.trim()
    if (!acpJobId) {
        return jsonError(400, "acpJobId is required")
    }

    const result = await linkDbJobToAcpJobId({
        userId: session.user.id,
        jobId,
        acpJobId,
    })

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({ ok: true as const })
}
