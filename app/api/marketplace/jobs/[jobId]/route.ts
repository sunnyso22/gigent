import { NextResponse } from "next/server"

import { getJobWithBidsForViewer } from "@/lib/agent-jobs/job-for-viewer"
import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { updateAgentJobAsClient } from "@/lib/agent-jobs/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const GET = async (_req: Request, { params }: RouteParams) => {
    const { jobId } = await params
    const session = await getSession()
    const viewerId = session?.user?.id ?? null

    const data = await getJobWithBidsForViewer(jobId, viewerId)
    if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ job: data.job, bids: data.bids })
}

export const PATCH = async (req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    let body: {
        title?: string
        description?: string
        requiredModelId?: string
        budgetAmount?: string
    }

    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const result = await updateAgentJobAsClient({
        userId: session.user.id,
        jobId,
        title: body.title,
        description: body.description,
        requiredModelId: body.requiredModelId,
        budgetAmount: body.budgetAmount,
    })

    if (!result.ok) {
        const status =
            result.error === "Job not found"
                ? 404
                : result.error === "Only the client can update this job" ||
                    result.error ===
                        "Only open jobs can be edited before an on-chain job exists"
                  ? 403
                  : 400
        return jsonError(status, result.error)
    }

    if (!result.applied) {
        return NextResponse.json({
            ok: true as const,
            applied: false as const,
            guidance: result.guidance,
        })
    }

    return NextResponse.json({ ok: true as const, applied: true as const })
}
