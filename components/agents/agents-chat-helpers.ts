import {
    getToolName,
    isReasoningUIPart,
    isTextUIPart,
    isToolUIPart,
    type UIMessage,
} from "ai"

type GetMessageTextOptions = {
    showToolLogs?: boolean
}

export const getMessageText = (
    message: UIMessage,
    options?: GetMessageTextOptions
) => {
    const showToolLogs = options?.showToolLogs ?? false
    return message.parts
        .map((p) => {
            if (isTextUIPart(p)) {
                return p.text
            }
            if (isReasoningUIPart(p)) {
                const t = p.text.trim()
                return t.length > 0 ? t : ""
            }
            if (isToolUIPart(p)) {
                if (!showToolLogs) {
                    return ""
                }
                const name = getToolName(p)
                if (p.state === "output-available") {
                    const out = p.output
                    const text =
                        typeof out === "object" && out !== null
                            ? JSON.stringify(out)
                            : String(out ?? "")
                    return `[${name}] ${text}`
                }
                if (p.state === "output-error") {
                    return `[${name}] Error: ${p.errorText}`
                }
                return `[${name}] …`
            }
            return ""
        })
        .filter((s) => s.length > 0)
        .join("\n")
}

export const getMessageTextForDisplay = (
    message: UIMessage,
    options?: GetMessageTextOptions
) => {
    return getMessageText(message, options)
}

export const formatSidebarHint = (iso: string) => {
    const d = new Date(iso)
    const t = d.getTime()
    if (Number.isNaN(t)) {
        return ""
    }
    const diff = Date.now() - t
    if (diff < 60_000) {
        return "Just now"
    }
    if (diff < 3_600_000) {
        return `${Math.floor(diff / 60_000)}m ago`
    }
    if (diff < 86_400_000) {
        return `${Math.floor(diff / 3_600_000)}h ago`
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
