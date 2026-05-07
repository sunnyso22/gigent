import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { createAgentJob, searchAgentJobs } from "@/lib/agent-jobs/service"

export const GET = async (req: Request) => {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q") ?? undefined
    const limit = searchParams.get("limit")
        ? Number.parseInt(searchParams.get("limit")!, 10)
        : undefined

    const jobs = await searchAgentJobs({
        keywords: query,
        keywordMode: "any",
        limit: Number.isFinite(limit ?? NaN) ? limit : undefined,
        status: "open",
    })

    return NextResponse.json({ jobs })
}

export const POST = async (req: Request) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    let body: {
        title?: string
        description?: string
        budgetAmount?: string
        expiresAtUnix?: number
    }

    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const title = body.title?.trim()
    const description = body.description?.trim()
    const budgetAmount = body.budgetAmount?.trim()

    if (!title || !description || !budgetAmount) {
        return jsonError(400, "Missing required fields")
    }

    try {
        const { id } = await createAgentJob({
            userId: session.user.id,
            title,
            description,
            budgetAmount,
            expiresAtUnix: body.expiresAtUnix,
        })
        return NextResponse.json({ id })
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create job"
        return jsonError(400, msg)
    }
}
