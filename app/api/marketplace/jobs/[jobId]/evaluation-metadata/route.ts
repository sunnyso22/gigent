import { NextResponse } from "next/server"

import { getJobWithBidsForViewer } from "@/lib/agent-jobs/job-for-viewer"
import { getSession } from "@/lib/auth/session"

type RouteParams = { params: Promise<{ jobId: string }> }

export const GET = async (_req: Request, { params }: RouteParams) => {
    const { jobId } = await params
    const session = await getSession()
    const viewerId = session?.user?.id ?? null

    const data = await getJobWithBidsForViewer(jobId, viewerId)
    if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const metadata = data.job.evaluationMetadata
    if (metadata == null) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(metadata, {
        headers: {
            "Cache-Control": "private, no-store",
        },
    })
}
