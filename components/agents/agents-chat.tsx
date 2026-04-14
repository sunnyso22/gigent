"use client"

import * as React from "react"
import type { UIMessage } from "ai"
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
    const loadConversationAbortRef = React.useRef<AbortController | null>(null)

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
        const res = await fetch("/api/agents")
        if (!res.ok) {
            return
        }
        const data = (await res.json()) as { agents: AgentListItem[] }
        setAgents(data.agents)
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
        loadConversationAbortRef.current?.abort()
        const ac = new AbortController()
        loadConversationAbortRef.current = ac
        setConversationLoading(true)
        try {
            const res = await fetch(`/api/agents/${agentId}`, {
                signal: ac.signal,
            })
            if (!res.ok) {
                return
            }
            const data = (await res.json()) as {
                agent: { modelId: string | null }
                messages: UIMessage[]
            }
            if (ac.signal.aborted) {
                return
            }
            setChatSession({
                id: agentId,
                initialMessages: data.messages ?? [],
            })
            if (data.agent?.modelId && isChatModelId(data.agent.modelId)) {
                setSelectedModelId(data.agent.modelId)
            }
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return
            }
            console.error("[agents] openAgent", e)
        } finally {
            if (loadConversationAbortRef.current === ac) {
                setConversationLoading(false)
                loadConversationAbortRef.current = null
            }
        }
    }

    const onNewChat = () => {
        loadConversationAbortRef.current?.abort()
        loadConversationAbortRef.current = null
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
