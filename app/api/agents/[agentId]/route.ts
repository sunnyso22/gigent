import { NextResponse } from "next/server"
import type { UIMessage } from "ai"

import { agentConversationPayload } from "@/lib/agents/server-payloads"
import { upsertAgentWithMessages } from "@/lib/agents/service"
import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"

type RouteCtx = { params: Promise<{ agentId: string }> }

export const GET = async (_req: Request, ctx: RouteCtx) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const { agentId } = await ctx.params
    const data = await agentConversationPayload(session.user.id, agentId)
    if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(data)
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
