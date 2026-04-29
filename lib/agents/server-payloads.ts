import type { UIMessage } from "ai"

import {
    getAgentForUser,
    listAgentMessagesForAgentId,
    listUserAgents,
} from "@/lib/agents/service"

export const agentsListPayload = async (userId: string) => {
    const agents = await listUserAgents(userId)
    return {
        agents: agents.map((a) => ({
            id: a.id,
            title: a.title,
            modelId: a.modelId,
            updatedAt: a.updatedAt.toISOString(),
        })),
    }
}

export const agentConversationPayload = async (
    userId: string,
    agentId: string
): Promise<{
    agent: {
        id: string
        title: string | null
        modelId: string | null
        updatedAt: string
    }
    messages: UIMessage[]
} | null> => {
    const agent = await getAgentForUser(userId, agentId)
    if (!agent) {
        return null
    }
    const messages = await listAgentMessagesForAgentId(agentId)
    return {
        agent: {
            id: agent.id,
            title: agent.title,
            modelId: agent.modelId,
            updatedAt: agent.updatedAt.toISOString(),
        },
        messages,
    }
}
