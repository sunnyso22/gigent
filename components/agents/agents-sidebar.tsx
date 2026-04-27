"use client"

import * as React from "react"
import {
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { AgentListItem } from "@/components/agents/agents-chat-types"
import { formatSidebarHint } from "@/components/agents/agents-chat-helpers"

export const AgentsSidebar = ({
    searchQuery,
    setSearchQuery,
    onNewChat,
    conversationLoading,
    filteredAgents,
    agents,
    chatSessionId,
    openAgent,
}: {
    searchQuery: string
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>
    onNewChat: () => void
    conversationLoading: boolean
    filteredAgents: AgentListItem[]
    agents: AgentListItem[]
    chatSessionId: string
    openAgent: (agentId: string) => void | Promise<void>
}) => {
    const [sidebarOpen, setSidebarOpen] = React.useState(true)

    if (!sidebarOpen) {
        return (
            <aside
                className={cn(
                    "flex max-h-[40vh] w-10 shrink-0 flex-col items-center border-b border-border bg-sidebar py-2 text-sidebar-foreground",
                    "md:h-auto md:max-h-none md:border-r md:border-b-0"
                )}
            >
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Show agents sidebar"
                >
                    <IconLayoutSidebarLeftExpand className="size-4" />
                </Button>
            </aside>
        )
    }

    return (
        <aside
            className={cn(
                "flex max-h-[40vh] w-full shrink-0 flex-col border-b border-border bg-sidebar text-sidebar-foreground",
                "md:h-auto md:max-h-none md:w-64 md:min-w-64 md:border-r md:border-b-0"
            )}
        >
            <div className="flex justify-end px-2 pt-2 pb-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Hide agents sidebar"
                >
                    <IconLayoutSidebarLeftCollapse className="size-4" />
                </Button>
            </div>
            <div className="flex flex-col gap-2 px-3 pb-2">
                <Input
                    type="search"
                    placeholder="Search Agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 border-sidebar-border bg-sidebar-accent/60 px-2.5 text-xs"
                    aria-label="Search agents"
                />
                <Button
                    type="button"
                    variant="default"
                    size="lg"
                    className="h-10 w-full justify-center bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                    onClick={onNewChat}
                    disabled={conversationLoading}
                >
                    New Agent
                </Button>
            </div>
            <Separator className="bg-sidebar-border" />
            <ScrollArea className="min-h-0 flex-1 px-2 py-2">
                {filteredAgents.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[10px] leading-relaxed text-muted-foreground">
                        {agents.length === 0
                            ? "No saved agents yet. Send a message below to create one, or tap New Agent for a fresh thread."
                            : "No matches. Try a different search."}
                    </p>
                ) : (
                    <div className="flex flex-col gap-1">
                        {filteredAgents.map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => void openAgent(a.id)}
                                disabled={conversationLoading}
                                className={cn(
                                    "flex w-full flex-col gap-0.5 rounded-none border border-transparent px-2 py-2 text-left text-xs transition-colors",
                                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    "disabled:cursor-not-allowed disabled:opacity-50",
                                    chatSessionId === a.id &&
                                        "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
                                )}
                            >
                                <span className="truncate font-medium">
                                    {a.title?.trim()}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {formatSidebarHint(a.updatedAt)}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </aside>
    )
}
