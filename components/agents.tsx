"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import {
    IconLoader2,
    IconMoon,
    IconPaperclip,
    IconPlayerStop,
    IconSend,
    IconSparkles,
    IconSun,
} from "@tabler/icons-react"
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai"
import { useTheme } from "next-themes"

import {
    CHAT_MODELS,
    DEFAULT_CHAT_MODEL_ID,
    type ChatModelId,
} from "@/lib/chat-models"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** Updated in an effect so `DefaultChatTransport` can read the latest id without stale closures. */
let latestOutboundChatModelId: ChatModelId = DEFAULT_CHAT_MODEL_ID

type ChatSession = {
    id: string
    title: string
    hint: string
}

const sessions: ChatSession[] = [
    {
        id: "1",
        title: "Product roadmap ideas",
        hint: "2h ago",
    },
    {
        id: "2",
        title: "API error handling patterns",
        hint: "Yesterday",
    },
    {
        id: "3",
        title: "Draft: onboarding email",
        hint: "Mon",
    },
]

const getMessageText = (message: UIMessage) =>
    message.parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join("")

export const Agents = () => {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)
    const [draft, setDraft] = React.useState("")
    const [chatId, setChatId] = React.useState(() => crypto.randomUUID())
    const [selectedModelId, setSelectedModelId] = React.useState<ChatModelId>(
        DEFAULT_CHAT_MODEL_ID
    )
    const [activeSidebarId, setActiveSidebarId] = React.useState(
        sessions[0]?.id ?? ""
    )

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
        transport,
    })

    const busy = status === "submitted" || status === "streaming"

    const onSend = async () => {
        const text = draft.trim()
        if (!text || busy) {
            return
        }
        clearError()
        setDraft("")
        await sendMessage({ text })
    }

    const onNewChat = () => {
        setChatId(crypto.randomUUID())
        setActiveSidebarId("new")
        clearError()
    }

    const firstUserSnippet = React.useMemo(() => {
        const first = messages.find((m) => m.role === "user")
        if (!first) {
            return null
        }
        const t = getMessageText(first).trim()
        if (t.length <= 56) {
            return t
        }
        return `${t.slice(0, 56)}…`
    }, [messages])

    React.useEffect(() => {
        latestOutboundChatModelId = selectedModelId
    }, [selectedModelId])

    React.useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <div className="flex h-dvh min-h-0 w-full flex-col bg-background text-foreground md:flex-row">
            <aside
                className={cn(
                    "flex max-h-[40vh] w-full shrink-0 flex-col border-b border-border bg-sidebar text-sidebar-foreground",
                    "md:h-auto md:max-h-none md:w-64 md:min-w-64 md:border-r md:border-b-0"
                )}
            >
                <div className="flex items-center gap-2 px-3 py-3">
                    <div className="flex size-8 items-center justify-center rounded-none border border-sidebar-border bg-sidebar-accent">
                        <IconSparkles className="text-sidebar-primary" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-heading text-sm text-sidebar-foreground">
                            Agents
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                            Workspace
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 px-3 pb-2">
                    <Input
                        type="search"
                        placeholder="Search Agents..."
                        className="h-8 border-sidebar-border bg-sidebar-accent/60 px-2.5 text-xs"
                        aria-label="Search agents"
                    />
                    <Button
                        type="button"
                        variant="default"
                        size="lg"
                        className="h-10 w-full justify-center bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                        onClick={onNewChat}
                    >
                        New Agent
                    </Button>
                </div>
                <Separator className="bg-sidebar-border" />
                <ScrollArea className="min-h-0 flex-1 px-2 py-2">
                    <div className="flex flex-col gap-1">
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setActiveSidebarId(s.id)}
                                className={cn(
                                    "flex w-full flex-col gap-0.5 rounded-none border border-transparent px-2 py-2 text-left text-xs transition-colors",
                                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    activeSidebarId === s.id &&
                                        "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
                                )}
                            >
                                <span className="truncate font-medium">
                                    {s.title}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {s.hint}
                                </span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
                <Separator className="bg-sidebar-border" />
                <div className="flex items-center gap-2 px-3 py-3">
                    <Avatar size="sm">
                        <AvatarFallback className="bg-sidebar-accent text-[10px]">
                            You
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xs">Account</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                            Pro plan
                        </span>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-sidebar-foreground"
                        onClick={() =>
                            setTheme(
                                resolvedTheme === "dark" ? "light" : "dark"
                            )
                        }
                        aria-label="Toggle theme"
                    >
                        {!mounted ? (
                            <IconMoon />
                        ) : resolvedTheme === "dark" ? (
                            <IconSun />
                        ) : (
                            <IconMoon />
                        )}
                    </Button>
                </div>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-heading text-sm">
                            {firstUserSnippet ?? "New conversation"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            AI Gateway
                        </span>
                    </div>
                </header>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                                <div className="flex size-12 items-center justify-center rounded-none border border-border bg-card">
                                    <IconSparkles className="text-primary" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="font-heading text-sm">
                                        Start a conversation
                                    </p>
                                    <p className="max-w-sm text-xs text-muted-foreground">
                                        Messages stream from your{" "}
                                        <code className="text-foreground">
                                            /api/chat
                                        </code>{" "}
                                        route via the Vercel AI SDK and AI
                                        Gateway. Set{" "}
                                        <code className="text-foreground">
                                            AI_GATEWAY_API_KEY
                                        </code>{" "}
                                        in{" "}
                                        <code className="text-foreground">
                                            .env.local
                                        </code>
                                        .
                                    </p>
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
                                                {getMessageText(m)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </ScrollArea>

                <footer className="shrink-0 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
                    <div className="mx-auto w-full max-w-3xl">
                        {error ? (
                            <p className="mb-2 rounded-none border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
                                {error.message}
                            </p>
                        ) : null}
                        <div className="flex flex-col gap-0 rounded-none border border-border bg-card p-2 shadow-sm">
                            <Textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        void onSend()
                                    }
                                }}
                                placeholder="Message…"
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
                                            <IconLoader2
                                                data-icon="inline-start"
                                                className="animate-spin"
                                            />
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
