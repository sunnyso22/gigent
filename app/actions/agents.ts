"use server"

import type { UIMessage } from "ai"

import {
    agentConversationPayload,
    agentsListPayload,
} from "@/lib/agents/server-payloads"
import { upsertAgentWithMessages } from "@/lib/agents/service"
import { getSession } from "@/lib/auth/session"

export const listAgentsAction = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "unauthorized" as const }
    }
    const data = await agentsListPayload(session.user.id)
    return { ok: true as const, agents: data.agents }
}

export const getAgentConversationAction = async (agentId: string) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "unauthorized" as const }
    }
    const data = await agentConversationPayload(session.user.id, agentId)
    if (!data) {
        return { ok: false as const, error: "not_found" as const }
    }
    return { ok: true as const, ...data }
}

export const saveAgentConversationAction = async (input: {
    agentId: string
    messages: UIMessage[]
    title: string | null
    modelId: string | null
}) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return { ok: false as const, error: "unauthorized" as const }
    }

    const { agentId, messages, title, modelId } = input
    if (!Array.isArray(messages)) {
        return { ok: false as const, error: "invalid_messages" as const }
    }

    const result = await upsertAgentWithMessages({
        userId: session.user.id,
        agentId,
        title,
        modelId,
        messages,
    })

    if (!result.ok) {
        if (result.error === "forbidden") {
            return { ok: false as const, error: "forbidden" as const }
        }
        if (result.error === "no_api_key") {
            return { ok: false as const, error: "no_api_key" as const }
        }
        return { ok: false as const, error: "invalid_messages" as const }
    }

    return { ok: true as const }
}
