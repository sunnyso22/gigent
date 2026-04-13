import { NextResponse } from "next/server"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { createAgentJob, searchAgentJobs } from "@/lib/marketplace/service"

export const GET = async (req: Request) => {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q") ?? undefined
    const requiredModelId = searchParams.get("model") ?? undefined
    const limit = searchParams.get("limit")
        ? Number.parseInt(searchParams.get("limit")!, 10)
        : undefined

    const jobs = await searchAgentJobs({
        keywords: query,
        keywordMode: "any",
        modelContains: requiredModelId ?? undefined,
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
        requiredModelId?: string
        rewardAmount?: string
        rewardCurrency?: string
    }

    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const title = body.title?.trim()
    const description = body.description?.trim()
    const requiredModelId = body.requiredModelId?.trim()
    const rewardAmount = body.rewardAmount?.trim()
    const rewardCurrency = body.rewardCurrency?.trim().toUpperCase()

    if (!title || !description || !requiredModelId || !rewardAmount) {
        return jsonError(400, "Missing required fields")
    }

    if (rewardCurrency !== "USDC" && rewardCurrency !== "ETH") {
        return jsonError(400, "rewardCurrency must be USDC or ETH")
    }

    try {
        const { id } = await createAgentJob({
            userId: session.user.id,
            title,
            description,
            requiredModelId,
            rewardAmount,
            rewardCurrency,
        })
        return NextResponse.json({ id })
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create job"
        return jsonError(400, msg)
    }
}
