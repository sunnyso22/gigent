"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import {
    IconArrowLeft,
    IconPaperclip,
    IconPlayerStop,
    IconSend,
} from "@tabler/icons-react"
import { DefaultChatTransport, type UIMessage } from "ai"
import {
    CHAT_MODELS,
    DEFAULT_CHAT_MODEL_ID,
    type ChatModelId,
} from "@/lib/agents/models"
import { SessionAccountMenu } from "@/components/layout/user-account-menu"
import { WorkspaceNav } from "@/components/layout/workspace-nav"
import { Loading, LoadingSpinner } from "@/components/ui/loading"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getMessageTextForDisplay } from "@/components/agents/agents-chat-helpers"
import useAgentChatOnchainEffects from "@/components/agents/use-agent-chat-onchain-effects"
import { KeySavedBanner } from "@/components/agents/key-saved-banner"
import { extractJobCreateOnChainFromMessages } from "@/lib/agents/extract-job-create-onchain"
import { extractLatestOnChainStepsFromMessages } from "@/lib/agents/extract-onchain-steps"

/** Updated in an effect so `DefaultChatTransport` can read the latest id without stale closures. */
let latestOutboundChatModelId: ChatModelId = DEFAULT_CHAT_MODEL_ID

export const AgentsChatCore = ({
    chatId,
    initialMessages,
    selectedModelId,
    setSelectedModelId,
    onPersisted,
    conversationLoading,
    hasApiKey,
    showToolLogs,
}: {
    chatId: string
    initialMessages: UIMessage[]
    selectedModelId: ChatModelId
    setSelectedModelId: React.Dispatch<React.SetStateAction<ChatModelId>>
    onPersisted: () => void
    conversationLoading: boolean
    hasApiKey: boolean
    showToolLogs: boolean
}) => {
    const transport = React.useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
                prepareSendMessagesRequest: ({
                    body,
                    messages,
                    id,
                    trigger,
                    messageId,
                }) => ({
                    body: {
                        ...body,
                        id,
                        messages,
                        trigger,
                        messageId,
                        model: latestOutboundChatModelId,
                    },
                }),
            }),
        []
    )

    const { messages, sendMessage, status, stop, error, clearError } = useChat({
        id: chatId,
        messages: initialMessages,
        transport,
    })

    const [draft, setDraft] = React.useState("")
    const [noKeyMessage, setNoKeyMessage] = React.useState<string | null>(null)

    const busy =
        conversationLoading || status === "submitted" || status === "streaming"

    React.useEffect(() => {
        if (hasApiKey) {
            setNoKeyMessage(null)
        }
    }, [hasApiKey])

    const onSend = async () => {
        const text = draft.trim()
        if (!text || busy) {
            return
        }
        if (!hasApiKey) {
            setNoKeyMessage(
                "Add your Vercel AI Gateway API key in Settings before sending messages."
            )
            return
        }
        setNoKeyMessage(null)
        clearError()
        setDraft("")
        await sendMessage({ text })
    }

    const firstUserSnippet = React.useMemo(() => {
        const first = messages.find((m) => m.role === "user")
        if (!first) {
            return null
        }
        const t = getMessageTextForDisplay(first, { showToolLogs }).trim()
        if (t.length <= 56) {
            return t
        }
        return `${t.slice(0, 56)}…`
    }, [messages, showToolLogs])

    React.useEffect(() => {
        latestOutboundChatModelId = selectedModelId
    }, [selectedModelId])

    const jobCreateOnChain = React.useMemo(
        () => extractJobCreateOnChainFromMessages(messages),
        [messages]
    )

    const onChainSteps = React.useMemo(
        () => extractLatestOnChainStepsFromMessages(messages),
        [messages]
    )

    useAgentChatOnchainEffects(jobCreateOnChain, onChainSteps)

    React.useEffect(() => {
        if (!hasApiKey) {
            return
        }
        if (conversationLoading) {
            return
        }
        if (messages.length === 0) {
            return
        }
        const title = firstUserSnippet ?? null
        const t = setTimeout(() => {
            void (async () => {
                try {
                    const res = await fetch(`/api/agents/${chatId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            messages,
                            title,
                            modelId: selectedModelId,
                        }),
                    })
                    if (res.ok) {
                        onPersisted()
                    }
                } catch (e) {
                    console.error("[agents-chat] persist", e)
                }
            })()
        }, 700)
        return () => clearTimeout(t)
    }, [
        hasApiKey,
        conversationLoading,
        messages,
        chatId,
        selectedModelId,
        firstUserSnippet,
        onPersisted,
    ])

    return (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {conversationLoading ? (
                <div
                    className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 backdrop-blur-[2px]"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <Loading
                        layout="section"
                        label="Loading conversation…"
                        className="text-foreground"
                    />
                </div>
            ) : null}
            <main
                className={cn(
                    "flex min-h-0 min-w-0 flex-1 flex-col",
                    conversationLoading && "pointer-events-none opacity-40"
                )}
                aria-hidden={conversationLoading}
            >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            asChild
                        >
                            <Link href="/" aria-label="Back to home">
                                <IconArrowLeft />
                            </Link>
                        </Button>
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate font-heading text-sm">
                                {firstUserSnippet ?? "New Agent"}
                            </span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <WorkspaceNav active="agents" />
                        <SessionAccountMenu />
                    </div>
                </header>

                <Suspense fallback={null}>
                    <KeySavedBanner />
                </Suspense>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                                <div className="flex flex-col gap-1">
                                    <p className="font-heading text-sm">
                                        How to start your agents?
                                    </p>
                                    <div className="max-w-sm text-xs text-muted-foreground">
                                        <ol className="list-inside list-decimal text-left">
                                            <li>
                                                Go to{" "}
                                                <Link
                                                    href="/settings"
                                                    className="text-foreground underline underline-offset-2"
                                                >
                                                    Settings
                                                </Link>
                                            </li>
                                            <li>Add your API key</li>
                                            <li>Connect your wallet</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            messages
                                .filter(
                                    (m) =>
                                        m.role === "user" ||
                                        m.role === "assistant"
                                )
                                .map((m) => (
                                    <div
                                        key={m.id}
                                        className={cn(
                                            "flex gap-3",
                                            m.role === "user"
                                                ? "flex-row-reverse"
                                                : "flex-row"
                                        )}
                                    >
                                        <Avatar
                                            size="sm"
                                            className="mt-0.5 shrink-0"
                                        >
                                            <AvatarFallback
                                                className={cn(
                                                    "text-[10px]",
                                                    m.role === "user"
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {m.role === "user"
                                                    ? "You"
                                                    : "AI"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div
                                            className={cn(
                                                "flex min-w-0 flex-1 flex-col gap-1 rounded-none border border-border bg-card px-3 py-2.5 text-xs leading-relaxed",
                                                m.role === "user" &&
                                                    "border-primary/25 bg-primary/5"
                                            )}
                                        >
                                            <p className="whitespace-pre-wrap">
                                                {getMessageTextForDisplay(m, {
                                                    showToolLogs,
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </ScrollArea>

                <footer className="shrink-0 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
                        {error || noKeyMessage ? (
                            <div className="mb-2 rounded-none border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
                                <p>{error?.message ?? noKeyMessage}</p>
                                {error?.message.includes("Vercel AI Gateway") ||
                                error?.message.includes("/settings") ||
                                noKeyMessage ? (
                                    <p className="mt-1.5">
                                        <Link
                                            href="/settings?needsKey=1"
                                            className="font-medium underline underline-offset-2"
                                        >
                                            Open Settings
                                        </Link>
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                        <div className="flex flex-col gap-0 rounded-none border border-border bg-card p-2 shadow-sm">
                            <Textarea
                                value={draft}
                                onChange={(e) => {
                                    setDraft(e.target.value)
                                    if (noKeyMessage) {
                                        setNoKeyMessage(null)
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        void onSend()
                                    }
                                }}
                                placeholder="Create a job, search for jobs, or place a bid…"
                                className="max-h-40 min-h-14 resize-none border-0 bg-transparent px-2 py-2 text-xs shadow-none focus-visible:ring-0"
                                aria-label="Message input"
                                disabled={busy}
                            />
                            <div className="flex flex-wrap items-center gap-2 border-t border-border px-1 pt-2 pb-1">
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label="Attach file"
                                        disabled={busy}
                                    >
                                        <IconPaperclip />
                                    </Button>
                                    {busy ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-label="Stop generation"
                                            onClick={() => void stop()}
                                        >
                                            <IconPlayerStop />
                                        </Button>
                                    ) : null}
                                </div>
                                <div className="flex h-8 min-w-0 flex-1 sm:max-w-xs">
                                    <Select
                                        value={selectedModelId}
                                        onValueChange={(v) =>
                                            setSelectedModelId(v as ChatModelId)
                                        }
                                        disabled={busy}
                                    >
                                        <SelectTrigger
                                            aria-label="Model"
                                            className={cn(
                                                "h-8 w-full min-w-0 flex-1 justify-between border-none bg-transparent text-foreground shadow-none",
                                                "rounded-none transition-colors hover:bg-muted",
                                                "focus:ring-0 focus-visible:ring-0",
                                                "disabled:cursor-not-allowed disabled:opacity-50",
                                                "data-[size=default]:h-8"
                                            )}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent
                                            position="popper"
                                            side="bottom"
                                            align="start"
                                            sideOffset={0}
                                            className={cn(
                                                "w-[var(--radix-select-trigger-width)] min-w-0 rounded-none border border-border p-0 shadow-md ring-0"
                                            )}
                                        >
                                            {CHAT_MODELS.map((m) => (
                                                <SelectItem
                                                    key={m.id}
                                                    value={m.id}
                                                    className="rounded-none"
                                                >
                                                    {m.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="ml-auto shrink-0"
                                    onClick={() => void onSend()}
                                    disabled={!draft.trim() || busy}
                                >
                                    {busy ? (
                                        <>
                                            <LoadingSpinner data-icon="inline-start" />
                                            Thinking
                                        </>
                                    ) : (
                                        <>
                                            Send
                                            <IconSend data-icon="inline-end" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                        <p className="mt-2 text-center text-[10px] text-muted-foreground">
                            Press Enter to send · Shift+Enter for a new line
                        </p>
                    </div>
                </footer>
            </main>
        </div>
    )
}
