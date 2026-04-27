import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import {
    canViewerAccessJobDelivery,
    shouldHideDeliveryFromClientUntilOnChainSubmit,
} from "@/lib/agent-jobs/delivery/visibility"
import {
    getAgentJobById,
    listBidsForJob,
    updateAgentJobAsClient,
} from "@/lib/agent-jobs/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const GET = async (_req: Request, { params }: RouteParams) => {
    const { jobId } = await params
    const job = await getAgentJobById(jobId)
    if (!job) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const [session, bids] = await Promise.all([
        getSession(),
        listBidsForJob(jobId),
    ])
    const canViewDelivery = canViewerAccessJobDelivery(
        session?.user?.id,
        job.clientUserId,
        job.providerUserId
    )

    let jobResponse = canViewDelivery
        ? job
        : {
              ...job,
              deliveryPayload: null,
              submittedAt: null,
          }

    if (
        canViewDelivery &&
        session?.user?.id &&
        shouldHideDeliveryFromClientUntilOnChainSubmit({
            viewerUserId: session.user.id,
            clientUserId: job.clientUserId,
            acpJobId: job.acpJobId,
            acpStatus: job.acpStatus,
        })
    ) {
        jobResponse = {
            ...job,
            deliveryPayload: null,
            submittedAt: null,
        }
    }

    return NextResponse.json({ job: jobResponse, bids })
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
