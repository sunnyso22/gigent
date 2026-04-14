import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { confirmJobCompletion } from "@/lib/agent-jobs/service"

type RouteParams = { params: Promise<{ jobId: string }> }

export const POST = async (_req: Request, { params }: RouteParams) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { jobId } = await params

    const result = await confirmJobCompletion({
        userId: session.user.id,
        jobId,
    })

    if (!result.ok) {
        return jsonError(400, result.error)
    }

    return NextResponse.json({ ok: true })
}
