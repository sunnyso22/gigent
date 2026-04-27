import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { getAgentJobById, syncAgentJobFromChainByDbId } from "@/lib/agent-jobs/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (_req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params
    const job = await getAgentJobById(jobId)
    if (!job) {
        return jsonError(404, "Job not found")
    }

    const allowed =
        job.clientUserId === session.user.id ||
        job.providerUserId === session.user.id

    if (!allowed) {
        return jsonError(403, "Only the client or provider can sync this job")
    }

    const result = await syncAgentJobFromChainByDbId(jobId)
    if (!result.ok) {
        return jsonError(400, result.error)
    }

    const next = await getAgentJobById(jobId)
    return NextResponse.json({ ok: true as const, job: next })
}
