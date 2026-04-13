import { NextResponse } from "next/server"
import type { UIMessage } from "ai"

import {
    getAgentForUser,
    getAgentMessages,
    upsertAgentWithMessages,
} from "@/lib/agents/service"
import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"

type RouteCtx = { params: Promise<{ agentId: string }> }

export const GET = async (_req: Request, ctx: RouteCtx) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { agentId } = await ctx.params
    const agent = await getAgentForUser(session.user.id, agentId)
    if (!agent) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const messages = (await getAgentMessages(session.user.id, agentId)) ?? []

    return NextResponse.json({
        agent: {
            id: agent.id,
            title: agent.title,
            modelId: agent.modelId,
            updatedAt: agent.updatedAt.toISOString(),
        },
        messages,
    })
}

export const PUT = async (req: Request, ctx: RouteCtx) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { agentId } = await ctx.params

    let body: {
        messages?: UIMessage[]
        title?: string | null
        modelId?: string | null
    }

    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const { messages, title, modelId } = body
    if (!Array.isArray(messages)) {
        return jsonError(400, "messages must be an array")
    }

    const result = await upsertAgentWithMessages({
        userId: session.user.id,
        agentId,
        title: title ?? null,
        modelId: modelId ?? null,
        messages,
    })

    if (!result.ok) {
        if (result.error === "forbidden") {
            return jsonError(403, "Forbidden")
        }
        if (result.error === "no_api_key") {
            return jsonError(
                403,
                "Add your Vercel AI Gateway API key in /settings before saving conversations."
            )
        }
        return jsonError(400, "Invalid messages")
    }

    return NextResponse.json({ ok: true })
}
