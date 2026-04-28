"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import {
    IconArrowLeft,
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

const JOB_CREATE_TEMPLATE =
    "Create a job with below requirements:\n- Title: \n- Description: \n- Model: \n- Budget: \n- Expiry date:"

const JOB_CREATE_CARET_INDEX =
    JOB_CREATE_TEMPLATE.indexOf("- Title: ") + "- Title: ".length

const PLACE_BID_TEMPLATE =
    "Place a bid on below job:\n- Job name: \n- Client: \n- Amount: "

const PLACE_BID_CARET_INDEX =
    PLACE_BID_TEMPLATE.indexOf("- Job name: ") + "- Job name: ".length

const ACCEPT_BID_TEMPLATE =
    "Accept the bid from:\n- Provider: \n- Amount: "

const ACCEPT_BID_CARET_INDEX =
    ACCEPT_BID_TEMPLATE.indexOf("- Provider: ") + "- Provider: ".length

const LIST_ALL_BIDS_PROMPT = "List all bids of this job"

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
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const [noKeyMessage, setNoKeyMessage] = React.useState<string | null>(null)
    const [stoppedByUser, setStoppedByUser] = React.useState(false)

    const isChatGenerating =
        status === "submitted" || status === "streaming"
    const composerBusy = conversationLoading || isChatGenerating

    React.useEffect(() => {
        if (hasApiKey) {
            setNoKeyMessage(null)
        }
    }, [hasApiKey])

    const insertDraftTemplate = (
        template: string,
        caretIndex: number
    ) => {
        setDraft(template)
        if (noKeyMessage) {
            setNoKeyMessage(null)
        }
        requestAnimationFrame(() => {
            const el = textareaRef.current
            if (el) {
                el.focus()
                el.setSelectionRange(caretIndex, caretIndex)
            }
        })
    }

    const insertJobTemplate = () =>
        insertDraftTemplate(JOB_CREATE_TEMPLATE, JOB_CREATE_CARET_INDEX)

    const insertBidTemplate = () =>
        insertDraftTemplate(PLACE_BID_TEMPLATE, PLACE_BID_CARET_INDEX)

    const insertAcceptBidTemplate = () =>
        insertDraftTemplate(ACCEPT_BID_TEMPLATE, ACCEPT_BID_CARET_INDEX)

    const submitUserMessage = async (
        text: string,
        clearDraftAfter: boolean
    ) => {
        const t = text.trim()
        if (!t || composerBusy) {
            return
        }
        if (!hasApiKey) {
            setNoKeyMessage(
                "Add your Vercel AI Gateway API key in Settings before sending messages."
            )
            return
        }
        setNoKeyMessage(null)
        setStoppedByUser(false)
        clearError()
        if (clearDraftAfter) {
            setDraft("")
        }
        await sendMessage({ text: t })
    }

    const onSend = async () => submitUserMessage(draft, true)

    const submitListAllBidsPrompt = async () =>
        submitUserMessage(LIST_ALL_BIDS_PROMPT, false)

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

    const displayMessages = React.useMemo(
        () =>
            messages.filter(
                (m) => m.role === "user" || m.role === "assistant"
            ),
        [messages]
    )

    const showStandAloneThinking = React.useMemo(
        () =>
            isChatGenerating &&
            displayMessages.length > 0 &&
            displayMessages.at(-1)!.role === "user",
        [isChatGenerating, displayMessages]
    )

    const chatContentRef = React.useRef<HTMLDivElement | null>(null)
    const [showComposerFade, setShowComposerFade] = React.useState(false)

    const updateComposerFade = React.useCallback(() => {
        const el = chatContentRef.current
        if (!el) {
            return
        }
        const viewport = el.closest(
            "[data-slot=scroll-area-viewport]"
        ) as HTMLElement | null
        if (!viewport) {
            return
        }
        const distanceFromBottom =
            viewport.scrollHeight -
            viewport.scrollTop -
            viewport.clientHeight
        setShowComposerFade(distanceFromBottom > 32)
    }, [])

    const lastMessageId = messages.at(-1)?.id
    const scrollChatToBottom = React.useCallback(
        (options?: { force?: boolean }) => {
            const el = chatContentRef.current
            if (!el) {
                return
            }
            const viewport = el.closest(
                "[data-slot=scroll-area-viewport]"
            ) as HTMLElement | null
            if (!viewport) {
                return
            }
            const force = options?.force === true
            if (!force) {
                const distanceFromBottom =
                    viewport.scrollHeight -
                    viewport.scrollTop -
                    viewport.clientHeight
                if (distanceFromBottom > 120) {
                    return
                }
            }
            viewport.scrollTop = viewport.scrollHeight
            updateComposerFade()
        },
        [updateComposerFade]
    )

    /** New messages, status changes, and layout markers — force scroll. */
    React.useLayoutEffect(() => {
        if (messages.length === 0) {
            setShowComposerFade(false)
            return
        }
        scrollChatToBottom({ force: true })
    }, [
        messages.length,
        lastMessageId,
        showStandAloneThinking,
        status,
        isChatGenerating,
        stoppedByUser,
        conversationLoading,
        scrollChatToBottom,
    ])

    React.useEffect(() => {
        const el = chatContentRef.current
        if (!el) {
            return
        }
        const viewport = el.closest(
            "[data-slot=scroll-area-viewport]"
        ) as HTMLElement | null
        if (!viewport) {
            return
        }
        updateComposerFade()
        viewport.addEventListener("scroll", updateComposerFade, {
            passive: true,
        })
        const ro = new ResizeObserver(updateComposerFade)
        ro.observe(viewport)
        ro.observe(el)
        return () => {
            viewport.removeEventListener("scroll", updateComposerFade)
            ro.disconnect()
        }
    }, [messages.length, lastMessageId, updateComposerFade])

    /** Track streaming / dynamic height: only scroll if user is already near the bottom. */
    React.useEffect(() => {
        const el = chatContentRef.current
        if (!el) {
            return
        }
        const ro = new ResizeObserver(() => {
            scrollChatToBottom({ force: false })
        })
        ro.observe(el)
        return () => {
            ro.disconnect()
        }
    }, [scrollChatToBottom])

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

                <div className="relative min-h-0 flex-1">
                    <ScrollArea className="h-full min-h-0">
                        <div
                            ref={chatContentRef}
                            className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8"
                        >
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
                                            <li>Link your wallet address</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {displayMessages.map((m, i) => {
                                    const isLast = i === displayMessages.length - 1
                                    const text = getMessageTextForDisplay(m, {
                                        showToolLogs,
                                    })
                                    const isPendingEmptyAssistant =
                                        isChatGenerating &&
                                        m.role === "assistant" &&
                                        isLast &&
                                        text.trim().length === 0
                                    const isStoppedEmptyAssistant =
                                        m.role === "assistant" &&
                                        isLast &&
                                        !isChatGenerating &&
                                        stoppedByUser &&
                                        text.trim().length === 0
                                    if (isStoppedEmptyAssistant) {
                                        return (
                                            <p
                                                key={m.id}
                                                className="text-xs text-muted-foreground"
                                            >
                                                You stopped the response.
                                            </p>
                                        )
                                    }
                                    return (
                                        <div
                                            key={m.id}
                                            className={cn(
                                                "flex w-full min-w-0",
                                                m.role === "user"
                                                    ? "justify-end"
                                                    : "justify-start"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "flex min-w-0 flex-col gap-1 rounded-none border border-border bg-card px-3 py-2.5 text-xs leading-relaxed",
                                                    m.role === "user" &&
                                                        "max-w-[min(100%,28rem)] border-primary/25 bg-primary/5",
                                                    m.role === "assistant" &&
                                                        "w-full min-w-0"
                                                )}
                                            >
                                                {isPendingEmptyAssistant ? (
                                                    <p
                                                        className="flex items-center gap-2 text-muted-foreground"
                                                        role="status"
                                                        aria-live="polite"
                                                    >
                                                        <LoadingSpinner className="size-3.5 shrink-0" />
                                                        <span>Thinking</span>
                                                    </p>
                                                ) : (
                                                    <p className="whitespace-pre-wrap">
                                                        {text}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {stoppedByUser &&
                                !isChatGenerating &&
                                displayMessages.length > 0 &&
                                displayMessages.at(-1)!.role === "user" ? (
                                    <p
                                        className="text-xs text-muted-foreground"
                                        key="user-stopped-hint"
                                    >
                                        You stopped the response.
                                    </p>
                                ) : null}
                                {showStandAloneThinking ? (
                                    <div
                                        key="assistant-thinking"
                                        className="w-full min-w-0"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        <div
                                            className="flex min-w-0 flex-col gap-1 rounded-none border border-border bg-card px-3 py-2.5 text-xs leading-relaxed"
                                        >
                                            <p className="flex items-center gap-2 text-muted-foreground">
                                                <LoadingSpinner className="size-3.5 shrink-0" />
                                                <span>Thinking</span>
                                            </p>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        )}
                        </div>
                    </ScrollArea>
                    <div
                        aria-hidden
                        className={cn(
                            "pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-16 bg-gradient-to-t from-background via-background/90 to-transparent",
                            "transition-opacity duration-300 ease-out",
                            showComposerFade ? "opacity-100" : "opacity-0"
                        )}
                    />
                </div>

                <footer className="shrink-0 bg-background/80 px-4 py-3 backdrop-blur">
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
                        <div className="flex flex-wrap items-center gap-2 px-0.5">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                onClick={insertJobTemplate}
                                disabled={composerBusy}
                            >
                                Create a job
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                onClick={insertBidTemplate}
                                disabled={composerBusy}
                            >
                                Place a bid
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                onClick={() => void submitListAllBidsPrompt()}
                                disabled={composerBusy}
                            >
                                List all bids
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                onClick={insertAcceptBidTemplate}
                                disabled={composerBusy}
                            >
                                Accept a bid
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2 rounded-none border border-border bg-card p-2 shadow-sm">
                            <Textarea
                                ref={textareaRef}
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
                                placeholder="Create a job, place a bid, or finish the job…"
                                className="max-h-40 min-h-14 resize-none border-0 bg-transparent px-2 py-2 text-xs shadow-none focus-visible:ring-0"
                                aria-label="Message input"
                                disabled={composerBusy}
                            />
                            <div className="flex flex-wrap items-center gap-2 px-1 pb-0.5">
                                <div className="flex h-8 min-w-0 max-w-[14rem] shrink-0">
                                    <Select
                                        value={selectedModelId}
                                        onValueChange={(v) =>
                                            setSelectedModelId(v as ChatModelId)
                                        }
                                        disabled={composerBusy}
                                    >
                                        <SelectTrigger
                                            aria-label="Model"
                                            className={cn(
                                                "h-8 w-full min-w-0 justify-between border-none bg-transparent text-foreground shadow-none",
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
                                {isChatGenerating ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className="ml-auto shrink-0"
                                        aria-label="Stop generation"
                                        onClick={() => {
                                            setStoppedByUser(true)
                                            void stop()
                                        }}
                                    >
                                        Stop
                                        <IconPlayerStop data-icon="inline-start" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="ml-auto shrink-0"
                                        onClick={() => void onSend()}
                                        disabled={
                                            !draft.trim() || composerBusy
                                        }
                                    >
                                        Send
                                        <IconSend data-icon="inline-end" />
                                    </Button>
                                )}
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
