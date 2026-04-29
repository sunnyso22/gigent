import { NextResponse } from "next/server"

import { syncJobFromChainForUser } from "@/lib/agent-jobs/participant-chain"
import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (_req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params
    const result = await syncJobFromChainForUser(session.user.id, jobId)

    if (!result.ok) {
        const status =
            result.error === "Job not found"
                ? 404
                : result.error ===
                    "Only the client or provider can sync this job"
                  ? 403
                  : 400
        return jsonError(status, result.error)
    }

    return NextResponse.json({ ok: true as const, job: result.job })
}
