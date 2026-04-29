"use client"

import * as React from "react"
import type { UIMessage } from "ai"
import {
    listAgentsAction,
    getAgentConversationAction,
} from "@/app/actions/agents"
import { isChatModelId, DEFAULT_CHAT_MODEL_ID, type ChatModelId } from "@/lib/agents/models"
import { AgentsChatCore } from "@/components/agents/agents-chat-core"
import { AgentsSidebar } from "@/components/agents/agents-sidebar"
import type { AgentListItem } from "@/components/agents/agents-chat-types"
import {
    SHOW_TOOL_LOGS_CHANGED_EVENT,
    readShowToolLogs,
} from "@/lib/agents/show-tool-logs-storage"

type AgentsProps = {
    hasApiKey: boolean
}

export const Agents = ({ hasApiKey }: AgentsProps) => {
    const [chatSession, setChatSession] = React.useState(() => ({
        id: crypto.randomUUID(),
        initialMessages: [] as UIMessage[],
    }))
    const [agents, setAgents] = React.useState<AgentListItem[]>([])
    const [searchQuery, setSearchQuery] = React.useState("")
    const [selectedModelId, setSelectedModelId] = React.useState<ChatModelId>(
        DEFAULT_CHAT_MODEL_ID
    )
    const [conversationLoading, setConversationLoading] = React.useState(false)
    const [showToolLogs, setShowToolLogs] = React.useState(false)
    const loadConversationGenRef = React.useRef(0)

    React.useEffect(() => {
        const sync = () => {
            setShowToolLogs(readShowToolLogs())
        }
        sync()
        window.addEventListener("storage", sync)
        window.addEventListener(SHOW_TOOL_LOGS_CHANGED_EVENT, sync)
        return () => {
            window.removeEventListener("storage", sync)
            window.removeEventListener(SHOW_TOOL_LOGS_CHANGED_EVENT, sync)
        }
    }, [])

    const refreshAgents = React.useCallback(async () => {
        const result = await listAgentsAction()
        if (!result.ok) {
            return
        }
        setAgents(result.agents)
    }, [])

    React.useEffect(() => {
        void refreshAgents()
    }, [refreshAgents])

    const onAgentsPersisted = React.useCallback(() => {
        void refreshAgents()
    }, [refreshAgents])

    const openAgent = async (agentId: string) => {
        if (agentId === chatSession.id) {
            return
        }
        const myGen = ++loadConversationGenRef.current
        setConversationLoading(true)
        try {
            const result = await getAgentConversationAction(agentId)
            if (myGen !== loadConversationGenRef.current) {
                return
            }
            if (!result.ok) {
                return
            }
            setChatSession({
                id: agentId,
                initialMessages: result.messages ?? [],
            })
            if (result.agent?.modelId && isChatModelId(result.agent.modelId)) {
                setSelectedModelId(result.agent.modelId)
            }
        } catch (e) {
            console.error("[agents] openAgent", e)
        } finally {
            if (myGen === loadConversationGenRef.current) {
                setConversationLoading(false)
            }
        }
    }

    const onNewChat = () => {
        loadConversationGenRef.current += 1
        setConversationLoading(false)
        setChatSession({
            id: crypto.randomUUID(),
            initialMessages: [],
        })
        setSelectedModelId(DEFAULT_CHAT_MODEL_ID)
    }

    const filteredAgents = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) {
            return agents
        }
        return agents.filter(
            (a) =>
                (a.title ?? "").toLowerCase().includes(q) ||
                a.id.toLowerCase().includes(q)
        )
    }, [agents, searchQuery])

    return (
        <div className="flex h-dvh min-h-0 w-full flex-col bg-background text-foreground md:flex-row">
            <AgentsSidebar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onNewChat={onNewChat}
                conversationLoading={conversationLoading}
                filteredAgents={filteredAgents}
                agents={agents}
                chatSessionId={chatSession.id}
                openAgent={openAgent}
            />

            <AgentsChatCore
                key={chatSession.id}
                chatId={chatSession.id}
                initialMessages={chatSession.initialMessages}
                selectedModelId={selectedModelId}
                setSelectedModelId={setSelectedModelId}
                onPersisted={onAgentsPersisted}
                conversationLoading={conversationLoading}
                hasApiKey={hasApiKey}
                showToolLogs={showToolLogs}
            />
        </div>
    )
}
