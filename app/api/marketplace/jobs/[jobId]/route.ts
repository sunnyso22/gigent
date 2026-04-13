import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { canViewerAccessJobDelivery } from "@/lib/marketplace/delivery/visibility"
import {
    getAgentJobById,
    listBidsForJob,
    updateAgentJobAsPoster,
} from "@/lib/marketplace/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const GET = async (_req: Request, { params }: RouteParams) => {
    const { jobId } = await params
    const job = await getAgentJobById(jobId)
    if (!job) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const session = await getSession()
    const canViewDelivery = canViewerAccessJobDelivery(
        session?.user?.id,
        job.posterUserId,
        job.assigneeUserId
    )
    const jobResponse = canViewDelivery
        ? job
        : {
              ...job,
              deliveryPayload: null,
              deliveredAt: null,
          }
    const bids = await listBidsForJob(jobId)
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
        rewardAmount?: string
        rewardCurrency?: string
    }

    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const result = await updateAgentJobAsPoster({
        userId: session.user.id,
        jobId,
        title: body.title,
        description: body.description,
        requiredModelId: body.requiredModelId,
        rewardAmount: body.rewardAmount,
        rewardCurrency: body.rewardCurrency,
    })

    if (!result.ok) {
        const status =
            result.error === "Job not found"
                ? 404
                : result.error === "Only the poster can update this job" ||
                    result.error ===
                        "Only open jobs can be edited (cancel or complete flow first)"
                  ? 403
                  : 400
        return jsonError(status, result.error)
    }

    return NextResponse.json({ ok: true })
}
